// 格物江湖錄:天理殘卷 — 完整自動化 E2E 測試
// 用法:node tools/e2e.mjs            (測本機 http://localhost:8099/,需先開 http.server)
//       node tools/e2e.mjs --live     (測線上 GitHub Pages)
// 涵蓋:A 線全破、隱藏路線(第十/十一章實跑到完整版結局)、解鎖邏輯單元檢查、
//       題名/分享/配樂鑑賞/成就譜/公式站、Service Worker 離線快取與斷網重載。
// 退出碼 0=全過,1=有失敗(可接 CI)。
import { readFileSync } from 'fs';
// playwright:優先用專案內,退回本機全域安裝路徑(ponytail: 本機已知路徑,換機再調)
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = (await import('/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright/index.js')).default); }

const LIVE = process.argv.includes('--live');
const BASE = LIVE ? 'https://yazelin.github.io/gewu-jianghu-web/' : 'http://localhost:8099/';
const HERE = new URL('.', import.meta.url).pathname;
const G = JSON.parse(readFileSync(HERE + '../data/game.json', 'utf8'));
const CACHE = /CACHE\s*=\s*["']([^"']+)/.exec(readFileSync(HERE + '../sw.js', 'utf8'))[1];

// 由 game.json 建正解對照表(線索/破局戰)
const clueCorrect = {}, battleCorrect = {};
for (const h of G.prologue.hotspots) clueCorrect[h.name] = h.correct;
for (const c of G.chapters) { for (const cl of c.clues) clueCorrect[cl.name] = cl.correct; for (const b of c.battles) battleCorrect[b.prompt] = b.correct; }

// 三印齊全、真結局解鎖的合法狀態(由 sealSnapshot/trueEndingUnlocked 的實際條件反推)
const TRUE_STATE = {
  affinity: { 柳照微: 4, 江濯月: 3, 顧玄策: 3, 寧觀瀾: 3, 裴無咎: 2 },
  flags: {
    keeper_saved: true, apprentice_protected: true, mirror_testimony_published: true,
    copper_seal: true, registry_exposed: true, master_mirror_secured: true, zero_standard_secured: true,
    veto_clause_restored: true, allies_crosschecked_final: true,
  },
  choices: { final9: 'reversible_shutdown' },
  cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9],
};

const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass, extra }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

// 頁內自動遊玩:一路點到「結局畫面」出現為止(或步數上限)
const AUTOPLAY = async (page, maxSteps = 2600) => page.evaluate(async ({ clueCorrect, battleCorrect, maxSteps }) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const T = t => `${t}`.trim();
  const vis = el => el && el.offsetParent !== null;
  const byText = (sel, t) => [...document.querySelectorAll(sel)].find(e => vis(e) && T(e.textContent).includes(t));
  const click = el => { if (el) { el.click(); return true; } return false; };
  const trace = []; let last = '';
  for (let step = 0; step < maxSteps; step++) {
    await sleep(35);
    const S2 = JSON.parse(localStorage.getItem('gewu_save_v1') || '{}');
    if (S2.scene + '#' + S2.chapter !== last) { trace.push(S2.scene + '#' + S2.chapter); last = S2.scene + '#' + S2.chapter; }
    const eb = document.querySelector('.intro-eyebrow');
    if (eb && /結局/.test(T(eb.textContent))) {                       // 到達結局畫面 = 通關
      return { done: true, trace, ending: T(document.querySelector('.intro-title')?.textContent), badge: T(eb.textContent), save: S2 };
    }
    if (byText('.btn', '新案入局')) { click(byText('.btn', '新案入局')); continue; }
    if (byText('.btn', '下一幕')) { click(byText('.btn', '下一幕')); continue; }
    if (byText('.btn', '入局')) { click(byText('.btn', '入局')); continue; }
    const choice = [...document.querySelectorAll('.choicebox .choice')].filter(vis);
    if (choice.length && !document.querySelector('.cluewrap')) { click(choice[0]); continue; }   // 對白/難度/章末抉擇/情緣 → 選第一項(ch9=可逆止機、ch11=萬手共衡)
    const po = [...document.querySelectorAll('.cluebody .opt')].filter(vis);
    if (po.length && !po[0].disabled) { click(po[clueCorrect[T(document.querySelector('.cluebody h3')?.textContent)] ?? 0]); continue; }
    const closeClue = document.querySelector('.cluebody .btn') || byText('.pclose', '');
    if (closeClue && document.querySelector('.cluewrap')) { click(closeClue); continue; }
    if (byText('.util', '進入')) { click(byText('.util', '進入')); continue; }
    const hs = [...document.querySelectorAll('.hotspot')].filter(e => vis(e) && !e.classList.contains('done') && !e.classList.contains('lost'));
    if (hs.length && !document.querySelector('.cluewrap')) { click(hs[0]); continue; }
    const bo = [...document.querySelectorAll('.choicebox .opt')].filter(vis);
    if (bo.length && !bo[0].disabled) { click(bo[battleCorrect[T(document.querySelector('.choicebox .q')?.textContent)] ?? 0]); continue; }
    if (byText('.btn', '繼續 ▸')) { click(byText('.btn', '繼續 ▸')); continue; }
    if (document.querySelector('.dbox')) { click(document.querySelector('.dbox')); continue; }
    if (byText('.util', '進入第一章') || byText('.btn', '進入第一章')) { click(byText('.util', '進入第一章') || byText('.btn', '進入第一章')); continue; }
    const layer = document.querySelector('.layer');
    if (layer && !document.querySelector('.choicebox,.dbox,.cluewrap,.topbar,.modal')) { click(layer); continue; }
  }
  return { done: false, trace, save: JSON.parse(localStorage.getItem('gewu_save_v1') || '{}') };
}, { clueCorrect, battleCorrect, maxSteps });

const errors = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()); });
page.on('pageerror', e => errors.push('P:' + e.message));

console.log(`\n=== 格物江湖錄 E2E — ${LIVE ? '線上 Pages' : '本機'} (${BASE}) ===\n`);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

// ---- 1) A 線全破(新局 → 選難度 → 序 → 第一~九章普通結局)----
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
ok('題名載入', await page.evaluate(() => !!document.querySelector('.gtitle')));
const aline = await AUTOPLAY(page);
ok('A 線自動全破到普通結局', aline.done && (aline.save.cleared || []).includes(9),
  `結局「${aline.ending}」 cleared=[${(aline.save.cleared || []).join(',')}]`);

// ---- 2) 解鎖邏輯單元檢查(直接呼叫引擎函式,由造好的狀態驗封印/真結局門檻)----
const gate = await page.evaluate((st) => {
  S = newState(); Object.assign(S, st);
  S.history = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ chapter: n, ending: 'clear', insight: 6, lizheng: 4 }));
  const seals = sealSnapshot();
  const hiddenPos = hiddenRouteUnlocked();
  S.choices.final9 = 'destroy_tianli_axle';                       // 反例:選斷軸焚卷不該解鎖
  const hiddenNeg = hiddenRouteUnlocked();
  S.choices.final9 = 'reversible_shutdown';
  S.cleared = [...S.cleared, 10, 11]; S.choices.final11 = 'open_shared_standard';
  const trueOk = trueEndingUnlocked(sealSnapshot().count);
  return { count: seals.count, seals, hiddenPos, hiddenNeg, trueOk };
}, TRUE_STATE);
ok('封印計算 = 三印齊全', gate.count === 3, `people/${gate.seals.people} evidence/${gate.seals.evidence} fragment/${gate.seals.fragment}`);
ok('隱藏門扉解鎖判定(正例 true / 反例 false)', gate.hiddenPos === true && gate.hiddenNeg === false);
ok('完整版真結局解鎖判定', gate.trueOk === true);

// ---- 3) 隱藏路線實跑:注入已解鎖狀態進第十章 → 實玩第十、十一章到完整版結局 ----
await page.evaluate((st) => {
  S = newState(); Object.assign(S, st);
  S.history = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ chapter: n, ending: 'clear', insight: 6, lizheng: 4 }));
  S.chapter = 10; S.scene = 'chapter'; save(); go('chapter');
}, TRUE_STATE);
await page.waitForTimeout(400);
const hidden = await AUTOPLAY(page);
const hs = hidden.save || {};
ok('第十、十一章實跑到結局', hidden.done && (hs.cleared || []).includes(10) && (hs.cleared || []).includes(11),
  `結局「${hidden.ending}」(${hidden.badge}) finale=${hs.finale_ending} cleared=[${(hs.cleared || []).join(',')}]`);
ok('達成完整版真結局 heaven_earth_shared', hs.finale_ending === 'heaven_earth_shared', `實得 ${hs.finale_ending}`);

// ---- 4) 題名功能:分享 / 配樂鑑賞可播 / 成就譜 / 公式站 ----
await page.evaluate(() => go('title')); await page.waitForTimeout(400);
ok('題名分享鈕', await page.evaluate(() => [...document.querySelectorAll('button')].some(x => x.textContent.trim() === '分享')));
await page.evaluate(() => { S = loadSave() || newState(); musicGallery(); }); await page.waitForTimeout(300);
const rows = await page.evaluate(() => document.querySelectorAll('[data-mid]').length);
const playable = await page.evaluate(() => { const r = document.querySelector('[data-mid="calm"]'); if (!r) return false; r.click(); return !!(_audio && _audio.src.includes('oriental_calm')); });
ok('配樂鑑賞(曲數>0 且可單獨播放)', rows > 0 && playable, `${rows} 曲`);
await page.evaluate(() => document.querySelector('.modal .close')?.click());
await page.evaluate(() => { S = loadSave() || newState(); achievementCodex(); }); await page.waitForTimeout(250);
ok('江湖成就譜', await page.evaluate(() => !!document.querySelector('.modal h2') && document.querySelector('.modal h2').textContent.includes('成就譜')));
await page.evaluate(() => document.querySelector('.modal .close')?.click());
ok('公式站 design.html', (await page.evaluate(async () => (await fetch('design.html')).status)) === 200);

// ---- 5) 離線:Service Worker 全量 precache + 斷網重載 + 未播音檔命中 ----
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(4000);
const cached = await page.evaluate(async (c) => { try { return (await (await caches.open(c)).keys()).length; } catch { return 0; } }, CACHE);
ok(`Service Worker 全量快取(${CACHE})`, cached > 100, `${cached} 檔`);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
ok('斷網後題名仍可載入', await page.evaluate(() => !!document.querySelector('.gtitle')));
ok('斷網後未播過的章末音檔命中快取', (await page.evaluate(async () => { try { return (await fetch('assets/audio/chapter11_heaven_earth.ogg')).status; } catch { return 0; } })) === 200);
await ctx.setOffline(false);

// ---- 收尾 ----
ok('全程 console 零錯誤', errors.length === 0, errors.slice(0, 6).join(' | '));
await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通過 ===`);
if (failed.length) { console.log('未通過:', failed.map(r => r.name).join('、')); process.exit(1); }
console.log('全部通過。');
