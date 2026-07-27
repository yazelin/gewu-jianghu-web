// 八個結局實跑驗證 — 每個結局都用「正常遊玩」的方式打到底,不是直接呼叫結局函式。
//
// 為什麼要有這支:結局是「算」出來的(suggestedEnding / finaleEndingId),不是選單選的。
// 判定條件散在好感、旗標、封印、章末抉擇四處,任何一處寫錯都會讓某個結局變成拿不到,
// 而畫面完全正常——ending_all_normal / ending_all_complete 兩個成就就會永遠掛在那裡。
// masterless_road 就是這樣漏掉的(fallback 分支永遠走不到)。
//
// 用法:node tools/endings.mjs           全部八個
//       node tools/endings.mjs --only heaven_earth_shared
// 退出碼 0=八個都拿到,1=有結局拿不到。
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import http from 'http';
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = (await import('/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright/index.js')).default); }

const ROOT = new URL('..', import.meta.url).pathname;
const G = JSON.parse(readFileSync(join(ROOT, 'data/game.json'), 'utf8'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
  const f = join(ROOT, rel);
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const buf = readFileSync(f);
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'content-length': buf.length });
  res.end(buf);
});
const PORT = 8112;
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}/`;

// 正解對照表(線索/破局戰):要通關就得答對,否則證據不足會直接破局失敗
const clueCorrect = {}, battleCorrect = {};
for (const h of G.prologue.hotspots) clueCorrect[h.name] = h.correct;
for (const c of G.chapters) { for (const cl of c.clues) clueCorrect[cl.name] = cl.correct; for (const b of c.battles) battleCorrect[b.prompt] = b.correct; }
for (const b of (G.prologue.battle || [])) battleCorrect[b.prompt] = b.correct;

// 八條路線:章末抉擇字串(11 章 a/b)+ 章中對話字串(11 章 a/b)。
// 由 tools 內的模擬求解得出,實跑會驗證它們真的走到目標結局。
const ROUTES = [
  { id: 'people_witness',      badge: '普通結局',   fin: 'aaaaaabaa',   dlg: 'aaaaaaaab'   },
  { id: 'archive_sealed',      badge: '普通結局',   fin: 'aaaaaaaba',   dlg: 'aaaaaaaab'   },
  { id: 'return_mountain',     badge: '普通結局',   fin: 'aaaaabbba',   dlg: 'aaaaaaaaa'   },
  { id: 'nameless_ashes',      badge: '普通結局',   fin: 'aaaaaaabb',   dlg: 'aaaaaaaab'   },
  { id: 'heaven_earth_shared', badge: '完整版結局', fin: 'aaaaaaabaaa', dlg: 'aaaaaaaabba' },
  { id: 'common_measure',      badge: '完整版結局', fin: 'aaaaaaaaaaa', dlg: 'aaaaaaaaaaa' },
  { id: 'four_keys',           badge: '完整版結局', fin: 'aaaaaaaaaab', dlg: 'aaaaaaaaaaa' },
  { id: 'masterless_road',     badge: '完整版結局', fin: 'aaaaaaaaaaa', dlg: 'aaaaaaaaaba' },
];

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const codexOnly = process.argv.includes('--codex');
const plan = codexOnly ? [] : (only ? ROUTES.filter(r => r.id === only) : ROUTES);

const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass, extra }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

// 照劇本遊玩:三種選擇畫面靠 DOM 特徵分辨——
//   情緣有 .pin(角色定位)、章中對話有 .tag(好感增減)、章末抉擇只有 <small>(後果說明)。
const PLAY = async (page, route, maxSteps = 6000) => page.evaluate(async ({ clueCorrect, battleCorrect, maxSteps, fin, dlg, badge }) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const T = t => `${t}`.trim();
  const vis = e => e && e.offsetParent !== null;
  const byText = (sel, t) => [...document.querySelectorAll(sel)].find(e => vis(e) && T(e.textContent).includes(t));
  const click = e => { if (e) { e.click(); return true; } return false; };
  const idx = (str, ch) => (str[ch - 1] === 'b' ? 1 : 0);
  const picks = [];
  for (let step = 0; step < maxSteps; step++) {
    await sleep(20);
    const S2 = JSON.parse(localStorage.getItem('gewu_save_v1') || '{}');
    const eb = document.querySelector('.intro-eyebrow');
    if (eb && /結局/.test(T(eb.textContent)) && !/序章/.test(T(eb.textContent))) {
      // 完整版路線會先經過第九章的普通結局畫面,要按「穿過隱藏門扉」才進得了第十章。
      // 只有走到目標那一類結局才算跑完,否則就繼續。
      const door = byText('.btn', '穿過隱藏門扉');
      if (T(eb.textContent) !== badge && door) { click(door); continue; }
      return { done: true, badge: T(eb.textContent), title: T(document.querySelector('.intro-title')?.textContent),
        epilogue: T(document.querySelector('.intro-text')?.textContent || '').slice(-160), save: S2, picks };
    }

    // 有存檔時「新案入局」會先跳確認視窗;底下題名那顆仍在 DOM 裡,要優先點視窗裡的那顆,
    // 否則會一直點到被遮住的按鈕、視窗反覆開合,第二輪永遠開不了新局。
    const modalNew = [...document.querySelectorAll('.modal .btn')].find(x => vis(x) && T(x.textContent).includes('新案入局'));
    if (modalNew) { click(modalNew); continue; }
    if (byText('.btn', '新案入局')) { click(byText('.btn', '新案入局')); continue; }
    if (byText('.btn', '下一幕')) { click(byText('.btn', '下一幕')); continue; }
    if (byText('.btn', '入局')) { click(byText('.btn', '入局')); continue; }

    const choices = [...document.querySelectorAll('.choicebox .choice')].filter(vis);
    if (choices.length && !document.querySelector('.cluewrap')) {
      const ch = S2.chapter || 1;
      let pick = 0, kind = 'other';
      if (choices.some(b => b.querySelector('.pin'))) { kind = 'romance'; pick = 0; }              // 情緣:固定選第一位
      else if (choices.some(b => b.querySelector('.tag'))) { kind = 'dlg'; pick = idx(dlg, ch); }  // 章中對話
      else if (choices.some(b => b.querySelector('small'))) { kind = 'final'; pick = idx(fin, ch); }
      picks.push(`${kind}${ch}:${'ab'[pick] || '?'}`);
      click(choices[Math.min(pick, choices.length - 1)]);
      continue;
    }
    const po = [...document.querySelectorAll('.cluebody .opt')].filter(vis);
    if (po.length && !po[0].disabled) { click(po[clueCorrect[T(document.querySelector('.cluebody h3')?.textContent)] ?? 0]); continue; }
    const closeClue = document.querySelector('.cluebody .btn') || byText('.pclose', '');
    if (closeClue && document.querySelector('.cluewrap')) { click(closeClue); continue; }
    if (byText('.util', '進入')) { click(byText('.util', '進入')); continue; }
    // 場景內對白要先點完:對白播放中熱點雖然還在畫面上,但被 pointer-events:none 鎖住,
    // 先點熱點會一直點不動而空轉(踩過:整輪卡在第一章)。
    if (document.querySelector('.dbox')) { click(document.querySelector('.dbox')); continue; }
    const hs = [...document.querySelectorAll('.hotspot')].filter(e => vis(e) && !e.classList.contains('done') && !e.classList.contains('lost'));
    if (hs.length && !document.querySelector('.cluewrap')) { click(hs[0]); continue; }
    const sl = document.querySelector('.pslider');
    if (sl && !sl.disabled) { sl.value = 1.8; sl.dispatchEvent(new Event('input')); const lk = byText('.btn', '鎖定'); if (lk) { click(lk); continue; } }
    const bo = [...document.querySelectorAll('.choicebox .opt')].filter(vis);
    if (bo.length && !bo[0].disabled) { click(bo[battleCorrect[T(document.querySelector('.choicebox .q')?.textContent)] ?? 0]); continue; }
    if (byText('.btn', '進入下一式 ▸') || byText('.btn', '決定此案後果 ▸')) { click(byText('.btn', '進入下一式 ▸') || byText('.btn', '決定此案後果 ▸')); continue; }
    if (byText('.btn', '穿過隱藏門扉 ▸')) { click(byText('.btn', '穿過隱藏門扉 ▸')); continue; }
    if (byText('.btn', '繼續 ▸')) { click(byText('.btn', '繼續 ▸')); continue; }
    if (document.querySelector('.dbox')) { click(document.querySelector('.dbox')); continue; }
    if (byText('.util', '進入第一章') || byText('.btn', '進入第一章')) { click(byText('.util', '進入第一章') || byText('.btn', '進入第一章')); continue; }
    const layer = document.querySelector('.layer');
    if (layer && !document.querySelector('.choicebox,.dbox,.cluewrap,.topbar,.modal')) { click(layer); continue; }
  }
  return { done: false, save: JSON.parse(localStorage.getItem('gewu_save_v1') || '{}'), picks };
}, { clueCorrect, battleCorrect, maxSteps, fin: route.fin, dlg: route.dlg, badge: route.badge });

const errors = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()); });
page.on('pageerror', e => errors.push('P:' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

console.log(`\n=== 八結局實跑 (${BASE}) ===\n`);
const got = [];
for (const route of plan) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const t0 = Date.now();
  const r = await PLAY(page, route);
  const sv = r.save || {};
  const actual = route.badge === '普通結局' ? sv.normal_ending : sv.finale_ending;
  const pass = r.done && actual === route.id;
  got.push({ ...route, actual, title: r.title, pass, secs: ((Date.now() - t0) / 1000).toFixed(0),
    cleared: (sv.cleared || []).length, ach: Object.keys(sv.achievements || {}).length, epilogue: r.epilogue });
  ok(`${route.id}`, pass, `${r.title || '未達結局'}　實得 ${actual || '無'}　通過 ${(sv.cleared || []).length} 章　${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

// 收藏庫應該跨週目累積:八輪跑完(每輪都 clear localStorage)不代表圖鑑會累積,
// 所以最後單獨驗一次「連續兩輪不清存檔」的累積行為。
if (!only || codexOnly) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  const p1 = await PLAY(page, ROUTES[0]);
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem('gewu_codex_v1') || '{}'));
  await page.evaluate(() => go('title')); await page.waitForTimeout(400);
  const p2 = await PLAY(page, ROUTES[3]);          // 同一份收藏庫再跑一條不同的普通結局
  const second = await page.evaluate(() => JSON.parse(localStorage.getItem('gewu_codex_v1') || '{}'));
  ok('結局圖鑑跨週目累積(不清存檔連跑兩條)', (second.seen_normal || []).length > (first.seen_normal || []).length,
    `第一輪 ${(first.seen_normal || []).join('/')}(done=${p1.done}) → 第二輪 ${(second.seen_normal || []).join('/')}`
    + `(done=${p2.done} 標題=${p2.title || '無'} 章=${p2.save?.chapter} 抉擇=${(p2.picks || []).filter(x => x.startsWith('final')).join(' ')})`);
}

ok('全程 console 零錯誤', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); srv.close();

console.log('\n--- 明細 ---');
for (const g of got) console.log(`  ${g.pass ? '✓' : '✗'} ${g.id.padEnd(20)} ${g.badge}  ${g.title || ''}  ${g.cleared} 章 / ${g.ach} 成就 / ${g.secs}s`);
const failed = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通過 ===`);
if (failed.length) { console.log('未通過:', failed.map(r => r.name).join('、')); process.exit(1); }
console.log('八個結局全部可由正常遊玩取得。');
