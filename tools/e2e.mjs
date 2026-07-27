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
const SW_SRC = readFileSync(HERE + '../sw.js', 'utf8');
const SHELL_CACHE = /SHELL_CACHE\s*=\s*["']([^"']+)/.exec(SW_SRC)[1];
const ASSET_CACHE = /ASSET_CACHE\s*=\s*["']([^"']+)/.exec(SW_SRC)[1];
const CORE_N = (/const CORE=\[(.*?)\];/s.exec(SW_SRC)[1].match(/"/g).length) / 2;
const AUDIO_N = (SW_SRC.match(/"assets\/audio\/[^"]+"/g) || []).length;

// 由 game.json 建正解對照表(線索/破局戰)
const clueCorrect = {}, battleCorrect = {};
for (const h of G.prologue.hotspots) clueCorrect[h.name] = h.correct;
for (const c of G.chapters) { for (const cl of c.clues) clueCorrect[cl.name] = cl.correct; for (const b of c.battles) battleCorrect[b.prompt] = b.correct; }
for (const b of (G.prologue.battle || [])) battleCorrect[b.prompt] = b.correct;   // 序章破局選擇題正解

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
    if (eb && /結局/.test(T(eb.textContent)) && !/序章/.test(T(eb.textContent))) {   // 到達(非序章)結局畫面 = 通關
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
    const sl = document.querySelector('.pslider');                                  // 序章滑桿估算題:拖到門檻上再鎖定
    if (sl && !sl.disabled) { sl.value = 1.8; sl.dispatchEvent(new Event('input')); const lk = byText('.btn', '鎖定'); if (lk) { click(lk); continue; } }
    const bo = [...document.querySelectorAll('.choicebox .opt')].filter(vis);
    if (bo.length && !bo[0].disabled) { click(bo[battleCorrect[T(document.querySelector('.choicebox .q')?.textContent)] ?? 0]); continue; }
    if (byText('.btn', '進入下一式 ▸') || byText('.btn', '決定此案後果 ▸')) { click(byText('.btn', '進入下一式 ▸') || byText('.btn', '決定此案後果 ▸')); continue; }
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
ok('題名載入(毛筆題字圖已解碼)', await page.evaluate(() => { const i = document.querySelector('.tlockup'); return !!i && i.complete && i.naturalWidth > 0; }));
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
const hidden = await AUTOPLAY(page, 4200);   // 隱藏路線對白/抉擇多,給更寬步數上限避免偶發跑不完
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
await page.evaluate(() => document.querySelector('.povl')?.remove());
await page.evaluate(() => { S = loadSave() || newState(); achievementCodex(); }); await page.waitForTimeout(250);
ok('江湖成就譜(徽記+篩選+進度)', await page.evaluate(() => !!document.querySelector('.pboard') && document.body.textContent.includes('成就譜') && document.querySelectorAll('.ach-card').length > 0 && document.querySelectorAll('.ach-tab').length > 1 && !!document.querySelector('.ach-prog-fill')));
await page.evaluate(() => document.querySelector('.povl')?.remove());
ok('公式站 design.html', (await page.evaluate(async () => (await fetch('design.html')).status)) === 200);

// ---- 4b) ESC 關窗:三種視窗家族(.povl / .modal / .roll-ov)反應要與按 X 一致 ----
const escClose = async (openLabel) => {
  await page.evaluate((l) => [...document.querySelectorAll('.tmenu button')].find(x => x.textContent.includes(l))?.click(), openLabel);
  await page.waitForTimeout(900);
  const before = await page.evaluate(() => document.querySelectorAll('.povl,.modal,.roll-ov').length);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => document.querySelectorAll('.povl,.modal,.roll-ov').length);
  await page.evaluate(() => document.querySelectorAll('.povl,.modal,.roll-ov').forEach(x => x.remove()));
  return before > 0 && after === before - 1;
};
await page.evaluate(() => go('title')); await page.waitForTimeout(900);
ok('ESC 關掉成就譜(.povl)', await escClose('江湖成就譜'));

// 視窗是單例:連按同一個鈕、或 ESC 後焦點留在鈕上再按空白,都不該疊出好幾個
const winCount = () => page.evaluate(() => document.querySelectorAll('.povl,.modal,.roll-ov').length);
for (let i = 0; i < 3; i++) { await page.evaluate(() => [...document.querySelectorAll('.tmenu button')].find(x => x.textContent.includes('殺青片尾'))?.click()); await page.waitForTimeout(700); }
ok('連按三次只開一個視窗', (await winCount()) === 1, `${await winCount()} 個`);
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
ok('關窗後焦點回到開啟它的按鈕', await page.evaluate(() => (document.activeElement?.textContent || '').includes('殺青片尾')));
for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(450); }
ok('ESC 後連按空白鍵不會疊出多個', (await winCount()) <= 1, `${await winCount()} 個`);
await page.evaluate(() => document.querySelectorAll('.povl,.modal,.roll-ov').forEach(x => x.remove()));
ok('ESC 關掉殺青片尾(.roll-ov)', await escClose('殺青片尾'));

// ---- 5) 離線:Service Worker 全量 precache + 斷網重載 + 未播音檔命中 ----
await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 15000 }).catch(() => {});
// 等背景暖快取收斂。線上剛部署完 Fastly 邊緣是冷的,28MB 抓不完 90 秒——這是測試等太短,
// 不是產品問題(實測伺服器端全 200、資產數會一路長)。--live 放寬到 4 分鐘。
await page.waitForFunction(() => window.__offlineSettled === true, { timeout: LIVE ? 240000 : 90000 }).catch(() => {});
await page.waitForTimeout(500);
const stat = await page.evaluate(() => window.__offlineStat);
ok('離線包完整(SW 實查快取,不是數 fetch 成功次數)',
  !!stat && stat.done === stat.total && stat.total === CORE_N, stat ? `${stat.done}/${stat.total}` : '無回報');
const counts = await page.evaluate(async ([shell, asset]) => {
  const list = async (n) => { try { return (await (await caches.open(n)).keys()).map(r => new URL(r.url).pathname); } catch { return []; } };
  const s = await list(shell), a = await list(asset);
  return { shell: s.length, asset: a.length, audio: a.filter(p => p.includes('/audio/')).length };
}, [SHELL_CACHE, ASSET_CACHE]);
ok(`殼與資產分屬兩個快取(${SHELL_CACHE} / ${ASSET_CACHE})`, counts.shell > 0 && counts.asset > 100, `殼 ${counts.shell}、資產 ${counts.asset}`);
ok('音檔全數在快取裡(音樂斷網不能播的回歸擋板)', counts.audio === AUDIO_N, `${counts.audio}/${AUDIO_N}`);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
ok('斷網後題名仍可載入(含題字圖)', await page.evaluate(() => { const i = document.querySelector('.tlockup'); return !!i && i.complete && i.naturalWidth > 0; }));
ok('斷網後未播過的章末音檔命中快取', (await page.evaluate(async () => { try { return (await fetch('assets/audio/chapter11_heaven_earth.ogg')).status; } catch { return 0; } })) === 200);
// 命中快取 ≠ 播得出來:大音檔 Chrome 一律用 Range 抓,SW 沒合成 206 就會 Format error。
// 這一項只有在真的送出 Range 的環境(線上 Pages)才有鑑別力,--live 是真正的關卡。
const bigTrack = await page.evaluate(async () => {
  const el = new Audio(); el.volume = 0; el.preload = 'auto';
  el.src = 'assets/audio/chapter7_mirror_city.ogg';
  const v = await new Promise(res => {
    el.addEventListener('loadedmetadata', () => res('ok:' + Math.round(el.duration) + 's'));
    el.addEventListener('error', () => res('err:' + (el.error && el.error.code)));
    setTimeout(() => res('timeout'), 12000);
  });
  el.removeAttribute('src'); el.load();
  return v;
});
ok('斷網後大音檔真的能解碼播放(1.1MB,Range→206)', bigTrack.startsWith('ok:'), bigTrack);
// ---- 手機:殺青片尾要滑得動 ----
// touch-action 預設 auto 時,瀏覽器會把滑動當頁面平移接管、發 pointercancel,
// 180px 的滑動只會動 18px——看起來就是「滑不動」。這條擋它回歸。
{
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage(); const mcdp = await mctx.newCDPSession(mp);
  await mp.goto(BASE, { waitUntil: 'load' }); await mp.waitForTimeout(1500);
  await mp.evaluate(() => localStorage.setItem('gewu_save_v1', JSON.stringify({ schema: 1, scene: 'chapter', chapter: 2,
    affinity: {}, evidence: {}, lost: {}, secured_order: {}, inventory: {}, choices: {}, cleared: [1], intro_seen: true,
    flags: {}, rewarded: {}, achievements: {}, seen_normal: [], seen_finale: [], perfect: {}, grandmaster: {}, difficulty: '行俠', checkpoints: {} })));
  await mp.reload({ waitUntil: 'load' }); await mp.waitForTimeout(2200);
  await mp.evaluate(() => [...document.querySelectorAll('.tmenu button')].find(x => x.textContent.includes('殺青片尾'))?.click());
  await mp.waitForTimeout(1600);
  await mp.evaluate(() => [...document.querySelectorAll('.roll-btn')].find(x => /暫停|停/.test(x.textContent))?.click());
  await mp.waitForTimeout(500);
  const posOf = () => mp.evaluate(() => { const t = document.querySelector('.roll-track'); return t ? Math.round(new DOMMatrix(getComputedStyle(t).transform).f) : null; });
  const p0 = await posOf();
  await mcdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 422, y: 250 }] });
  for (let i = 1; i <= 10; i++) { await mcdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 422, y: 250 - i * 18 }] }); await mp.waitForTimeout(15); }
  await mcdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mp.waitForTimeout(400);
  const p1 = await posOf();
  const moved = Math.abs((p1 ?? 0) - (p0 ?? 0));
  ok('手機:殺青片尾滑得動(180px 滑動要真的走 180px)', moved > 140, `實際移動 ${moved}px`);
  ok('手機:片尾關閉鈕是統一的 ✕', (await mp.evaluate(() => document.querySelector('.roll-ov .pclose')?.textContent)) === '✕');
  await mctx.close();
}

{ // 手機橫向:瀏覽器搜尋列收合/展開時,可見高度會變(裝成 App 與否就差這一條)。
  // height:100% 解到含 chrome 的大視窗 → 上下露出沒填滿的帶狀區。這裡擋 100dvh 被改回去。
  const vctx = await browser.newContext({ viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true });
  const vp = await vctx.newPage();
  await vp.goto(BASE, { waitUntil: 'load' });
  await vp.waitForTimeout(1800);
  const probe = () => vp.evaluate(() => {
    const rc = document.getElementById('stage').getBoundingClientRect();
    return { gap: Math.max(Math.round(rc.top), Math.round(innerHeight - rc.bottom)),
             wrap: document.getElementById('wrap').offsetHeight,
             amb: document.getElementById('ambient').offsetHeight, vh: innerHeight };
  });
  const heights = [];
  for (const h of [340, 390, 340]) {                 // 展開 → 收合 → 再展開
    await vp.setViewportSize({ width: 844, height: h });
    await vp.waitForTimeout(350);
    heights.push(await probe());
  }
  const filled = heights.every(r => r.wrap === r.vh && r.amb === r.vh && r.gap <= 1);
  ok('手機橫向:瀏覽器列收合/展開後仍滿版(無上下留白)', filled,
     heights.map(r => `${r.vh}→wrap${r.wrap}/amb${r.amb}/留${r.gap}`).join(' '));
  await vctx.close();
}

{ // 補回原作有、我們一直沒演的內容:破局現場結果/劇情代價、路線名、情緣後日談。
  // 這些資料一直躺在 game.json 裡沒有渲染路徑,壞掉時畫面照跑,只有內容悄悄消失 → 要有擋板。
  const r = await page.evaluate(() => {
    const c1 = G.chapters[0], bt = c1.battles[0], be = c1.battle_beats[0];
    const noBeatCh = G.chapters.find(c => !(c.battle_beats || []).length);
    const okH = battleResultHTML(bt, be, true), badH = battleResultHTML(bt, be, false);
    const keep = S.romance;
    S.romance = '蘇檀'; const paired = romanceEpilogue('normal'), pairedF = romanceEpilogue('finale');
    S.romance = ''; const solo = romanceEpilogue('normal'), soloF = romanceEpilogue('finale');
    S.romance = keep;
    return { okH, badH, noBeat: battleResultHTML(noBeatCh.battles[0], undefined, true),
      action: be.action, failure: be.failure,
      rA: routeName(c1, 'A'), rB: routeName(c1, 'B'), rNone: routeName(null, 'A'),
      paired, pairedF, solo, soloF };
  });
  ok('破局答對:現場結果與算式並列', r.okH.includes('現場結果') && r.okH.includes(r.action.slice(0, 12)));
  ok('破局答錯:劇情代價與算式並列', r.badH.includes('劇情代價') && r.badH.includes(r.failure.slice(0, 12)));
  ok('沒有 beats 的章節不出空欄', !r.noBeat.includes('rescols'));
  ok('路線顯示資料裡的名字而不是 A/B', r.rA === '護鐘線' && r.rB === '循印線', `${r.rA} / ${r.rB}`);
  ok('章節沒填路線名才退回字母', r.rNone === 'A 線');
  ok('情緣後日談:許心意取該人的,普通/完整版不同文', r.paired.name === '蘇檀' && r.paired.text !== r.pairedF.text);
  ok('情緣後日談:未許心意取獨行版', r.solo.name === '獨行' && r.solo.text !== r.soloF.text);

  // 第二輪稽核挖出來的:許心意後的回話、破局的路線分歧、里程碑與破局的脈絡
  const r2 = await page.evaluate(async () => {
    const c = G.chapters[0];
    S.chapter = 1; S.route = 'B'; S.affinity = { 蘇檀: 4 }; S.romance = '';
    const beatLines = [];
    for (const b of c.battle_beats) {
      if (b.response) beatLines.push({ speaker: b.speaker || '', text: b.response });
      const rt = b.route_text && b.route_text[S.route];
      if (rt) beatLines.push({ speaker: routeName(c), text: rt });
    }
    romanceSelect('intent', () => {});
    await new Promise(r => setTimeout(r, 350));
    [...document.querySelectorAll('.choice')].find(x => x.textContent.includes('蘇檀'))?.click();
    await new Promise(r => setTimeout(r, 500));
    const said = document.querySelector('.dbox')?.textContent || '';
    closeAllWindows();
    S.evidence = { ch1: c.clues.filter(x => x.thread).slice(0, 4).map(x => x.id) };
    evidenceModal('ch1', c.clues);
    await new Promise(r => setTimeout(r, 350));
    [...document.querySelectorAll('.ach-tab')].find(t => t.textContent.includes('天理'))?.click();
    await new Promise(r => setTimeout(r, 250));
    const tianli = document.querySelector('.pboard')?.textContent || '';
    closeAllWindows();
    chapterClearScreen(c);
    await new Promise(r => setTimeout(r, 350));
    return { said, tianli, clear: document.querySelector('.choicebox')?.textContent || '',
      expectAfter: G.romance.candidates['蘇檀'].after, ms2: c.milestones['2'].thread,
      routeLine: beatLines.find(l => l.speaker === '循印線')?.text || '',
      beatThread: c.battle_beats[0].thread };
  });
  ok('許心意後對方會回話(candidates.after)', r2.said.includes(r2.expectAfter.slice(0, 14)));
  ok('戰後劇情帶入破局的路線分歧', !!r2.routeLine, r2.routeLine.slice(0, 22));
  ok('天理分頁串上里程碑脈絡', r2.tianli.includes(r2.ms2.slice(0, 12)), r2.ms2.slice(0, 18));
  ok('通關畫面列出本章破局脈絡', r2.clear.includes('本章脈絡') && r2.clear.includes(r2.beatThread.slice(0, 10)));

  // 第 9、11 章的 afterChapter 是 setTimeout(700) 才換畫面,那段空窗按鈕還在。
  // 連點就把好感重複套用 → 結局是由好感算出來的,等於玩家點兩下就換一個結局。
  const dbl = await page.evaluate(async () => {
    const out = {};
    for (const ch of [9, 11]) {
      for (const clicks of [1, 3]) {
        clear(); S = newState(); S.chapter = ch; S.evidence = {}; S._battleCorrect = 0;
        finalChoice(G.chapters[ch - 1]);
        await new Promise(r => setTimeout(r, 120));
        for (let i = 0; i < clicks; i++) {                       // 每次重查 DOM = 真人只點得到還在畫面上的
          const live = [...document.querySelectorAll('.choicebox .choice')].filter(x => x.offsetParent !== null);
          if (live.length) live[0].click();
          await new Promise(r => setTimeout(r, 40));
        }
        out[`${ch}x${clicks}`] = JSON.stringify(S.affinity);
        await new Promise(r => setTimeout(r, 1500));             // 排空 setTimeout(700)
      }
    }
    clear(); go('title');
    return out;
  });
  ok('第9章章末抉擇連點不會重複結算好感', dbl['9x1'] === dbl['9x3'], `1下 ${dbl['9x1']} / 3下 ${dbl['9x3']}`);
  ok('第11章章末抉擇連點不會重複結算好感', dbl['11x1'] === dbl['11x3'], `1下 ${dbl['11x1']} / 3下 ${dbl['11x3']}`);
}

{ // 攻略站的圖量:全解析度美術當小圖用時整頁要載 9.3MB,回報過「載很久」。
  // 縮圖(assets/thumb)+ 每張都寫 width/height 是修法,這裡擋住它被改回去。
  const gp = await ctx.newPage();
  let imgBytes = 0, img404 = 0;
  gp.on('response', r => {
    if (/\.(webp|png|jpg)$/.test(r.url())) imgBytes += +(r.headers()['content-length'] || 0);
    if (r.status() >= 400) img404++;
  });
  await gp.goto(BASE + 'design.html', { waitUntil: 'load' });
  await gp.evaluate(() => document.querySelectorAll('img').forEach(i => { i.loading = 'eager'; }));
  await gp.waitForTimeout(6000);
  const gm = await gp.evaluate(() => {
    const a = [...document.querySelectorAll('img')];
    return { n: a.length, broken: a.filter(i => i.complete && i.naturalWidth === 0).length,
      noDim: a.filter(i => !i.getAttribute('width') || !i.getAttribute('height')).length };
  });
  ok('攻略站沒有破圖', gm.broken === 0 && img404 === 0, `${gm.n} 張,破圖 ${gm.broken},4xx ${img404}`);
  ok('攻略站每張圖都有 width/height(否則捲動時版面一路跳)', gm.noDim === 0, `缺 ${gm.noDim} 張`);
  // 光驗「屬性存在」不夠 —— v114 就是這樣漏的:加了 width/height 屬性但 CSS 只寫 width:100%
  // 沒寫 height:auto,高度照屬性鎖死,寬度隨容器縮 → 113 張裡 91 張被拉扁。
  // 所以要驗「顯示比例 == 原圖比例」,而且三種視窗都要驗(當時只截了 .who 那段,剛好是唯一沒事的一組)。
  const aspectBad = async (page) => page.evaluate(() => {
    const bad = [];
    for (const i of document.querySelectorAll('img')) {
      if (!i.complete || !i.naturalWidth) continue;
      const c = i.getBoundingClientRect();
      if (c.width < 1 || c.height < 1) continue;
      const nat = i.naturalWidth / i.naturalHeight, shown = c.width / c.height;
      if (Math.abs(nat - shown) / nat > 0.02) bad.push(i.src.split('/').pop());
    }
    return bad;
  });
  ok('攻略站圖片比例沒被拉壞(桌機)', (await aspectBad(gp)).length === 0, (await aspectBad(gp)).slice(0, 3).join(' '));
  for (const [label, vp] of [['直向 390', { width: 390, height: 844 }], ['橫向 844', { width: 844, height: 390 }]]) {
    await gp.setViewportSize(vp);
    await gp.waitForTimeout(500);
    const bad = await aspectBad(gp);
    ok(`攻略站圖片比例沒被拉壞(手機${label})`, bad.length === 0, bad.slice(0, 3).join(' '));
  }
  await gp.setViewportSize({ width: 1280, height: 720 });
  ok('攻略站整頁圖量 < 6.5MB', imgBytes < 6.5 * 1048576, `${(imgBytes / 1048576).toFixed(2)}MB`);
  await gp.close();
}

{ // 漸進載入:CORE 是照遊玩順序抓的,序章與前幾章要排在最前面。
  // 順序錯了不會有錯誤訊息,只是「下載到一半斷線」的人玩不到後面的章 —— 要有擋板。
  const prog = await page.evaluate(async () => {
    const sw = navigator.serviceWorker.controller;
    const list = await new Promise(r => {
      const ch = new MessageChannel(); ch.port1.onmessage = e => r(e.data.list);
      sw.postMessage({ type: 'offline-list' }, [ch.port2]);
    });
    const pos = u => list.indexOf(u);
    const pro = [G.prologue.background, ...G.prologue.hotspots.map(h => h.cell)].filter(Boolean);
    const chVis = G.chapters.map(c => [c.background, ...c.clues.map(x => x.cell)].filter(Boolean));
    // have 查詢:問 SW「這批在不在快取」,進章前的離線判斷靠它
    const have = await new Promise(r => {
      const ch = new MessageChannel(); ch.port1.onmessage = e => r(e.data.missing);
      sw.postMessage({ type: 'have', list: pro.concat(['assets/img/__不存在__.webp']) }, [ch.port2]);
    });
    return { total: list.length,
      proLast: Math.max(...pro.map(pos)),
      chLast: chVis.map(a => Math.max(...a.map(pos))),
      galleryFirst: list.findIndex(u => u.includes('chapter9_ending')),
      haveMissing: have };
  });
  ok('序章素材排在暖快取最前段', prog.proLast < prog.total * 0.25, `第 ${prog.proLast + 1}/${prog.total} 項`);
  ok('十一章畫面都排在配樂鑑賞之前', Math.max(...prog.chLast) < prog.galleryFirst,
    `章節畫面到第 ${Math.max(...prog.chLast) + 1} 項,鑑賞曲從第 ${prog.galleryFirst + 1} 項起`);
  ok('各章畫面依章序遞增(不會第 9 章比第 2 章早)',
    prog.chLast.every((v, i) => i === 0 || v > prog.chLast[i - 1]), prog.chLast.join(','));
  ok('SW have 查詢答得出「缺哪些」', prog.haveMissing.length === 1 && prog.haveMissing[0].includes('__不存在__'),
    JSON.stringify(prog.haveMissing));

  // 離線包面板:沒有這個畫面就只能猜暖快取到底有沒有照順序鋪
  await page.evaluate(() => { closeAllWindows(); S = loadSave() || newState(); offlineModal(); });
  await page.waitForTimeout(1600);
  const pan = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.ocell')];
    return { n: cells.length, labels: cells.map(c => c.textContent).join(','),
      ok: cells.filter(c => c.classList.contains('ok')).length,
      bar: document.querySelector('.obar > i')?.style.width || '',
      txt: document.querySelector('.modal .sheet')?.textContent || '' };
  });
  ok('離線包面板列出序章 + 十一章', pan.n === 12 && pan.labels === '序,1,2,3,4,5,6,7,8,9,10,11', pan.labels);
  ok('離線包面板顯示整體進度與逐章狀態', /100%/.test(pan.txt) && pan.bar === '100%' && pan.ok === 12,
    `進度條 ${pan.bar}、完整 ${pan.ok}/12`);
  ok('離線包面板從設定進得去', await page.evaluate(() => {
    closeAllWindows(); settingsModal();
    return [...document.querySelectorAll('.mrow .mr-n')].some(x => x.textContent.includes('離線包'));
  }));
  await page.evaluate(() => closeAllWindows());
}

const dp = await ctx.newPage();   // 缺 ignoreSearch 的話,這頁斷網會開成遊戲
await dp.goto(BASE + 'design.html?utm_source=fb', { waitUntil: 'domcontentloaded' }).catch(() => {});
ok('斷網開 design.html?utm_source=fb 不會開成遊戲', (await dp.title()).includes('設計與公式站'));
await dp.close();
await ctx.setOffline(false);

// ---- 收尾 ----
ok('全程 console 零錯誤', errors.length === 0, errors.slice(0, 6).join(' | '));
await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通過 ===`);
if (failed.length) { console.log('未通過:', failed.map(r => r.name).join('、')); process.exit(1); }
console.log('全部通過。');
