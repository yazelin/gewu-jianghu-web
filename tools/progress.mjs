// 進度與收藏庫測試 — 擋住「按新案就把成就全部洗掉」和「選章跳回去好感亂掉」。
// 用法:node tools/progress.mjs   (自己起 server,不動工作區)
// 退出碼 0=全過,1=有失敗。
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import http from 'http';
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = (await import('/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright/index.js')).default); }

const ROOT = new URL('..', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'index.html';
  const f = join(ROOT, rel);
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const buf = readFileSync(f);
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream', 'content-length': buf.length });
  res.end(buf);
});
const PORT = 8106;
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}/`;

const results = [];
const ok = (name, pass, extra = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__gewuReady !== 'undefined' || !!document.querySelector('.gtitle'), { timeout: 20000 }).catch(() => {});

const SAVE = 'gewu_save_v1', CODEX = 'gewu_codex_v1';
const read = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, k);

// 造一份「玩到第 6 章、拿了幾個成就、看過一個結局」的存檔,並帶上各章快照
await page.evaluate(({ save }) => {
  const snap = (n, aff) => ({ schema: 1, scene: 'chapter', chapter: n, route: 'A', qishi: 1, qishi_max: 1,
    affinity: aff, evidence: {}, lost: {}, secured_order: {}, inventory: {}, choices: {},
    cleared: Array.from({ length: n - 1 }, (_, i) => i + 1), intro_seen: true, flags: { keeper_saved: true },
    rewarded: {}, normal_ending: '', finale_ending: '', romance: '', achievements: {},
    difficulty: '行俠', perfect: {}, grandmaster: {}, seen_normal: [], seen_finale: [] });
  const s = snap(6, { 柳照微: 3, 江濯月: 2 });
  s.achievements = { story_00_bell: true, story_01_workshop: true, story_02_river: true };
  s.seen_normal = ['people_witness'];
  s.perfect = { 1: true };
  s.equipped_title = '星下校時';
  s.checkpoints = { 1: snap(1, {}), 3: snap(3, { 柳照微: 1 }), 6: snap(6, { 柳照微: 3, 江濯月: 2 }) };
  localStorage.setItem(save, JSON.stringify(s));
}, { save: SAVE });

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);

// ---- 1) 開機把舊存檔的成就搬進收藏庫 ----
const codex = await read(CODEX);
ok('開機把舊存檔的成就/結局搬進收藏庫', !!codex && Object.keys(codex.achievements || {}).length === 3
  && (codex.seen_normal || []).includes('people_witness'), codex ? JSON.stringify(codex.seen_normal) : '無');

// ---- 2) 新案入局有確認視窗,且取消不會動到存檔 ----
await page.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.remove()); });
const newBtn = page.locator('button.btn', { hasText: '新案入局' }).first();
await newBtn.click();
await page.waitForTimeout(500);
const dialogText = await page.evaluate(() => document.querySelector('.modal .sheet')?.innerText || '');
ok('新案入局會先跳確認', /新案入局？/.test(dialogText) && /無法復原/.test(dialogText), dialogText.split('\n')[0] || '沒有視窗');
ok('確認視窗說明成就會保留', /成就.*保留/.test(dialogText.replace(/\s/g, '')), '');
await page.evaluate(() => [...document.querySelectorAll('.modal .btn')].find(b => b.textContent.includes('取消'))?.click());
await page.waitForTimeout(300);
ok('按取消不會動到存檔', ((await read(SAVE)) || {}).chapter === 6, '第 ' + ((await read(SAVE)) || {}).chapter + ' 章');

// ---- 3) 真的開新局:進度歸零,但成就/結局圖鑑保留 ----
await newBtn.click();
await page.waitForTimeout(400);
await page.evaluate(() => [...document.querySelectorAll('.modal .btn')].find(b => b.textContent.includes('開新局'))?.click());
await page.waitForTimeout(1500);
const after = await read(SAVE);
ok('新案後進度歸零', !!after && after.chapter === 1 && (after.cleared || []).length === 0,
  after ? `第 ${after.chapter} 章、已通關 ${(after.cleared || []).length} 章` : '無存檔');
ok('新案後成就仍在(這是收集全成就的關鍵)', !!after && Object.keys(after.achievements || {}).length === 3,
  after ? Object.keys(after.achievements || {}).join(',') : '');
ok('新案後結局圖鑑仍在', !!after && (after.seen_normal || []).includes('people_witness'));
ok('新案後 rewarded 有歸零(那是本局狀態,不該跨局)', !!after && Object.keys(after.rewarded || {}).length === 0);

// ---- 3b) 全面盤點:每一種「可收集」的東西都要活過新案 ----
// 這一項是規格,不是抽查:凡是玩家收集得到的,除非他自己清掉本機儲存,都不該因為開新局而消失。
await page.evaluate(({ save, codex }) => {
  localStorage.removeItem(codex);
  localStorage.setItem(save, JSON.stringify({
    schema: 1, scene: 'chapter', chapter: 9, route: 'A', qishi: 1, qishi_max: 1,
    affinity: { 柳照微: 4 }, evidence: {}, lost: {}, secured_order: {}, inventory: {}, choices: {},
    cleared: [1, 2, 3], intro_seen: true, flags: {}, rewarded: { reward_ch3: true },
    normal_ending: 'people_witness', finale_ending: '', romance: '柳照微',
    achievements: { story_00_bell: true, story_05_thunder: true, ending_all_normal: true, mastery_perfect_chapter: true },
    difficulty: '宗師', perfect: { 1: true, 2: true }, grandmaster: { 11: true },
    seen_normal: ['people_witness', 'archive_sealed'], seen_finale: ['heaven_earth_shared'],
    equipped_title: '星下校時',
  }));
}, { save: SAVE, codex: CODEX });
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1200);
const before = await read(SAVE);
await page.locator('button.btn', { hasText: '新案入局' }).first().click();
await page.waitForTimeout(400);
await page.evaluate(() => [...document.querySelectorAll('.modal .btn')].find(b => b.textContent.includes('開新局'))?.click());
await page.waitForTimeout(1500);
const kept = await read(SAVE);
const same = (f) => JSON.stringify((kept || {})[f]) === JSON.stringify((before || {})[f]);
[['achievements', '成就 30 條'], ['seen_normal', '結局圖鑑(普通)'], ['seen_finale', '結局圖鑑(完整版)'],
 ['perfect', '格物無漏紀錄'], ['grandmaster', '宗師難度紀錄'], ['equipped_title', '已佩用稱號']]
  .forEach(([f, label]) => ok(`新案後保留:${label}`, same(f), JSON.stringify((kept || {})[f])));
// 配樂沒有自己的解鎖紀錄,整個掛在成就上 —— 成就活著它就活著
ok('新案後保留:配樂解鎖(綁成就)', !!(kept && kept.achievements && kept.achievements.story_05_thunder));
// 反面:本局狀態該歸零,別把進度也一起留下來
[['cleared', '已通關章節'], ['rewarded', '本章獎勵已發'], ['affinity', '好感'], ['romance', '情緣']]
  .forEach(([f, label]) => ok(`新案後歸零:${label}`, !same(f), JSON.stringify((kept || {})[f])));

// ---- 4) 選章:沒通關過不給選 ----
await page.evaluate((k) => localStorage.removeItem(k), CODEX);
await page.evaluate((k) => {
  const s = JSON.parse(localStorage.getItem(k));
  s.seen_normal = []; s.seen_finale = []; localStorage.setItem(k, JSON.stringify(s));
}, SAVE);
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1000);
// 按不動時不能是「灰掉不講原因」——要說得出為什麼
await page.locator('button.btn', { hasText: '選章' }).first().click();
await page.waitForTimeout(400);
const gate1 = await page.evaluate(() => document.querySelector('.modal .sheet')?.innerText || '');
ok('沒通關過時,選章會說明原因而不是灰掉', /通關一次/.test(gate1), gate1.split('\n')[0] || '沒有視窗');
await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.remove()));

// 通關過但存檔沒有快照(更新前就存在的舊存檔)→ 要講清楚怎麼辦,不能只是按不動
await page.evaluate((k) => {
  const s = JSON.parse(localStorage.getItem(k)); s.seen_normal = ['people_witness']; delete s.checkpoints;
  localStorage.setItem(k, JSON.stringify(s));
}, SAVE);
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1000);
await page.locator('button.btn', { hasText: '選章' }).first().click();
await page.waitForTimeout(400);
const gate2 = await page.evaluate(() => document.querySelector('.modal .sheet')?.innerText || '');
ok('舊存檔(無快照)會解釋原因並給出路', /沒有章節快照/.test(gate2) && /重來本章/.test(gate2), gate2.split('\n')[0] || '沒有視窗');
await page.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.remove()));

// ---- 5) 通關過 + 有快照 → 選章回到該章當時的好感 ----
await page.evaluate(({ save, codex }) => {
  const snap = (n, aff) => ({ schema: 1, scene: 'chapter', chapter: n, route: 'A', qishi: 1, qishi_max: 1,
    affinity: aff, evidence: {}, lost: {}, secured_order: {}, inventory: {}, choices: {},
    cleared: Array.from({ length: n - 1 }, (_, i) => i + 1), intro_seen: true, flags: { keeper_saved: true },
    rewarded: {}, normal_ending: '', finale_ending: '', romance: '', achievements: {},
    difficulty: '行俠', perfect: {}, grandmaster: {}, seen_normal: [], seen_finale: [] });
  const s = snap(6, { 柳照微: 3, 江濯月: 2 });
  s.seen_normal = ['people_witness'];
  s.checkpoints = { 1: snap(1, {}), 3: snap(3, { 柳照微: 1 }), 6: snap(6, { 柳照微: 3, 江濯月: 2 }) };
  localStorage.setItem(save, JSON.stringify(s));
  localStorage.setItem(codex, JSON.stringify({ achievements: { story_00_bell: true }, seen_normal: ['people_witness'] }));
}, { save: SAVE, codex: CODEX });
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1200);
ok('通關過就能選章', !(await page.locator('button.btn', { hasText: '選章' }).first().isDisabled()));
await page.locator('button.btn', { hasText: '選章' }).first().click();
await page.waitForTimeout(500);
const list = await page.evaluate(() => [...document.querySelectorAll('.modal .btn.sm')].map(b => b.textContent.trim()));
ok('選章列出有快照的章節', list.length === 3 && list[0].includes('第 1 章') && list[2].includes('第 6 章'), list.join(' / '));
await page.evaluate(() => [...document.querySelectorAll('.modal .btn.sm')].find(b => b.textContent.includes('第 3 章'))?.click());
await page.waitForTimeout(1500);
const jumped = await read(SAVE);
ok('跳到第 3 章', !!jumped && jumped.chapter === 3, jumped ? '第 ' + jumped.chapter + ' 章' : '無');
ok('好感回到第 3 章當時(不是拿第 6 章的,也不是預設值)',
  !!jumped && JSON.stringify(jumped.affinity) === JSON.stringify({ 柳照微: 1 }), JSON.stringify(jumped && jumped.affinity));
ok('選章後結局圖鑑沒被洗掉', !!jumped && (jumped.seen_normal || []).includes('people_witness'));
ok('選章後快照還在(可以再跳別章)', !!jumped && Object.keys(jumped.checkpoints || {}).length === 3);

await browser.close(); srv.close();
const failed = results.filter(r => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通過 ===`);
if (failed.length) { console.log('未通過:', failed.map(r => r.name).join('、')); process.exit(1); }
console.log('全部通過。');
