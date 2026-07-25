// 部署存活測試 — 擋住「每次部署都把 33MB 資產刪光重抓」的回歸。
// 這件事壞掉時功能完全正常(圖照顯示、遊戲照玩),只是每次改版偷抓 28MB,
// 一般 e2e 測不出來,所以要有這支。
//
// 用法:node tools/sw-deploy.mjs      (自己複製 repo 到暫存目錄、自己起 server,不動到工作區)
// 退出碼 0=通過,1=有失敗。
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import http from 'http';
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = (await import('/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright/index.js')).default); }

const REPO = new URL('..', import.meta.url).pathname;
const ROOT = mkdtempSync(join(tmpdir(), 'gewu-deploy-'));
cpSync(REPO, ROOT, { recursive: true, filter: (s) => !s.includes('/.git') });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
let hits = [];
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
  const f = join(ROOT, rel);
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const st = statSync(f), etag = `"${st.size}-${st.mtimeMs}"`, ct = MIME[extname(f)] || 'application/octet-stream';
  const base = { 'cache-control': 'max-age=600', etag, 'content-type': ct };   // 仿 GitHub Pages
  if (req.headers['if-none-match'] === etag) { hits.push({ u: rel, b: 0 }); res.writeHead(304, base); return res.end(); }
  const buf = readFileSync(f);
  const m = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (m) {                                                                     // GitHub Pages 會回 206
    const s = Number(m[1] || 0), e = m[2] ? Number(m[2]) : buf.length - 1, sl = buf.slice(s, e + 1);
    hits.push({ u: rel, b: sl.length });
    res.writeHead(206, { ...base, 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${e}/${buf.length}`, 'content-length': sl.length });
    return res.end(sl);
  }
  hits.push({ u: rel, b: buf.length });
  res.writeHead(200, { ...base, 'accept-ranges': 'bytes', 'content-length': buf.length });
  res.end(buf);
});
const PORT = 8101;
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}/`;

const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };
const MB = (b) => (b / 1048576).toFixed(2) + ' MB';
const spent = () => { const b = hits.reduce((s, h) => s + h.b, 0); const n = hits.length; hits = []; return { n, b }; };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const settle = async () => { await page.waitForFunction(() => window.__offlineSettled === true, { timeout: 90000 }).catch(() => {}); };
const stat = () => page.evaluate(() => window.__offlineStat);
const audioCached = (name) => page.evaluate(async (n) => {
  try { return (await (await caches.open(n)).keys()).filter(r => r.url.includes('/audio/')).length; } catch { return 0; }
}, name);

const SW = join(ROOT, 'sw.js');
const src = readFileSync(SW, 'utf8');
const ASSET_CACHE = /ASSET_CACHE\s*=\s*["']([^"']+)/.exec(src)[1];
const AUDIO_N = (src.match(/"assets\/audio\/[^"]+"/g) || []).length;

// ---- 1) 首次造訪:整包抓下來 ----
await page.goto(BASE, { waitUntil: 'load' }); await settle();
const cold = spent();
const s1 = await stat();
ok('首次造訪:離線包完整', !!s1 && s1.done === s1.total, s1 ? `${s1.done}/${s1.total}、${MB(cold.b)}` : '無回報');
ok('首次造訪:音檔全進快取', (await audioCached(ASSET_CACHE)) === AUDIO_N, `${await audioCached(ASSET_CACHE)}/${AUDIO_N}`);

// ---- 2) 同版重開:零下載 ----
await page.reload({ waitUntil: 'load' }); await settle();
const revisit = spent();
ok('同版重開:零重抓', revisit.b === 0, `${revisit.n} 個請求、${MB(revisit.b)}`);

// ---- 3) 部署一版(bump SHELL_CACHE),且清掉瀏覽器 HTTP 快取(手機常態)----
writeFileSync(SW, readFileSync(SW, 'utf8').replace(/const SHELL_CACHE="[^"]+"/, 'const SHELL_CACHE="gewu-shell-vDEPLOYTEST"'));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable'); await cdp.send('Network.clearBrowserCache');
spent();
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3000); await settle();
const deploy = spent();
const s3 = await stat();
// 殼約 0.4MB;真正的擋板是「不可以接近 28MB」
ok('部署後:資產快取存活,不重抓 33MB', deploy.b < 5 * 1048576, `${deploy.n} 個請求、${MB(deploy.b)}`);
ok('部署後:離線包仍完整', !!s3 && s3.done === s3.total, s3 ? `${s3.done}/${s3.total}` : '無回報');
ok('部署後:音檔沒有被清掉', (await audioCached(ASSET_CACHE)) === AUDIO_N, `${await audioCached(ASSET_CACHE)}/${AUDIO_N}`);

await browser.close(); srv.close(); rmSync(ROOT, { recursive: true, force: true });
const failed = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通過 ===`);
if (failed.length) { console.log('未通過:', failed.map(r => r.name).join('、')); process.exit(1); }
console.log('全部通過。');
