// 全成就實跑驗證 — 連續遊玩多條路線(中間不清存檔),看 30 個成就能不能真的收齊。
//
// 為什麼要有這支:成就條件散在好感、旗標、封印、歷史紀錄、跨週目收藏庫五處。
// 只要有一條算錯,那個成就就永遠掛在譜上拿不到,而遊戲畫面一切正常。
// masterless_road 走不到害 ending_all_complete 拿不到,就是這樣才被發現的。
//
// 用法:node tools/achievements.mjs
// 退出碼 0=30 個全收齊,1=有拿不到的。
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
const PORT = 8115;
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}/`;

const clueCorrect = {}, battleCorrect = {};
for (const h of G.prologue.hotspots) clueCorrect[h.name] = h.correct;
for (const c of G.chapters) { for (const cl of c.clues) clueCorrect[cl.name] = cl.correct; for (const b of c.battles) battleCorrect[b.prompt] = b.correct; }
for (const b of (G.prologue.battle || [])) battleCorrect[b.prompt] = b.correct;

// 每條路線各自負責幾個成就。中間不清存檔,收藏庫要能一路累積。
const RUNS = [
  { tag: '真結局・宗師',  fin: 'aaaaaaabaaa', dlg: 'aaaaaaaabba', badge: '完整版結局', diff: '宗師' },
  { tag: '九路同衡',      fin: 'aaaaaaaaaaa', dlg: 'aabaaaaaabb', badge: '完整版結局' },
  { tag: '故人共尺',      fin: 'abbbbbbbaaa', dlg: 'aaaaaabaabb', badge: '完整版結局' },
  { tag: '公議新尺',      fin: 'aaaaaaaaaaa', dlg: 'aaaaaaaaaaa', badge: '完整版結局' },
  { tag: '四鑰守衡',      fin: 'aaaaaaaaaab', dlg: 'aaaaaaaaaaa', badge: '完整版結局' },
  { tag: '天理入庫',      fin: 'aaaaaaaba',   dlg: 'aaaaaaaab',   badge: '普通結局' },
  { tag: '折衡歸山',      fin: 'aaaaabbba',   dlg: 'aaaaaaaaa',   badge: '普通結局' },
  { tag: '無名灰燼',      fin: 'aaaaaaabb',   dlg: 'aaaaaaaab',   badge: '普通結局' },
  { tag: '萬民見證',      fin: 'aaaaaabaa',   dlg: 'aaaaaaaab',   badge: '普通結局' },
  { tag: '敗卷重開+一息尚存', fin: 'aaaaaaaaaaa', dlg: 'aaaaaaaaaaa', badge: '普通結局', sabotage: true },
];

const onlyTag = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const PLAY = async (page, run, maxSteps = 14000) => page.evaluate(async ({ clueCorrect, battleCorrect, maxSteps, fin, dlg, badge, diff, sabotage }) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const T = t => `${t}`.trim();
  const vis = e => e && e.offsetParent !== null;
  const byText = (sel, t) => [...document.querySelectorAll(sel)].find(e => vis(e) && T(e.textContent).includes(t));
  const click = e => { if (e) { e.click(); return true; } return false; };
  const idx = (s, ch) => (s[ch - 1] === 'b' ? 1 : 0);
  // 蓄意答錯不能寫死次數:氣勢上限會隨章節獎勵成長,序章的 S.chapter 也是 1(會誤打在序章上,
  // 而序章失敗走的是另一條重來路徑,拿不到 failed_chN)。改成看旗標自我修正——
  // 定心符還沒燒過就繼續錯,燒過了但本章還沒失敗過也繼續錯,兩者都有了就恢復正常作答。
  for (let step = 0; step < maxSteps; step++) {
    await sleep(18);
    const S2 = JSON.parse(localStorage.getItem('gewu_save_v1') || '{}');
    const eb = document.querySelector('.intro-eyebrow');
    if (eb && /結局/.test(T(eb.textContent)) && !/序章/.test(T(eb.textContent))) {
      const door = byText('.btn', '穿過隱藏門扉');
      if (T(eb.textContent) !== badge && door) { click(door); continue; }
      return { done: true, badge: T(eb.textContent), save: S2 };
    }
    if (byText('.btn', '重來本章')) { click(byText('.btn', '重來本章')); continue; }   // 失敗畫面 → 重來(敗卷重開)
    const modalNew = [...document.querySelectorAll('.modal .btn')].find(x => vis(x) && T(x.textContent).includes('新案入局'));
    if (modalNew) { click(modalNew); continue; }
    // 難度(心法)在題名上是一顆收合的 chip,不是 choicebox —— 要先展開再選,且必須在按新案之前
    const toggle = document.querySelector('.tseg-toggle');
    if (diff && toggle && vis(toggle) && !T(toggle.textContent).includes(diff)) {
      if (!document.querySelector('.tpop.open')) { click(toggle); continue; }
      const opt = [...document.querySelectorAll('.tseg-btn')].find(x => T(x.textContent) === diff);
      if (opt) { click(opt); click(toggle); continue; }
    }
    if (byText('.btn', '新案入局')) { click(byText('.btn', '新案入局')); continue; }
    if (byText('.btn', '下一幕')) { click(byText('.btn', '下一幕')); continue; }
    if (byText('.btn', '入局')) { click(byText('.btn', '入局')); continue; }

    const choices = [...document.querySelectorAll('.choicebox .choice')].filter(vis);
    if (choices.length && !document.querySelector('.cluewrap')) {
      const ch = S2.chapter || 1;
      let pick = 0;
      if (choices.some(b => b.querySelector('.pin'))) pick = 0;
      else if (choices.some(b => b.querySelector('.tag'))) pick = idx(dlg, ch);
      else if (choices.some(b => b.querySelector('small'))) {
        // 難度選單也是這個形狀(沒有 .tag/.pin),用文字認出來
        const isDiff = choices.some(b => /行俠|格物|宗師/.test(T(b.textContent)));
        if (isDiff && diff) pick = choices.findIndex(b => T(b.textContent).includes(diff));
        else pick = idx(fin, ch);
      }
      click(choices[Math.max(0, Math.min(pick, choices.length - 1))]);
      continue;
    }
    const po = [...document.querySelectorAll('.cluebody .opt')].filter(vis);
    if (po.length && !po[0].disabled) { click(po[clueCorrect[T(document.querySelector('.cluebody h3')?.textContent)] ?? 0]); continue; }
    const closeClue = document.querySelector('.cluebody .btn') || byText('.pclose', '');
    if (closeClue && document.querySelector('.cluewrap')) { click(closeClue); continue; }
    // 熱點要排在「進入破局」之前:證據一到最低門檻按鈕就出現,先按就永遠收不滿 6 證,
    // 六證成卷/格物無漏/十一卷無漏/誤差亦須署名 四個成就都會拿不到。
    const hs = [...document.querySelectorAll('.hotspot')].filter(e => vis(e) && !e.classList.contains('done') && !e.classList.contains('lost'));
    if (hs.length && !document.querySelector('.cluewrap')) { click(hs[0]); continue; }
    if (byText('.util', '進入')) { click(byText('.util', '進入')); continue; }
    const sl = document.querySelector('.pslider');
    if (sl && !sl.disabled) { sl.value = 1.8; sl.dispatchEvent(new Event('input')); const lk = byText('.btn', '鎖定'); if (lk) { click(lk); continue; } }
    const bo = [...document.querySelectorAll('.choicebox .opt')].filter(vis);
    if (bo.length && !bo[0].disabled) {
      const correct = battleCorrect[T(document.querySelector('.choicebox .q')?.textContent)] ?? 0;
      let pick = correct;
      const ch2 = S2.chapter || 0, f = S2.flags || {};
      if (sabotage && ch2 >= 2 && (S2.cleared || []).includes(1) &&
          (!f.talisman_used || !f['failed_ch' + ch2])) pick = (correct + 1) % bo.length;
      click(bo[pick]); continue;
    }
    if (byText('.btn', '進入下一式 ▸') || byText('.btn', '決定此案後果 ▸')) { click(byText('.btn', '進入下一式 ▸') || byText('.btn', '決定此案後果 ▸')); continue; }
    if (byText('.btn', '繼續 ▸')) { click(byText('.btn', '繼續 ▸')); continue; }
    // 氣勢歸零時那顆往下走的按鈕文字是「——」不是「繼續 ▸」,認不出來就會卡在破局戰畫面
    const dead = [...document.querySelectorAll('.btn')].find(x => vis(x) && T(x.textContent) === '——');
    if (dead) { click(dead); continue; }
    if (document.querySelector('.dbox')) { click(document.querySelector('.dbox')); continue; }
    if (byText('.util', '進入第一章') || byText('.btn', '進入第一章')) { click(byText('.util', '進入第一章') || byText('.btn', '進入第一章')); continue; }
    const layer = document.querySelector('.layer');
    if (layer && !document.querySelector('.choicebox,.dbox,.cluewrap,.topbar,.modal')) { click(layer); continue; }
  }
  return { done: false, save: JSON.parse(localStorage.getItem('gewu_save_v1') || '{}') };
}, { clueCorrect, battleCorrect, maxSteps, fin: run.fin, dlg: run.dlg, badge: run.badge, diff: run.diff || null, sabotage: !!run.sabotage });

const errors = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()); });
page.on('pageerror', e => errors.push('P:' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);

console.log(`\n=== 全成就實跑 (${BASE}) ===\n`);
for (const run of (onlyTag ? RUNS.filter(r => r.tag.includes(onlyTag)) : RUNS)) {
  const t0 = Date.now();
  const r = await PLAY(page, run);
  const c = await page.evaluate(() => JSON.parse(localStorage.getItem('gewu_codex_v1') || '{}'));
  const n = Object.values(c.achievements || {}).filter(Boolean).length;
  console.log(`  ${run.tag.padEnd(20)} ${r.done ? '走到結局' : '未達結局'}　累計成就 ${String(n).padStart(2)}/30　${((Date.now() - t0) / 1000).toFixed(0)}s`
    + (r.done ? '' : `　停在 scene=${r.save?.scene} ch=${r.save?.chapter} cleared=[${(r.save?.cleared || []).join(',')}] 旗標=${JSON.stringify(Object.keys(r.save?.flags || {}).filter(k => /failed|talisman|defeat/.test(k)))}`));
  await page.evaluate(() => go('title')); await page.waitForTimeout(400);
}

const codex = await page.evaluate(() => JSON.parse(localStorage.getItem('gewu_codex_v1') || '{}'));
const have = codex.achievements || {};
const missing = G.achievements.ordered.filter(id => !have[id]);
console.log('\n--- 成就明細 ---');
for (const id of G.achievements.ordered) {
  const it = G.achievements.items[id];
  console.log(`  ${have[id] ? '✓' : '✗'} ${id.padEnd(30)} ${it.title}${have[id] ? '' : '　← 未取得:' + it.hint}`);
}
ok('30 個成就全部取得', missing.length === 0, missing.length ? `缺 ${missing.length} 個:${missing.join('、')}` : '');
ok('結局圖鑑 4 普通 + 4 完整版全收', (codex.seen_normal || []).length === 4 && (codex.seen_finale || []).length === 4,
  `普通 ${(codex.seen_normal || []).length}/4、完整版 ${(codex.seen_finale || []).length}/4`);
ok('全程 console 零錯誤', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); srv.close();

const failed = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通過 ===`);
if (failed.length) process.exit(1);
console.log('30 個成就與 8 個結局都能由正常遊玩收齊。');
