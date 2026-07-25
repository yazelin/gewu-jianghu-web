'use strict';
// 格物江湖錄:天理殘卷 — 網頁引擎(資料驅動 / 離線)
// 舞台固定 1280×720 內部座標,等比縮放 —— 復現原作 Godot canvas_items+keep

const stage = document.getElementById('stage');
let G = null;   // 遊戲資料(game.json)
let S = null;   // 存檔狀態

// ---------- 縮放 ----------
function fit() {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.transform = `scale(${s})`;
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));

// ---------- 存檔 ----------
const SAVE_KEY = 'gewu_save_v1';
const newState = () => ({
  schema: 1, scene: 'title', chapter: 1, route: 'A',
  qishi: 1, qishi_max: 1, affinity: {},
  evidence: {}, lost: {}, secured_order: {},
  inventory: { ...(G.logic.start_inventory) }, choices: {}, cleared: [], intro_seen: false,
  flags: {}, rewarded: {}, normal_ending: '', finale_ending: '', romance: '', achievements: {},
  difficulty: '行俠', perfect: {}, grandmaster: {}, seen_normal: [], seen_finale: [],
});

// ---------- 音樂(按需 lazy 載入,缺檔靜音) ----------
// 曲目對應原作各章投卷/破局配樂;檔案為 CC0 原始來源重編(見 provenance)
const MUSIC = {
  ambient: 'oriental_calm', prologue: 'oriented_suspense',
  investigation: { 1: 'chapter1_workshop', 2: 'chapter2_river', 3: 'chapter3_ridge', 4: 'chapter4_forge',
    5: 'chapter5_thunder_alliance', 6: 'chapter6_observatory', 7: 'chapter7_mirror_city',
    8: 'chapter8_crafts_prison', 9: 'chapter9_tianli_bureau', 10: 'chapter10_nameless_institute', 11: 'chapter11_heaven_earth' },
  battle: { 1: 'chapter1_crisis', 2: 'asianoriental_battle', 3: 'chapter3_battle', 4: 'chapter4_battle',
    5: 'chapter5_battle', 6: 'chapter6_battle', 7: 'chapter4_battle', 8: 'chapter8_battle',
    9: 'asianoriental_battle', 10: 'chapter10_battle', 11: 'chapter11_battle' },
};
const MP3_TRACKS = new Set();   // 全部重編為 ogg
let _audio = null, _curTrack = '';
const isMuted = () => localStorage.getItem('gewu_muted') === '1';
function setMuted(v) { localStorage.setItem('gewu_muted', v ? '1' : '0'); if (_audio) _audio.muted = v; }
function playMusic(basename) {
  if (!basename) return;
  if (!_audio) { _audio = new Audio(); _audio.loop = true; _audio.volume = 0.5; }
  _audio.muted = isMuted();
  if (_curTrack !== basename) {                                 // 換曲才重設來源
    _curTrack = basename;
    _audio.src = `assets/audio/${basename}.${MP3_TRACKS.has(basename) ? 'mp3' : 'ogg'}`;
  }
  if (!isMuted()) _audio.play().catch(() => { });               // 每次都嘗試播(同曲也 resume);自動播放受限→靜默,等首次互動解鎖
}
// 首次使用者互動解鎖音訊(瀏覽器自動播放政策)
function initAudioUnlock() {
  const unlock = () => { if (_audio && !isMuted()) _audio.play().catch(() => { }); };
  ['pointerdown', 'click', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, unlock, { passive: true }));
}
// 使用者互動(任何 sfx)時順手喚醒背景樂,補足自動播放被擋的情況
function wakeMusic() { if (_audio && _audio.paused && !isMuted()) _audio.play().catch(() => { }); }
function sceneMusic(kind) {                                      // 依場景挑曲
  if (kind === 'battle') return playMusic(MUSIC.battle[S.chapter] || MUSIC.ambient);
  if (kind === 'investigation') return playMusic(MUSIC.investigation[S.chapter] || MUSIC.ambient);
  if (kind === 'prologue') return playMusic(MUSIC.prologue);
  return playMusic(MUSIC.ambient);
}
// ---------- 音效 SFX(短音、可重疊;檔案為原版 audio_service 同源 CC0,見 provenance)----------
// 一次性播放,受全域靜音控制;playbackRate=音高、volume=音量(對齊原版 play_sfx 參數)
function sfx(key, pitch = 1.0, volume = 0.6) {
  wakeMusic();                          // 使用者互動 → 順手喚醒被自動播放政策擋住的背景樂
  if (!key || isMuted()) return;
  const a = new Audio(`assets/audio/sfx/${key}.mp3`);
  a.volume = Math.max(0, Math.min(1, volume));
  a.playbackRate = pitch;
  a.play().catch(() => { });
}
// 各章 clue 專屬音效:1:1 還原原版 main.gd 的 _campaign_clue_sfx(依證物性質配木頭/紙張/鑼等)
function clueSfx(id) {
  const has = (...xs) => xs.includes(id);
  if (has('pulley', 'spring', 'ramp', 'brake', 'crate')) return has('pulley', 'brake') ? 'creak' : 'wood';
  if (has('register', 'false_bottom')) return 'paper';
  if (has('pennant', 'arrow_holes', 'range_rope', 'cart_arrow', 'arrowhead', 'crossbow_mount')) return has('cart_arrow', 'crossbow_mount') ? 'creak' : 'step_b';
  if (has('expansion_rods', 'bimetal', 'pressure_vessel', 'firebrick', 'cracked_blades')) return has('firebrick', 'cracked_blades') ? 'wood' : 'creak';
  if (id === 'ice_quench') return 'gong';
  if (has('series_lamps', 'parallel_branches', 'compass_coil', 'resistance_board', 'grounding_rod')) return has('compass_coil', 'grounding_rod') ? 'creak' : 'wood';
  if (id === 'amber_static') return 'paper';
  if (has('star_clock', 'orbit_stone', 'gravity_spheres', 'pendulum_frame')) return id === 'star_clock' ? 'gong' : 'creak';
  if (has('wave_basin', 'resonance_tubes')) return 'gong';
  return 'step_b';
}
// 全域靜音鈕(固定於畫面右上,任何場景都在)—— 內嵌 SVG 喇叭圖示
const SVG_SOUND_ON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16.5 8.5a4 4 0 010 7"/><path d="M19 6a7 7 0 010 12"/></svg>`;
const SVG_SOUND_OFF = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>`;
function initGlobalMute() {
  const b = document.getElementById('gmute');
  if (!b) return;
  const sync = () => { b.innerHTML = isMuted() ? SVG_SOUND_OFF : SVG_SOUND_ON; b.classList.toggle('muted', isMuted()); };
  b.onclick = () => { setMuted(!isMuted()); sync(); if (!isMuted() && _audio) _audio.play().catch(() => { }); };
  sync();
}

// ---------- 減少動態(還原原作 reduced_motion:停推鏡與裝飾動畫)----------
const isReduced = () => localStorage.getItem('gewu_reduced') === '1' ||
  (localStorage.getItem('gewu_reduced') === null && matchMedia('(prefers-reduced-motion: reduce)').matches);
function syncReduced() { document.body.classList.toggle('reduced', isReduced()); }
// ---------- 電影級雨幕 + 浮塵(概念參考原作 rain_overlay,獨立重製:三層景深 + 陣風 + 平均散佈)----------
function initWeather() {
  const cv = document.getElementById('rain');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  // 三層景深:遠(慢短暗細)→ 近(快長亮粗),視差營造縱深
  const LAYERS = [{ n: 55, vy: 430, len: 11, w: 0.7, a: 0.07 }, { n: 66, vy: 640, len: 17, w: 1.0, a: 0.11 }, { n: 56, vy: 900, len: 25, w: 1.5, a: 0.17 }];
  const rain = [];
  LAYERS.forEach((L, li) => { for (let k = 0; k < L.n; k++) rain.push({ L, li, k, x: (li * 313 + k * 197) % 1280, y: (li * 271 + k * 149) % 720 }); });
  const dust = Array.from({ length: 42 }, (_, i) => ({ x: (i * 331) % 1280, y: (i * 149) % 720, i }));
  let last = 0;
  const frame = (t) => {
    requestAnimationFrame(frame);
    ctx.clearRect(0, 0, 1280, 720);
    if (isReduced()) { last = t; return; }
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 0; last = t;
    const gust = 0.1 + 0.06 * Math.sin(t / 3400);            // 緩慢陣風,雨帶一致斜度
    for (const d of rain) {
      const L = d.L;
      d.y += dt * L.vy; d.x -= dt * L.vy * gust;
      if (d.y > 720 + L.len) { d.y = -L.len - (d.k % 7) * 12; d.x = ((d.k * 197 + d.li * 71 + (t * 0.05 | 0)) % 1340) - 30; }  // 回收平均散佈整幅頂邊
      ctx.strokeStyle = `rgba(176,208,232,${L.a})`;
      ctx.lineWidth = L.w; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - L.len * gust, d.y + L.len); ctx.stroke();
    }
    ctx.shadowColor = 'rgba(234,214,150,.6)';                  // 浮塵:緩慢上飄微擺 + 淡淡光暈
    for (const m of dust) {
      m.y -= dt * (6 + (m.i % 4) * 2); m.x += Math.sin((t / 1000 + m.i) * 0.5) * dt * 8;
      if (m.y < -8) { m.y = 728; m.x = (m.i * 331 + (t * 0.02 | 0)) % 1280; }
      const r = 1.6 + (m.i % 3) * 0.9;                         // 半徑放大些(1.6~3.4),有大有小
      ctx.shadowBlur = 4 + r * 1.7;                            // 越大越亮的柔光暈
      ctx.fillStyle = `rgba(224,206,150,${0.06 + (m.i % 3) * 0.03})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 6.283); ctx.fill();
    }
    ctx.shadowBlur = 0;                                        // 歸零,別讓光暈汙染下一幀雨絲
  };
  requestAnimationFrame(frame);
}
// 環境背景:把當前場景的背景圖模糊延伸到兩側黑邊(手機橫玩更沉浸)
function initAmbient() {
  const amb = document.getElementById('ambient');
  if (!amb) return;
  let last = '';
  const update = () => {
    const bgs = stage.querySelectorAll('.bg');
    const bg = bgs[bgs.length - 1];              // 取最上層 layer 的背景
    const img = bg && bg.style.backgroundImage;
    if (img && img !== last) { last = img; amb.style.backgroundImage = img; }
  };
  new MutationObserver(update).observe(stage, { childList: true, subtree: true });
  update();
}

// PWA 安裝鈕(桌面/Android 觸發原生安裝;iOS 顯示加入主畫面教學;已安裝則隱藏)
function initPWAInstall() {
  const b = document.getElementById('ginstall');
  if (!b) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) { b.hidden = true; return; }        // 已安裝
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    b.hidden = false;
    b.onclick = () => toast('在瀏覽器分享選單選「加入主畫面」即可安裝');
    return;
  }
  if (window.__deferredInstall) b.hidden = false;      // 已符合安裝條件
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__deferredInstall = e; b.hidden = false; });
  addEventListener('appinstalled', () => { b.hidden = true; window.__deferredInstall = null; installedHint(); });
  b.onclick = async () => {
    const d = window.__deferredInstall;
    if (!d) { toast('請用瀏覽器選單的「安裝／加到主畫面」'); return; }
    d.prompt();
    const choice = await d.userChoice.catch(() => ({}));
    window.__deferredInstall = null; b.hidden = true;
    if (choice && choice.outcome === 'accepted') installedHint();   // 瀏覽器無法自動喚起 App,明確引導改用主畫面圖示
  };
}
// 安裝完成後的常駐引導:網頁無法自動切到 App,提醒改從主畫面圖示開啟
function installedHint() {
  if (document.getElementById('installed-hint')) return;
  const h = el(`<div id="installed-hint">
    <b>安裝完成</b>
    <span>接下來請回<b>主畫面點「格物江湖錄」圖示</b>開啟——那是全螢幕橫式的離線版，不必再用瀏覽器分頁。</span>
    <button class="btn sm">知道了</button></div>`);
  h.querySelector('button').onclick = () => h.remove();
  document.body.appendChild(h);
}
// 鑑賞曲目 id → 音檔(部分曲目共用同一首 CC0 來源)
const GALLERY_FILE = {
  calm: 'oriental_calm', suspense: 'oriented_suspense',
  chapter1: 'chapter1_workshop', chapter2: 'chapter2_river', chapter3: 'chapter3_ridge',
  chapter4: 'chapter4_forge', chapter5: 'chapter5_thunder_alliance', chapter6: 'chapter5_thunder_alliance',
  chapter7: 'chapter7_mirror_city', chapter8: 'chapter8_crafts_prison', chapter9: 'chapter9_tianli_bureau',
  chapter10: 'chapter10_nameless_institute', chapter11: 'chapter11_heaven_earth',
  chapter9_ending: 'chapter9_ending', chapter11_ending: 'chapter9_ending',
};
function musicGallery() {
  sfx('paper', 1.0, 0.5);
  const { content } = boardScroll(860, 620, '配樂鑑賞', '點曲目即可試聽（需先以右上 ♪ 開啟聲音）');
  const setPlaying = (id) => content.querySelectorAll('[data-mid]').forEach(r =>
    r.querySelector('.mplay').textContent = (r.dataset.mid === id ? '❚❚' : '▶'));
  G.achievements.music_gallery.forEach(mm => {
    const unlocked = !mm.unlock || S.achievements[mm.unlock];
    const row = el(`<div class="prow${unlocked ? ' play' : ' locked'}" data-mid="${mm.id}">
      <span class="mplay">${unlocked ? '▶' : '·'}</span>
      <span class="prow-t">${unlocked ? esc(mm.title) : '未解鎖曲目'}</span>
      <span class="prow-d">${esc(mm.source_title)}</span></div>`);
    if (unlocked) row.onclick = () => {
      const file = GALLERY_FILE[mm.id];
      if (_curTrack === file && _audio && !_audio.paused) { _audio.pause(); setPlaying(''); return; }  // 再點=暫停
      if (isMuted()) { setMuted(false); initGlobalMute(); }     // 試聽自動開聲
      playMusic(file); setPlaying(mm.id);
    };
    content.appendChild(row);
  });
  if (_audio && !_audio.paused) {                               // 標示目前正在播的曲目
    const curId = Object.keys(GALLERY_FILE).find(k => GALLERY_FILE[k] === _curTrack);
    if (curId) setPlaying(curId);
  }
}

// ---------- 難度提示(逐字還原三檔) ----------
const DIFF_HINT = {
  '說書': '說書提示｜先找題目給定的量與單位，再從格物卷比對同類現象。',
  '行俠': '行俠提示｜可按格物卷，比對本章已收錄的證據。',
  '宗師': '宗師規則｜先判斷模型與單位，再計算；答錯仍會留下劇情後果。',
};
const diffHintHTML = () => `<div class="concept" style="margin:.3rem 0 .6rem;color:var(--pa2)">${esc(DIFF_HINT[S.difficulty] || DIFF_HINT['行俠'])}</div>`;

// ---------- world_flags / 路線 ----------
function setFlags(list) { (list || []).forEach(f => { if (f) S.flags[f] = true; }); }
function routeFor(n) {
  const cond = G.logic.route_table[String(n)];
  if (!cond) return 'A';
  const test = (f) => f.startsWith('ending:') ? S.normal_ending === f.slice(7)
    : f.startsWith('seal:') ? !!sealSnapshot()[f.slice(5)] : !!S.flags[f];
  if (cond.all) return cond.all.every(test) ? 'A' : 'B';
  if (cond.any) return cond.any.some(test) ? 'A' : 'B';
  return 'A';
}
// ---------- 道具 ----------
function addItem(id, n = 1) { S.inventory[id] = (S.inventory[id] || 0) + n; }
function useItem(id) { if (S.inventory[id] > 0) { S.inventory[id]--; return true; } return false; }
function grantChapterRewards(secured) {
  const key = 'reward_ch' + S.chapter;
  if (S.rewarded[key]) return [];
  S.rewarded[key] = true;
  const r = G.logic.reward_rule, got = [];
  const give = (id) => { addItem(id); got.push(G.items[id].name); };
  give(r.always);
  if (secured >= 5) give(r.ev5);
  if (secured >= 6) { if (S.qishi_max < G.max_qishi) S.qishi_max++; give(r.ev6); }
  return got;
}
const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(S));
const loadSave = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } };
const hasSave = () => !!localStorage.getItem(SAVE_KEY);

// ---------- 工具 ----------
const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const PERSIST = new Set(['chrome', 'rain', 'lamp', 'book', 'fade']);   // 雨幕/燈火/書光/黑幕/UI 跨場景保留,不隨 clear 移除
const clear = () => {
  const l = document.getElementById('lamp'); if (l) l.classList.remove('on');   // 燈火呼吸只在題名
  document.getElementById('book')?.classList.remove('on');                       // 書光呼吸只在題名
  [...stage.children].forEach(c => { if (!PERSIST.has(c.id)) c.remove(); });
};
const preload = (list) => Promise.all([...new Set(list)].map(src => new Promise(r => {
  const i = new Image(); i.onload = i.onerror = r; i.src = src;
})));
const chById = (n) => G.chapters.find(c => c.id === n);
const ckey = () => 'ch' + S.chapter;
function affinity(name, d) { if (!name) return; S.affinity[name] = Math.max(-5, Math.min(5, (S.affinity[name] || 0) + d)); }
function toast(msg) {
  const t = el(`<div class="toast">${esc(msg)}</div>`); stage.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ---------- 社群分享 ----------
const SHARE_URL = 'https://yazelin.github.io/gewu-jianghu-web/';
async function shareContent(text, imageUrl) {
  const data = { title: '格物江湖錄:天理殘卷', text: text + '\n' + SHARE_URL, url: SHARE_URL };
  try {
    if (imageUrl && navigator.canShare) {          // 優先連圖一起分享(手機原生分享單)
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], 'gewu.webp', { type: blob.type });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ ...data, files: [file] }); return; }
    }
    if (navigator.share) { await navigator.share(data); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + '\n' + SHARE_URL); toast('已複製分享連結'); }
  catch (e) { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`, '_blank'); }
}
function shareBtn(label, text, imageUrl) {
  const b = el(`<button class="btn sm ghost">${esc(label)}</button>`);
  b.onclick = () => shareContent(text, imageUrl);
  return b;
}

// ---------- 場景路由 ----------
// 題名為暫時畫面,不寫入存檔的 scene(否則「繼續」會停在題名);其餘場景照存
function go(scene) {
  S.scene = scene; if (scene !== 'title') save();
  const f = document.getElementById('fade');
  if (!f || isReduced()) return render();               // dip-to-black 場景轉場(電影感)
  f.classList.add('on');
  setTimeout(() => { render(); requestAnimationFrame(() => f.classList.remove('on')); }, 330);
}
function render() {
  clear();
  const menu = document.getElementById('gmenu');
  if (menu) menu.hidden = (S.scene === 'title');    // 題名頁不顯示選單
  ({
    title: sTitle, intro: sIntro, prologue: sPrologue, chapter: sChapter,
  }[S.scene] || sTitle)();
}

// 遊戲中選單:回題名(進度保留)/ 重來本章
function initMenu() {
  const b = document.getElementById('gmenu');
  if (!b) return;
  b.onclick = () => {
    const m = el(`<div class="modal"><div class="sheet" style="max-width:420px;text-align:center">
      <h2 style="border:0">選單</h2></div></div>`);
    const sheet = m.querySelector('.sheet');
    const mk = (label, fn) => { const x = el(`<button class="btn" style="margin:.4rem">${label}</button>`); x.onclick = () => { m.remove(); fn(); }; sheet.appendChild(x); };
    mk('繼續遊戲', () => { });
    if (S.scene === 'chapter') mk('重來本章', () => { S.evidence[ckey()] = []; S.lost[ckey()] = []; delete S.rewarded['reward_ch' + S.chapter]; go('chapter'); });
    mk('回題名', () => go('title'));      // 題名可「開新局」重玩或「繼續」
    mk(isReduced() ? '動態效果：關（點擊開啟）' : '動態效果：開（點擊關閉）', () => {
      localStorage.setItem('gewu_reduced', isReduced() ? '0' : '1'); syncReduced();
    });
    m.onclick = (e) => { if (e.target === m) m.remove(); };
    stage.appendChild(m);
  };
}

// ================= 題名頁 =================
function sTitle() {
  playMusic(MUSIC.ambient);
  const bg = el(`<div class="layer fade"></div>`);
  bg.appendChild(el(`<div class="bg" style="background-image:url('${G.title_keyart}');filter:brightness(.7)"></div>`));
  bg.appendChild(el(`<div class="scrim"></div>`));
  // 置中上緣:與底部連結列對稱(海報上下框)
  const kicker = el(`<div class="t-kicker">原創武俠物理解謎 RPG</div>`);
  // 上左:標題組(整體偏上)
  const top = el(`<div class="t-top">
    <div class="gtitle">格物江湖錄</div>
    <div class="gsub">天 理 殘 卷</div>
    <div class="tomen">巨鐘未落，真相已先被定罪。</div>
  </div>`);
  // 心法(難度):三檔以提示詳略區分,用武俠語言(還原原作三心法:說書/行俠/宗師)
  // 心法(難度):平時收合成一顆 chip(與安裝同大小),點擊才展開三檔切換;說明只在展開時出現(全形標點)
  const DIFFS = [['說書', '說書人循循道來，提示最詳盡'], ['行俠', '行俠仗劍，提示適中，可隨時翻閱格物卷'], ['宗師', '宗師只點模型與方向，獨闖險關']];
  const diff = { val: '行俠' };
  const diffWrap = el(`<div class="tseg-wrap t-diff"></div>`);
  const dToggle = el(`<button class="tseg-toggle">心法 · <b>行俠</b><span class="caret">▾</span></button>`);
  const dPop = el(`<div class="tpop"></div>`);
  const seg = el(`<div class="tseg"></div>`);
  const desc = el(`<div class="tseg-desc"></div>`);
  const closeDiff = () => { dPop.classList.remove('open'); dToggle.classList.remove('open'); };
  DIFFS.forEach(([v, d]) => {
    const p = el(`<button class="tseg-btn${v === diff.val ? ' on' : ''}">${v}</button>`);
    p.onclick = () => {
      diff.val = v;
      seg.querySelectorAll('.tseg-btn').forEach(x => x.classList.remove('on')); p.classList.add('on');
      desc.textContent = d; dToggle.querySelector('b').textContent = v; sfx('paper', 1.1, 0.3);
      // 不立刻收合:讓玩家可切換各檔比較說明;點 chip 收合鈕或點空白處才收起
    };
    seg.appendChild(p);
  });
  desc.textContent = DIFFS.find(x => x[0] === diff.val)[1];   // 預設說明(僅展開時可見)
  dPop.append(seg, desc);
  dToggle.onclick = () => { const open = !dPop.classList.contains('open'); dPop.classList.toggle('open', open); dToggle.classList.toggle('open', open); if (open) sfx('paper', 1.0, 0.25); };
  diffWrap.append(dToggle, dPop);
  const bNew = el(`<button class="btn">新案入局</button>`);
  bNew.onclick = () => { S = newState(); S.difficulty = diff.val; sfx('door'); go('intro'); };
  // 下左:只留氛圍文案(標語 + 路線)
  const bottom = el(`<div class="t-bottom"></div>`);
  bottom.append(
    el(`<div class="ttag">看懂世界如何運作，才有資格改變命運。</div>`),
    el(`<div class="troute">十一章懸案｜雙走向承接｜多重結局｜三線情緣</div>`));
  const savedTitle = (loadSave() || {}).equipped_title;      // 佩印稱號(讀存檔)
  if (savedTitle && savedTitle !== DEFAULT_TITLE) bottom.append(el(`<div class="ttitle">佩印稱號｜${esc(savedTitle)}</div>`));
  // 右下角:只放新案入局 + 繼續
  const bCont = el(`<button class="btn ghost">繼續</button>`);
  bCont.disabled = !hasSave();
  bCont.onclick = () => { S = loadSave() || newState(); render(); };
  const right = el(`<div class="t-right"></div>`);
  right.append(bNew, bCont);
  bg.append(kicker, top, bottom, diffWrap, right);   // 心法 diffWrap 置頂端右側(t-diff)
  bg.addEventListener('click', (ev) => { if (!diffWrap.contains(ev.target)) closeDiff(); });   // 點空白處收合心法
  // 次要選項:退為畫面底部一列低調文字連結,保留電影感(不佔主畫面按鈕堆)
  const withSave = (fn) => { const prev = S; S = loadSave() || newState(); fn(); S = prev; };
  const menu = el(`<div class="tmenu"></div>`);
  const mlink = (label, fn, needSave) => { const x = el(`<button>${label}</button>`); if (needSave) x.disabled = !hasSave(); x.onclick = fn; return x; };
  const items = [
    mlink('江湖成就譜', () => withSave(achievementCodex), true),
    mlink('結局圖鑑', () => withSave(endingGallery), true),
    mlink('配樂鑑賞', () => withSave(musicGallery), true),
    mlink('格物先賢譜', () => scientistAtlas()),
    mlink('劇情前導', () => replayIntro()),
    mlink('分享', () => shareContent('武俠懸疑包裝的物理解謎 RPG——《格物江湖錄:天理殘卷》，可離線遊玩。', G.title_keyart)),
    mlink('素材與製作名錄', () => creditsPanel()),      // 併入同一排(分享右邊),不再孤立於角落
  ];
  items.forEach((it, i) => { if (i) menu.appendChild(el(`<span class="sep">·</span>`)); menu.appendChild(it); });
  bg.appendChild(menu);
  stage.appendChild(bg);
  document.getElementById('lamp')?.classList.add('on');           // 雨夜鐘樓燈火呼吸
  document.getElementById('book')?.classList.add('on');           // 格物書呼吸暖金光
  [kicker, ...top.children, ...bottom.children, diffWrap, ...right.children].forEach((n, i) => { n.classList.add('slide-in'); n.style.animationDelay = (0.05 + i * 0.08) + 's'; });   // 進場動畫
}


// ================= 電影式序引(4 幕) =================
let introReplay = false;                          // 從題名「重看序引」進入 → 播完回題名,不開局
function replayIntro() { introReplay = true; sIntro(); }
function sIntro() {
  let i = 0;
  const pages = G.story_intro;
  const KB = ['kbA', 'kbB', 'kbC', 'kbD'];         // 每幕不同景深運鏡
  const finish = () => { if (introReplay) { introReplay = false; go('title'); } else { S.intro_seen = true; go('prologue'); } };
  const show = () => {
    const p = pages[i];
    // 每幕:Ken Burns 背景 + 字幕分層進場;交叉溶接(不 clear,舊幕淡出移除)
    const lay = el(`<div class="cine-scene">
      <div class="bg ${KB[i % 4]}" style="background-image:url('${p.image}');filter:brightness(.62)"></div>
      <div class="scrim"></div>
      <div class="cine-txt">
        <div class="intro-eyebrow ci-a">${esc(p.eyebrow)}</div>
        <div class="intro-title ci-b">${esc(p.title)}</div>
        <div class="intro-text ci-c">${esc(p.text)}</div>
        <div class="ci-idx ci-c">${i + 1} ／ ${pages.length}</div>
      </div></div>`);
    const nav = el(`<div class="cine-nav"></div>`);
    const prev = el(`<button class="btn sm ghost">上一幕</button>`); prev.disabled = i === 0;
    prev.onclick = () => { i--; show(); };
    const next = el(`<button class="btn sm">${i < pages.length - 1 ? '下一幕 ▸' : (introReplay ? '回題名' : '入局 ▸')}</button>`);
    next.onclick = () => { i < pages.length - 1 ? (i++, show()) : finish(); };
    const skip = el(`<button class="btn sm ghost">略過</button>`);
    skip.onclick = finish;
    nav.append(prev, next, skip);
    const olds = [...stage.querySelectorAll('.cine-scene,.cine-nav')];
    stage.append(lay, nav);
    requestAnimationFrame(() => { lay.classList.add('in'); nav.classList.add('in'); });
    olds.forEach(o => { o.classList.add('out'); setTimeout(() => o.remove(), 950); });
  };
  clear();
  stage.appendChild(el(`<div class="cine"><div class="vig"></div></div>`));   // letterbox + 暈影(整段序引持久)
  playMusic(MUSIC.prologue);
  preload(pages.map(p => p.image)).then(show);
}

// ================= 對白播放器 =================
// lines:[{speaker,text}], choice:{at,prompt,options} 選項後套用 affinity。done() 收尾。
function playDialogue(bgUrl, lines, choice, done) {
  let i = 0, choiceShown = false;
  // 抉擇的 at 夾到對白長度:超出時接在最後一句之後(原作行為)
  const choiceAt = choice ? Math.min(choice.at, lines.length) : -1;
  clear();                       // 每段對白為整屏場景,先清掉上一段的 layer
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${bgUrl}')"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const port = el(`<img class="portrait" alt="">`);      // 忠實還原原版:對話時依發話者顯示大立繪卡
  lay.appendChild(port);
  stage.appendChild(lay);
  let curSpeaker = '';
  const showPortrait = (name) => {
    const src = name && G.portraits[name];
    if (src) { if (name !== curSpeaker) port.src = src; port.classList.add('show'); }
    else port.classList.remove('show');
    curSpeaker = name || '';
  };
  const step = () => {
    if (choice && !choiceShown && i === choiceAt) { choiceShown = true; return askChoice(); }
    if (i >= lines.length) return done();
    const l = lines[i++];
    lay.querySelectorAll('.dbox').forEach(n => n.remove());
    showPortrait(l.speaker);
    const box = el(`<div class="dbox${G.portraits[l.speaker] ? ' has-portrait' : ''}">
      ${l.speaker ? `<div class="spk">${esc(l.speaker)}</div>` : ''}
      <div class="txt">${esc(l.text)}</div>
      <div class="next">點擊繼續 ▾</div></div>`);
    box.onclick = step;
    lay.appendChild(box);
  };
  const askChoice = () => {
    lay.querySelectorAll('.dbox').forEach(n => n.remove());   // 移除背後可點的對話框,避免點到就跳過抉擇
    const cb = el(`<div class="choicebox"><div class="prompt">${esc(choice.prompt)}</div></div>`);
    choice.options.forEach(o => {
      const b = el(`<button class="choice"><b>${esc(o.text)}</b>
        <span class="tag">${esc(o.relationship || '')} ${o.delta >= 0 ? '+' : ''}${o.delta || ''}</span></button>`);
      b.onclick = () => { affinity(o.relationship, o.delta || 0); if (o.flag) setFlags([o.flag]); S.choices['dlg' + S.chapter] = o.id; cb.remove(); step(); };
      cb.appendChild(b);
    });
    stage.appendChild(cb);
  };
  step();
}

// ================= 序章 =================
function sPrologue() {
  const p = G.prologue;
  preload([p.background, ...p.hotspots.map(h => h.cell)]).then(() => {
    playDialogue(p.background, p.narration, p.choice, () => investigate({
      key: 'prologue', background: p.background, title: '序章・鐘樓墜案',
      clues: p.hotspots, min: 3, failable: true, onFail: prologueFailure,
      onDone: prologueBattle,        // 調查後 → 序章破局(3 選 + 滑桿)→ 章末抉擇 → 序章結局
    }));
  });
}

// ========== 序章破局(3 選 + 滑桿估算)+ 章末抉擇(救人/追兇)+ 序章結局 ==========
function prologueBattle() {
  const p = G.prologue, total = p.battle.length + 1;   // 3 選擇 + 1 滑桿(還原原作 4 phase)
  S.qishi = S.qishi_max; S._battleCorrect = 0; S.wrong_answers = 0;
  playMusic('asianoriental_battle'); sfx('gong', 0.7, 0.8);
  const run = (phase) => {
    if (phase >= total) return prologueFinalChoice();
    clear();
    const lay = el(`<div class="layer fade"></div>`);
    lay.append(el(`<div class="bg" style="background-image:url('${p.background}');filter:brightness(.45)"></div>`), el(`<div class="scrim"></div>`));
    const q = el(`<div class="qishi"></div>`);
    const renderQishi = () => { q.innerHTML = ''; for (let k = 0; k < S.qishi_max; k++) q.appendChild(el(`<div class="pip ${k < S.qishi ? 'on' : ''}"></div>`)); };
    renderQishi();
    const bInv = el(`<button class="util">行囊</button>`); bInv.onclick = () => inventoryModal(() => renderQishi());
    const bScroll = el(`<button class="util">格物卷</button>`); bScroll.onclick = () => evidenceModal('prologue', p.hotspots);   // 答題時可翻閱已收錄證據(還原原作,兌現行俠/說書提示)
    const bar = el(`<div class="topbar"></div>`);
    bar.append(el(`<div class="chip">破局 ${phase + 1}／${total}</div>`), el(`<div class="spacer"></div>`), bScroll, bInv, el(`<div class="chip">氣勢</div>`), q);
    lay.appendChild(bar);
    const panel = el(`<div class="choicebox"></div>`);
    // 對/錯結算:氣勢扣減 → 定心符自動保命 → 潰散則失敗(還原 _apply_qishi_damage/_resolve_battle)
    const resolve = (ok, explanation) => {
      if (ok) { S._battleCorrect++; sfx('correct', 0.92 + phase * 0.04, 0.9); }
      else {
        S.wrong_answers++; sfx('gong', 0.72, 0.8); S.qishi--;
        if (S.qishi <= 0 && (S.inventory.steadfast_talisman || 0) > 0) { useItem('steadfast_talisman'); S.qishi = 1; S.flags.talisman_used = true; explanation += '\n定心符在氣勢潰散前自行燃起，替你守住最後 1 點氣勢。'; }
        renderQishi();
      }
      panel.appendChild(el(`<div class="result ${ok ? 'ok' : 'bad'}" style="margin-top:12px">${esc(explanation)}</div>`));
      const dead = S.qishi <= 0;
      const nx = el(`<button class="btn sm" style="margin-top:14px">${dead ? '——' : (phase + 1 >= total ? '決定此案後果 ▸' : '進入下一式 ▸')}</button>`);
      nx.onclick = () => { if (dead) return prologueFailure(); save(); run(phase + 1); };
      panel.appendChild(nx); save();
    };
    if (phase < p.battle.length) {         // 選擇題
      const b = p.battle[phase];
      panel.innerHTML = `<div style="color:var(--br);letter-spacing:.2em;margin-bottom:.6rem">${esc(b.title)}</div>
        <div class="body" style="font-size:1.05rem;line-height:1.9;margin-bottom:.8rem">${esc(b.body)}</div>
        <div class="q" style="font-size:1.2rem;margin-bottom:.5rem">${esc(b.prompt)}</div>${diffHintHTML()}`;
      const wrap = el(`<div></div>`);
      b.options.forEach((o, idx) => {
        const btn = el(`<button class="opt">${esc(o)}</button>`);
        btn.onclick = () => {
          [...wrap.querySelectorAll('.opt')].forEach(x => x.disabled = true);
          const ok = idx === b.correct; btn.classList.add(ok ? 'correct' : 'wrong');
          if (!ok) wrap.querySelectorAll('.opt')[b.correct].classList.add('correct');
          resolve(ok, b.explanation);
        };
        wrap.appendChild(btn);
      });
      panel.appendChild(wrap);
    } else {                                // 滑桿估算題(拖石鎮布置反向力矩)
      const s = p.slider;
      panel.innerHTML = `<div style="color:var(--br);letter-spacing:.2em;margin-bottom:.6rem">${esc(s.title)}</div>
        <div class="body" style="font-size:1.05rem;line-height:1.9;margin-bottom:.8rem">${esc(s.body)}</div>
        <div class="q" style="font-size:1.15rem;margin-bottom:.6rem">${esc(s.prompt)}</div>`;
      const val = el(`<div style="text-align:center;color:var(--steel);font-size:1.2rem;letter-spacing:.05em;margin:.6rem 0">支點距離：${s.value.toFixed(1)} m｜反向力矩：${Math.round(s.factor * s.value)} N·m</div>`);
      const range = el(`<input type="range" class="pslider" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.value}">`);
      range.oninput = () => { const v = +range.value; val.textContent = `支點距離：${v.toFixed(1)} m｜反向力矩：${Math.round(s.factor * v)} N·m`; };
      const lock = el(`<button class="btn" style="margin-top:8px">鎖定石鎮並驗證</button>`);
      lock.onclick = () => {
        const v = +range.value; range.disabled = true; lock.disabled = true;
        resolve(v >= s.threshold, `石鎮力矩＝300×10×${v.toFixed(1)}＝${Math.round(s.factor * v)} N·m；至少 ${s.threshold} m 才能達到 ${s.target} N·m。`);
      };
      panel.append(val, range, lock);
    }
    lay.appendChild(panel); stage.appendChild(lay);
  };
  run(0);
}
// 章末抉擇:救人 / 追兇(還原 show_final_choice / _choose_final)
function prologueFinalChoice() {
  const fc = G.prologue.final_choice;
  clear(); playMusic(MUSIC.prologue);
  const lay = el(`<div class="layer fade"></div>`);
  lay.append(el(`<div class="bg" style="background-image:url('${G.prologue.background}');filter:brightness(.5)"></div>`), el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox">
    <div style="color:var(--br);letter-spacing:.2em;font-size:1.3rem">${esc(fc.banner[0])}</div>
    <div style="color:var(--pa2);margin:.3rem 0 1rem">${esc(fc.banner[1])}</div>
    <div class="body" style="font-size:1.1rem;line-height:1.9;margin-bottom:1.1rem;white-space:pre-line">${esc(fc.body)}</div></div>`);
  fc.options.forEach(o => {
    const b = el(`<button class="choice"><b>${esc(o.text)}</b></button>`);
    b.onclick = () => { sfx('paper', 1.0, 0.5); affinity(o.rel, o.delta); prologueResolve(o.id); };
    box.appendChild(b);
  });
  box.appendChild(el(`<div style="color:var(--pa2);font-size:.85rem;margin-top:.9rem">${esc(fc.note)}</div>`));
  lay.appendChild(box); stage.appendChild(lay);
}
// 依抉擇 + 案情強度算 world_flags/結局(還原 _choose_final:第一章路線由此定)
function prologueResolve(choice) {
  const insight = (S.evidence.prologue || []).length, lizheng = S._battleCorrect || 0;
  S.insight = insight;
  const strong = lizheng >= 3 && insight >= 3;
  const ending = !strong ? 'doubt' : (choice === 'rescue' ? 'saved' : 'trail');
  if (ending === 'saved') setFlags(['keeper_saved']);      // 救人且案情強 → 章1 A 線
  if (ending === 'trail') setFlags(['copper_seal']);       // 追兇且案情強 → 章1 B 線(半枚銅印)
  if (strong) setFlags(['prologue_case_strong']);
  S.prologue_ending = ending; S.choices.prologue = choice;
  if (!S.cleared.includes(0)) S.cleared.push(0);
  reconcile(); save();
  prologueEnding(ending, lizheng, insight);
}
// 序章結局畫面(鐘止人存/雨痕追兇/殘鐘疑雲,還原 show_ending)
function prologueEnding(ending, lizheng, insight) {
  const e = G.prologue.endings[ending];
  clear(); playMusic(MUSIC.ambient);
  const lay = el(`<div class="layer fade"></div>`);
  lay.append(el(`<div class="bg" style="background-image:url('${G.prologue.background}');filter:brightness(.5)"></div>`), el(`<div class="scrim"></div>`));
  lay.appendChild(el(`<div style="position:absolute;left:80px;right:80px;top:56px">
    <div class="intro-eyebrow">序章結局</div>
    <div class="intro-title" style="max-width:92%">${esc(e.title)}</div>
    <div class="intro-text" style="max-width:86%;font-size:1.08rem;max-height:150px;overflow:auto">${esc(e.text)}</div>
    <div class="reveal" style="margin-top:1rem;max-width:82%"><span class="spk">章末後續</span>　${esc(e.followup)}</div>
    <div style="margin-top:1rem;color:var(--pa2);letter-spacing:.05em">理證 ${lizheng}／4　洞察 ${insight}／6　失手 ${S.wrong_answers || 0}</div>
  </div>`));
  const row = el(`<div style="position:absolute;right:60px;bottom:48px;display:flex;gap:12px;align-items:center"></div>`);
  row.appendChild(shareBtn('分享', `我在《格物江湖錄:天理殘卷》序章走到了「${e.title}」`, G.prologue.background));
  const cont = el(`<button class="btn">進入第一章・殘軸工坊 ▸</button>`);
  cont.onclick = () => { sfx('door'); go('chapter'); };
  row.appendChild(cont); lay.appendChild(row); stage.appendChild(lay);
}

// ================= 章節 =================
function sChapter() {
  const c = chById(S.chapter);
  if (!c) return endGameStub();
  S.route = routeFor(S.chapter);       // 依 world_flags 決定本章 A/B 線
  const imgs = [c.background, ...c.clues.map(cl => cl.cell)];
  stage.appendChild(el(`<div class="loading">載入 ${esc(c.title)}…</div>`));
  preload(imgs).then(() => {
    clear();
    // 章名卡
    const card = el(`<div class="layer fade" style="display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div class="bg" style="background-image:url('${c.background}');filter:brightness(.4)"></div>
      <div class="scrim"></div>
      <div style="position:relative;text-align:center">
        <div style="color:var(--br);letter-spacing:.3em;margin-bottom:1rem">${esc(c.location)}</div>
        <div class="gtitle" style="font-size:3rem">${esc(c.title)}</div>
        <div class="gsub" style="font-size:1.15rem;margin-top:1rem">${esc(c.subtitle)}</div>
        ${c.goal ? `<div style="color:var(--pa2);margin-top:1.5rem;max-width:640px">本章目標｜${esc(c.goal)}</div>` : ''}
      </div></div>`);
    card.onclick = () => chapterIntro(c);
    card.appendChild(el(`<div class="next" style="position:absolute;right:40px;bottom:40px;color:var(--br)">點擊開始 ▾</div>`));
    stage.appendChild(card);
  });
}

function chapterIntro(c) {
  const intro = S.route === 'B' ? c.route_b_intro : c.route_a_intro;
  const common = c.common_dialogue;
  playDialogue(c.background, intro, null, () =>
    playDialogue(c.background, common, c.dialogue_choice, () =>
      investigate({
        key: ckey(), background: c.background, title: c.title,
        clues: c.clues, min: c.min_evidence, failable: true,
        onDone: () => battle(c),
      })));
}

// ================= 調查(證據 / 序章熱點) =================
function investigate({ key, background, title, clues, min, onDone, failable, onFail }) {
  S.evidence[key] = S.evidence[key] || [];
  S.lost[key] = S.lost[key] || [];
  sceneMusic(key === 'prologue' ? 'prologue' : 'investigation');
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${background}')"></div>`));
  lay.appendChild(el(`<div class="scrim" style="background:rgba(10,8,6,.25)"></div>`));
  stage.appendChild(lay);
  // 點背景空白處 → 收起面板
  lay.addEventListener('click', (e) => {
    if (e.target.classList.contains('bg') || e.target.classList.contains('scrim'))
      lay.querySelectorAll('.panel').forEach(closePanel);
  });

  const bar = el(`<div class="topbar"></div>`);
  const evChip = el(`<div class="chip">證據 <b class="cnt">0</b> / ${min}</div>`);
  const hintChip = el(`<div class="chip" style="color:var(--br)"></div>`);
  bar.append(el(`<div class="chip">${esc(title)}</div>`), evChip, hintChip, el(`<div class="spacer"></div>`));
  const bAff = el(`<button class="util">好感</button>`);
  bAff.onclick = () => affinityBoard();
  const bInv = el(`<button class="util">行囊</button>`);
  bInv.onclick = () => inventoryModal();
  const bScroll = el(`<button class="util">格物卷</button>`);
  bScroll.onclick = () => evidenceModal(key, clues);
  const bAtlas = el(`<button class="util">先賢譜</button>`);
  bAtlas.onclick = () => scientistAtlas();
  bar.append(bAff, bInv, bScroll, bAtlas);
  const proceed = el(`<button class="util go">進入破局 ▸</button>`);
  proceed.style.display = 'none';
  proceed.onclick = onDone;
  bar.appendChild(proceed);
  lay.appendChild(bar);

  const updateCount = () => {
    const n = S.evidence[key].length;
    const answered = clues.filter(cl => S.evidence[key].includes(cl.id) || S.lost[key].includes(cl.id)).length;
    const remaining = clues.length - answered;
    const maxReach = n + remaining;
    evChip.querySelector('.cnt').textContent = n;
    proceed.style.display = n >= min ? '' : 'none';
    if (n >= min) hintChip.textContent = '證據已足，可進入破局';
    else if (maxReach < min) hintChip.textContent = '證據鏈已斷，無法湊足…';   // 即將破局失敗
    else if (remaining > 0) hintChip.textContent = `還有 ${remaining} 件證物待查（需 ${min} 件有效證據）`;
    else hintChip.textContent = '';
    if (n >= min && key === 'prologue') proceed.textContent = '進入第一章 ▸';
  };

  const secured = (cl) => S.evidence[key].includes(cl.id);
  const lostCl = (cl) => S.lost[key].includes(cl.id);
  const hotspotTip = (cl) => lostCl(cl) ? '證物已滅失｜查看紀錄'
    : secured(cl) ? '證物已取證｜查看札記' : '點擊調查｜' + (cl.concept || '');
  const hotspotMark = (cl) => secured(cl) ? '✓' : lostCl(cl) ? '✕' : '◇';
  const spots = clues.map(cl => {
    // 忠實還原原版:證據點為「狀態符號 + 證據名稱」按鈕(非純圓點),附物理概念 tooltip
    const s = el(`<button class="hotspot ${secured(cl) ? 'done' : ''} ${lostCl(cl) ? 'lost' : ''}"
      style="left:${cl.pos.x}px;top:${cl.pos.y}px" title="${esc(hotspotTip(cl))}">
      <span class="hs-mark">${hotspotMark(cl)}</span><span class="hs-name">${esc(cl.name)}</span></button>`);
    s.onclick = () => openClue(cl);        // 已答→只讀回顧;未答→作答
    lay.appendChild(s);
    return { cl, s };
  });
  updateCount();

  const scrollDown = (panel) => requestAnimationFrame(() =>
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' }));
  const closePanel = (p) => {                 // 退場動畫後移除
    if (!p || p.classList.contains('closing')) return;
    p.classList.add('closing');
    let done = false;
    const fin = () => { if (!done) { done = true; p.remove(); } };
    p.addEventListener('animationend', fin, { once: true });
    setTimeout(fin, 260);
  };

  function openClue(cl) {
    lay.querySelectorAll('.cluewrap').forEach(n => n.remove());
    const wrap = el(`<div class="cluewrap"></div>`);
    const panel = el(`<div class="cluepanel">
      <button class="pclose" title="收起">✕</button>
      <div class="cluepic"><img class="cell" src="${cl.cell}"></div>
      <div class="cluebody"></div>
    </div>`);
    const body = panel.querySelector('.cluebody');
    body.append(
      el(`<h3>${esc(cl.name)}</h3>`),
      el(`<div class="body">${esc(cl.body)}</div>`),
      el(`<div class="q">${esc(cl.question)}</div>`));
    if (!secured(cl) && !lostCl(cl)) body.appendChild(el(diffHintHTML()));
    panel.querySelector('.pclose').onclick = () => closePanel(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closePanel(wrap); });
    wrap.appendChild(panel);
    lay.appendChild(wrap);
    sfx(key === 'prologue' ? 'paper' : clueSfx(cl.id), 1.0, 0.55);   // 開啟證物:序章翻卷聲/各章證物專屬音效(原版 _campaign_clue_sfx）

    // 已作答 → 只讀回顧,不再重答
    if (secured(cl) || lostCl(cl)) {
      body.appendChild(el(resultHTML(cl, secured(cl))));
      const cont = el(`<button class="btn sm" style="margin-top:14px">收起</button>`);
      cont.onclick = () => closePanel(wrap);
      body.appendChild(cont);
      return;
    }

    const optsWrap = el(`<div></div>`);
    cl.options.forEach((o, idx) => {
      const b = el(`<button class="opt">${esc(o)}</button>`);
      b.onclick = () => answer(cl, idx, body, wrap, optsWrap);
      optsWrap.appendChild(b);
    });
    // 道具:格物籤(排除一錯項)/ 墨線尺(標出物理量)
    const tools = el(`<div style="display:flex;gap:8px;margin-bottom:6px"></div>`);
    if (S.inventory.logic_token > 0) {
      const t = el(`<button class="btn sm ghost">格物籤 ×${S.inventory.logic_token}</button>`);
      t.onclick = () => {
        if (!useItem('logic_token')) return;
        const wrongs = [...optsWrap.querySelectorAll('.opt')].filter((_, i) => i !== cl.correct && !_.disabled);
        if (wrongs.length) { wrongs[0].disabled = true; wrongs[0].style.opacity = .3; wrongs[0].textContent += '　（已排除）'; }
        t.remove(); save();
      };
      tools.appendChild(t);
    }
    if (S.inventory.measuring_rule > 0) {
      const t = el(`<button class="btn sm ghost">墨線尺 ×${S.inventory.measuring_rule}</button>`);
      t.onclick = () => {
        if (!useItem('measuring_rule')) return;
        body.querySelector('.q').insertAdjacentHTML('afterend',
          `<div class="concept" style="margin:.3rem 0">應整理的物理量｜${esc(cl.concept)}</div>`);
        t.remove(); save();
      };
      tools.appendChild(t);
    }
    if (tools.children.length) body.appendChild(tools);
    body.appendChild(optsWrap);
  }

  function resultHTML(cl, ok) {
    if (ok) {
      const rt = cl.route_text && cl.route_text[S.route];
      return `<div class="result ok">取得證據｜${esc(cl.evidence)}
        ${cl.note ? `<div class="concept">${esc(cl.concept)}</div><div>${esc(cl.note)}</div>` : ''}
        ${cl.reveal ? `<div class="reveal"><span class="spk">${esc(cl.reveal_speaker)}</span>　${esc(cl.reveal)}</div>` : ''}
        ${cl.response ? `<div class="reveal">${esc(cl.response)}</div>` : ''}
        ${rt ? `<div class="reveal"><span class="spk">${S.route} 線</span>　${esc(rt)}</div>` : ''}</div>`;
    }
    const lossText = cl.loss || (G.failure_texts[cl.id]) || '此證物已滅失，無法在本章重驗。';
    return `<div class="result bad">證物滅失｜${esc(lossText)}
      ${cl.note ? `<div class="concept">正解觀念｜${esc(cl.concept)}</div><div>${esc(cl.note)}</div>` : ''}</div>`;
  }

  function answer(cl, idx, content, wrap, optsWrap) {
    const buttons = [...optsWrap.querySelectorAll('.opt')];
    buttons.forEach(b => b.disabled = true);
    const ok = idx === cl.correct;
    buttons[idx].classList.add(ok ? 'correct' : 'wrong');
    if (!ok) buttons[cl.correct].classList.add('correct');
    const spot = spots.find(x => x.cl.id === cl.id).s;
    if (ok) {
      sfx('correct', 1.0, 0.72);        // 答對:格物鐘聲(原版 play_sfx 'correct'）
      S.evidence[key].push(cl.id);
      S.secured_order[key] = (S.secured_order[key] || []).concat(cl.id);
      spot.classList.add('done'); spot.querySelector('.hs-mark').textContent = '✓'; spot.title = hotspotTip(cl);
      content.appendChild(el(resultHTML(cl, true)));
      toast('取得證據：' + cl.evidence);
      const c = chById(S.chapter);
      const ms = c && c.milestones && c.milestones[String(S.evidence[key].length)];
      if (ms) {
        const mrt = ms.route_text && ms.route_text[S.route];
        content.appendChild(el(`<div class="reveal" style="border-top:1px solid var(--br);margin-top:.6rem;padding-top:.6rem">
          <span class="spk">${esc(ms.speaker || '推進')}</span>　${esc(ms.text)}
          ${mrt ? `<div style="margin-top:.3rem"><span class="spk">${S.route} 線</span>　${esc(mrt)}</div>` : ''}</div>`));
      }
    } else {
      S.lost[key].push(cl.id);
      spot.classList.add('lost'); spot.querySelector('.hs-mark').textContent = '✕'; spot.title = hotspotTip(cl);
      content.appendChild(el(resultHTML(cl, false)));
    }
    const cont = el(`<button class="btn sm" style="margin-top:14px">收起</button>`);
    cont.onclick = () => closePanel(wrap);
    content.appendChild(cont);
    scrollDown(content);          // 捲右欄到底,讓說明與收起可見
    save(); updateCount();
    // 一旦剩餘證物已湊不滿最低門檻 → 立即失敗(不必等全部答完)
    const maxReach = S.evidence[key].length + clues.filter(
      x => !S.evidence[key].includes(x.id) && !S.lost[key].includes(x.id)).length;
    if (failable && maxReach < min)
      setTimeout(() => (onFail || (() => chapterFailure(chById(S.chapter), '有效證據不足，證據鏈斷裂，本章破局失敗。')))(), 1100);
  }
}

// ===== 忠實還原原作三大 overlay 面板(固定 1280×720 座標,對齊原作 _panel/_label 佈局)=====
function boardOverlay(x, y, w, h, z, onOutside) {
  const ov = el(`<div class="povl" style="z-index:${z}"></div>`);
  const board = el(`<div class="pboard" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
  ov.appendChild(board);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) (onOutside || close)(); });
  stage.appendChild(ov);
  return { ov, board, close };
}
const pLbl = (text, x, y, w, size, color, o = {}) =>
  el(`<div class="plbl" style="left:${x}px;top:${y}px;width:${w}px;font-size:${size}px;color:${color};text-align:${o.align || 'left'};${o.wrap ? '' : 'white-space:nowrap;'}${o.bold ? 'font-weight:700;' : ''}">${text}</div>`);
const pCard = (x, y, w, h, border) =>
  el(`<div class="pcard" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-color:${border}"></div>`);
const pRule = (x, y, w) => el(`<div class="prule" style="left:${x}px;top:${y}px;width:${w}px"></div>`);
function pBtn(text, x, y, w, h, primary, onClick, disabled) {
  const b = el(`<button class="pbtn${primary ? ' go' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"${disabled ? ' disabled' : ''}>${esc(text)}</button>`);
  if (!disabled) b.onclick = onClick;
  return b;
}
// 統一外框 + 內部捲動內容區(給長清單面板:成就譜/配樂鑑賞,與固定板同一視覺語言)
function boardScroll(w, h, title, sub) {
  const { board, close } = boardOverlay((1280 - w) / 2, (720 - h) / 2, w, h, 108);
  board.append(pLbl(esc(title), 40, 24, w - 80, 27, 'var(--br)', { bold: true, align: 'center' }));
  if (sub) board.append(pLbl(esc(sub), 40, 60, w - 80, 13, 'var(--pa2)', { align: 'center' }));
  board.append(pRule(40, sub ? 84 : 68, w - 80));
  const content = el(`<div class="pscroll" style="left:34px;right:22px;top:${sub ? 98 : 82}px;bottom:74px"></div>`);
  board.append(content, pBtn('關閉', (w - 200) / 2, h - 56, 200, 40, true, close));
  return { board, content, close };
}
const relColor = v => v > 0 ? 'var(--jade)' : v < 0 ? 'var(--danger)' : 'var(--pa2)';
// 登場章門檻(還原原作 _relationship_person_is_introduced)
function relIntroduced(name) {
  const gate = { 江濯月: 2, 顧玄策: 3, 霍離: 4, 謝驚弦: 5, 寧觀瀾: 6 }[name];
  return gate ? S.chapter >= gate : true;
}
function affinityStatus(name, v) {          // 還原原作 _affinity_status
  if (!relIntroduced(name)) return '尚未相識';
  return '關係：' + (G.logic.rel_ladder.find(([t]) => v >= t) || [, '態度未定'])[1];
}
function romanceStatus(name, v) {           // 還原原作 _romance_status
  if (name === '裴無咎') return '定位：師徒羈絆';
  if (!relIntroduced(name)) return '定位：尚未相識';
  if (!G.logic.romance_order.includes(name)) return '定位：重要同伴';
  if (S.romance === name) return '情緣：已許心意';
  if (S.chapter >= 9 && v >= 2) return '情緣：可以確認心意';
  if (v >= 2) return '情緣：牽掛漸深';
  if (v >= 1) return '情緣：初有在意';
  return '情緣：仍是同行者';
}

// ---------- 格物卷(證據板,還原原作 toggle_evidence_board)----------
function evidenceModal(key, clues) {
  sfx('paper', 1.05, 0.55);
  const { board, close } = boardOverlay(120, 60, 1040, 600, 90);
  const title = key === 'prologue' ? '序章・鐘樓墜案' : ((chById(S.chapter) || {}).title || '鐘樓墜案');
  board.append(
    pLbl('格物卷｜' + esc(title), 35, 25, 760, 28, 'var(--br)', { bold: true }),
    pLbl('點擊空白處收卷', 770, 33, 220, 14, 'var(--pa2)', { align: 'right' }),
    pRule(35, 80, 970));
  const got = clues.filter(c => (S.evidence[key] || []).includes(c.id));
  if (!got.length) {
    board.appendChild(pLbl('尚未收錄證據。回到現場，先看現象，再選模型。', 60, 140, 920, 19, 'var(--pa)', { align: 'center' }));
  } else got.forEach((c, i) => {
    const x = 45 + (i % 2) * 492, y = 105 + Math.floor(i / 2) * 135;
    const cd = pCard(x, y, 465, 115, 'var(--jade)');
    cd.append(
      pLbl('◆　' + esc(c.evidence), 18, 12, 425, 18, 'var(--br)', { bold: true }),
      pLbl(esc(c.note || c.concept || ''), 18, 45, 425, 14, 'var(--pa)', { wrap: true }));
    board.appendChild(cd);
  });
  board.appendChild(pBtn('收卷', 835, 546, 160, 38, true, close));
}

// ---------- 好感面板(還原原作 toggle_affinity_board:3×3 網格 + 三印列)----------
function affinityBoard() {
  sfx('paper', 0.98, 0.5);
  const { board, close } = boardOverlay(140, 60, 1000, 600, 105);
  board.append(
    pLbl('人物好感與情緣', 35, 20, 600, 30, 'var(--br)', { bold: true }),
    pLbl('點擊空白處收起', 700, 30, 250, 14, 'var(--pa2)', { align: 'right' }),
    pRule(35, 76, 930));
  const names = ['柳照微', '裴無咎', '祁望舒', '蘇檀', '江濯月', '顧玄策', '霍離', '謝驚弦', '寧觀瀾'];
  const pos = [[35, 92], [350, 92], [665, 92], [35, 216], [350, 216], [665, 216], [35, 340], [350, 340], [665, 340]];
  names.forEach((name, i) => {
    const v = S.affinity[name] || 0, known = relIntroduced(name), rc = relColor(v);
    const [cx, cy] = pos[i];
    const cd = pCard(cx, cy, 300, 112, known ? rc : 'rgba(87,97,97,.85)');
    cd.appendChild(el(`<div class="pthumb" style="left:9px;top:9px;width:72px;height:94px;border-color:${known ? 'var(--br)' : 'rgba(87,97,97,.85)'}">${G.portraits[name] ? `<img src="${G.portraits[name]}"${known ? '' : ' style="filter:grayscale(1) brightness(.35)"'}>` : ''}</div>`));
    cd.append(
      pLbl(known ? esc(name) : '尚未相識', 91, 8, 135, 17, known ? 'var(--br)' : 'var(--pa2)', { bold: true }),
      pLbl(known ? (v >= 0 ? '+' : '') + v : '—', 228, 8, 56, 18, rc, { align: 'right', bold: true }),
      pLbl(esc(affinityStatus(name, v)), 91, 35, 200, 12, 'var(--pa)'),
      pLbl(esc(romanceStatus(name, v)), 91, 55, 200, 12, G.logic.romance_order.includes(name) ? '#9fc4b9' : 'var(--pa2)'),
      pLbl('−5', 84, 82, 28, 10, 'var(--pa2)', { align: 'center' }),
      pLbl('+5', 258, 82, 30, 10, 'var(--pa2)', { align: 'center' }));
    const meter = el(`<div class="pmeter" style="left:116px;top:82px;width:140px"></div>`);
    for (let n = -5; n <= 5; n++) {
      const on = known && (v >= 0 ? (n > 0 && n <= v) : (n < 0 && n >= v));
      meter.appendChild(el(`<span class="ptick" style="background:${on ? rc : 'transparent'};border-color:${n === 0 ? 'var(--pa2)' : 'var(--line)'}"></span>`));
    }
    cd.appendChild(meter);
    board.appendChild(cd);
  });
  const s = sealSnapshot(), sm = k => s[k] ? '◆' : '◇';
  board.append(
    pLbl(`折衡匣三印｜人和 ${sm('people')}　理證 ${sm('evidence')}　殘卷 ${sm('fragment')}　（${s.count}／3）`, 80, 468, 840, 15, 'var(--br)', { align: 'center', bold: true }),
    pLbl('僅柳照微、江濯月、蘇檀可發展情緣：+2 可於第九章確認，舊約可延續至第十一章，或以 +4 深交在終章選擇。其他人物維持同伴／師徒線。', 70, 496, 860, 13, 'var(--pa2)', { align: 'center', wrap: true }),
    pBtn('收起人物關係', 390, 542, 220, 42, true, close));
}

// ---------- 行囊(還原原作 toggle_inventory:道具卡列 + 關鍵物彙整)----------
function keyItemSummary() {
  const pairs = [['半枚銅印', 'copper_seal'], ['工坊密圖', 'apprentice_protected'], ['裴無咎殘頁', 'residual_page_recovered'],
  ['密箭暗碼', 'wugou_cipher_recovered'], ['封存熱核', 'thermal_core_secured'], ['雷火盟接地令', 'leihuo_witnesses_saved'],
  ['霆磁圖譜', 'field_notes_recovered'], ['公開真曆', 'true_ephemeris_published'], ['密曜星圖', 'secret_star_chart_recovered'],
  ['破鏡證詞', 'mirror_testimony_published'], ['天理母鏡', 'master_mirror_secured'], ['百工盟冊', 'artisan_league_freed'], ['零度母尺', 'zero_standard_secured']];
  const got = pairs.filter(([, f]) => (S.flags || {})[f]).map(([n]) => n);
  return got.length ? got.join('、') : '尚無';
}
function inventoryModal(onChange) {
  sfx('paper', 1.02, 0.5);
  const done = () => { ov.remove(); onChange && onChange(); };
  const { ov, board } = boardOverlay(110, 55, 1060, 610, 105, () => done());
  board.append(
    pLbl('行囊｜格物器用', 35, 20, 640, 28, 'var(--br)', { bold: true }),
    pLbl(`氣勢 ${S.qishi}／${S.qishi_max}　｜　養成上限 ${S.qishi_max}／5`, 650, 27, 360, 15, 'var(--pa2)', { align: 'right' }),
    pRule(35, 72, 990));
  const order = ['breath_manual', 'calm_powder', 'steadfast_talisman', 'logic_token', 'measuring_rule'];
  order.forEach((id, i) => {
    const it = G.items[id], cnt = S.inventory[id] || 0;
    const cd = pCard(42, 90 + i * 87, 976, 74, cnt > 0 ? 'var(--jade)' : 'rgba(66,82,82,.7)');
    cd.append(
      pLbl(`${esc(it.category)}｜${esc(it.name)}　×${cnt}`, 18, 12, 300, 18, cnt > 0 ? 'var(--br)' : 'var(--pa2)', { bold: true }),
      pLbl(esc(it.description), 325, 12, 445, 14, 'var(--pa)', { wrap: true }));
    if (id !== 'steadfast_talisman') {          // 定心符自動發動,無使用鈕
      const usable = id === 'breath_manual' && cnt > 0 && S.qishi_max < G.max_qishi;   // 其餘道具於情境內使用(格物卷/破局戰)
      cd.appendChild(pBtn(it.use_text, 785, 18, 170, 38, false, () => {
        if (useItem('breath_manual') && S.qishi_max < G.max_qishi) {
          S.qishi_max++; S.qishi = Math.min(S.qishi + 1, S.qishi_max); toast('氣勢上限提升至 ' + S.qishi_max);
        }
        done(); inventoryModal(onChange);
      }, !usable));
    }
    board.appendChild(cd);
  });
  board.append(
    pLbl('關鍵物｜' + esc(keyItemSummary()), 45, 528, 710, 13, 'var(--pa2)', { wrap: true }),
    pBtn('收起行囊', 795, 530, 220, 40, true, done));
}

// ---------- 格物先賢譜(還原原作 _show_scientist_atlas:科學家關係圖)----------
function scientistAtlas() {
  sfx('paper', 1.0, 0.6);
  const { board, close } = boardOverlay(75, 45, 1130, 635, 115);
  const sc = G.scientists;
  const reduced = isReduced();
  board.append(pLbl('格物先賢譜｜物理科學家關係圖', 35, 20, 1060, 29, 'var(--br)', { align: 'center', bold: true }));
  // 圖例:青線＝概念承接、朱線＝同期爭論/競逐;由左至右依年代;點擊看生平與章回應用
  board.append(el(`<div class="atlas-legend" style="position:absolute;left:40px;top:62px;width:1050px">
    <span class="lg"><span class="sw" style="color:var(--jade);background:linear-gradient(90deg,var(--jade),#8fd4b4)"></span>概念承接</span>
    <span class="lg"><span class="sw" style="color:var(--cin);background:linear-gradient(90deg,var(--cin),#e07a5f)"></span>同期爭論／競逐</span>
    <span class="lg" style="opacity:.72">由左至右依年代先後</span>
    <span class="lg" style="opacity:.72">點擊人物看生平與章回應用</span></div>`));
  const graph = el(`<div class="atlas-wrap" style="left:45px;top:100px;width:1040px;height:330px"></div>`);
  // 由左到右依年代先後排列(墨家最早→馬克士威最晚),上下交錯避免擁擠;連線改由節點中心即時算
  const CHRONO = sc.chrono || sc.order, STEP = 108.75;
  const pos = {};
  CHRONO.forEach((id, r) => { pos[id] = [Math.round(15 + r * STEP), r % 2 === 0 ? 45 : 210]; });
  const ctr = id => [pos[id][0] + 75, pos[id][1] + 31];
  const curve = (a, b) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, o = 20;
    return `M${a[0]} ${a[1]} Q${(mx - dy / L * o).toFixed(1)} ${(my + dx / L * o).toFixed(1)} ${b[0]} ${b[1]}`;
  };
  const parts = [`<svg width="1040" height="330" style="position:absolute;inset:0;pointer-events:none">
    <defs>
      <filter id="atlasGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="gJade"><stop offset="0" stop-color="var(--jade)"/><stop offset="1" stop-color="#9be8c1"/></linearGradient>
      <linearGradient id="gCin"><stop offset="0" stop-color="var(--cin)"/><stop offset="1" stop-color="#e5836a"/></linearGradient>
    </defs>`];
  for (const e of sc.edges) {
    const d = curve(ctr(e.from), ctr(e.to)), g = e.color === 'cinnabar' ? 'gCin' : 'gJade';
    parts.push(`<path d="${d}" fill="none" stroke="url(#${g})" stroke-width="2.4" stroke-linecap="round" filter="url(#atlasGlow)" opacity=".9"/>`);
    if (!reduced) parts.push(`<path d="${d}" fill="none" stroke="#f6ecd2" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2 15" opacity=".5"><animate attributeName="stroke-dashoffset" from="0" to="-34" dur="1.7s" repeatCount="indefinite"/></path>`);
  }
  parts.push('</svg>');
  graph.innerHTML = parts.join('');
  // 銘刻式詳情牌(置於圖下方)
  const detail = el(`<div class="atlas-detail" style="left:60px;top:448px;width:1010px;min-height:76px"></div>`);
  detail.textContent = '先賢譜不是背人名：每條線都要回到可觀察的現象與可驗證的模型。';
  const active = (sc.active_by_chapter[String(S.chapter)]) || sc.active_default;
  let selBtn = null;
  for (const id of sc.order) {
    const n = sc.nodes[id], on = active.includes(id), p = pos[id];
    const btn = el(`<button class="atlas-node${on ? ' on' : ''}" style="left:${p[0]}px;top:${p[1]}px">${on ? '<span class="relic"></span>' : ''}<span class="nm">${esc(n.name)}</span><span class="yr">${esc(n.years)}</span><span class="ch">${esc(n.chapter)}</span></button>`);
    btn.onclick = () => {
      if (selBtn) selBtn.classList.remove('sel'); btn.classList.add('sel'); selBtn = btn;
      detail.innerHTML = `<span><b style="color:#ffe6a6">${esc(n.name)}</b>　<span style="color:var(--br)">${esc(n.years)}</span><br><span style="opacity:.92">${esc(n.detail)}</span></span>`;
      sfx('paper', 1.08, 0.32);
    };
    graph.appendChild(btn);
  }
  board.append(graph, detail, pBtn('收起先賢譜', 455, 565, 220, 44, true, close));
}

// ---------- 結局圖鑑(還原原作 show_ending_gallery / show_full_ending_gallery)----------
function endingGallery() {
  sfx('paper', 1.0, 0.5);
  const { board, close } = boardOverlay(90, 42, 1100, 636, 110);
  const seenN = new Set(S.seen_normal || []), seenF = new Set(S.seen_finale || []);
  board.append(
    pLbl('天理殘卷・結局圖鑑', 40, 20, 1020, 30, 'var(--br)', { align: 'center', bold: true }),
    pLbl(`普通結局 ${seenN.size}／4　｜　完整版結局 ${seenF.size}／4　（圖鑑會跨越命運回折保留）`, 40, 60, 1020, 14, 'var(--pa2)', { align: 'center' }));
  [['第九章・普通結局', G.endings_ch9, seenN, 92], ['第十一章・完整版結局', G.endings_finale, seenF, 358]].forEach(([label, ends, seen, y]) => {
    board.appendChild(pLbl(label, 42, y, 400, 15, 'var(--jade)', { bold: true }));
    Object.entries(ends).forEach(([id, e], i) => {
      const on = seen.has(id), x = 42 + i * 258;
      const card = pCard(x, y + 22, 244, 208, on ? 'var(--br)' : 'rgba(87,97,97,.7)');
      card.style.overflow = 'hidden';
      if (on) card.appendChild(el(`<img src="${e.image}" style="position:absolute;left:0;top:0;width:100%;height:150px;object-fit:cover">`));
      card.appendChild(pLbl(on ? esc(e.title) : '尚未收錄', 8, on ? 158 : 90, 228, on ? 16 : 15, on ? 'var(--br)' : 'var(--pa2)', { align: 'center', wrap: true, bold: on }));
      if (on && e.subtitle) card.appendChild(pLbl(esc(e.subtitle), 8, 182, 228, 11, 'var(--pa2)', { align: 'center', wrap: true }));
      board.appendChild(card);
    });
  });
  board.appendChild(pBtn('收起圖鑑', 440, 590, 220, 40, true, close));
}

// ---------- 素材與製作名錄(還原原作 _show_credits)----------
function creditsPanel() {
  sfx('paper', 1.0, 0.5);
  const { board, close } = boardOverlay(210, 78, 860, 570, 110);
  board.appendChild(pLbl('素材與製作名錄', 40, 28, 780, 31, 'var(--br)', { align: 'center', bold: true }));
  const credits =
    '概念、劇情與原始程式｜原作者 @changyi123456\n' +
    '網頁離線版改作｜yazelin，經原作者授權（見 SOURCE.md）\n\n' +
    '場景、證物、角色與結局圖｜OpenAI image generation，依原專案提示與物理校正產生\n\n' +
    '配樂（CC0）\n・Oriental／Oriented／Asianoriental 系列\n・Night of the Streets — nene\n・Factory／Dungeon Ambience — yd\n・Fast Fight — Ville Nousiainen\n・Ancient Temple — Umplix\n・Ending Scene — nene\n\n' +
    '音效（CC0）\n・Correct Bell、Paper、Footsteps、Tree Creaking、100 CC0 SFX\n\n' +
    '字型｜Noto Sans TC（SIL OFL 1.1）\n\n完整作者、原始網址、逐檔雜湊與授權見 provenance/asset-ledger.csv。';
  board.appendChild(el(`<div class="plbl" style="left:62px;top:88px;width:736px;height:388px;overflow-y:auto;font-size:14.5px;color:var(--pa);white-space:pre-wrap;line-height:1.6">${esc(credits)}</div>`));
  board.appendChild(pBtn('關閉', 320, 502, 220, 44, true, close));
}

// ================= 破局戰(氣勢答題) =================
function battle(c) {
  S.qishi = S.qishi_max;
  let bi = 0;
  S._battleCorrect = 0;      // 本章答對的破局戰數(lizheng)
  sceneMusic('battle');
  sfx('gong', 0.82, 0.6);    // 破局戰開場:鑼聲(原版 play_sfx 'gong'）
  const run = () => {
    if (bi >= c.battles.length) return battleCleared(c);
    clear();
    const b = c.battles[bi];
    const lay = el(`<div class="layer fade"></div>`);
    lay.appendChild(el(`<div class="bg" style="background-image:url('${c.background}');filter:brightness(.45)"></div>`));
    lay.appendChild(el(`<div class="scrim"></div>`));
    const bar = el(`<div class="topbar"></div>`);
    bar.appendChild(el(`<div class="chip">破局戰 ${bi + 1}/${c.battles.length}</div>`));
    bar.appendChild(el(`<div class="spacer"></div>`));
    const bInv = el(`<button class="util">行囊</button>`); bInv.onclick = () => inventoryModal(() => renderQishi());
    const bScroll = el(`<button class="util">格物卷</button>`); bScroll.onclick = () => evidenceModal(ckey(), c.clues);   // 答題時可翻閱本章已收錄證據(還原原作,兌現行俠/說書提示)
    const q = el(`<div class="qishi"></div>`);
    const renderQishi = () => { q.innerHTML = ''; for (let k = 0; k < S.qishi_max; k++) q.appendChild(el(`<div class="pip ${k < S.qishi ? 'on' : ''}"></div>`)); };
    renderQishi();
    bar.append(bScroll, bInv, el(`<div class="chip">氣勢</div>`), q);
    lay.appendChild(bar);
    const panel = el(`<div class="choicebox">
      <div style="color:var(--br);letter-spacing:.2em;margin-bottom:.6rem">${esc(b.title)}</div>
      <div class="body" style="font-size:1.1rem;line-height:1.9;margin-bottom:1rem">${esc(b.body)}</div>
      <div class="q" style="font-size:1.2rem;margin-bottom:.5rem">${esc(b.prompt)}</div>
      ${diffHintHTML()}
    </div>`);
    const wrap = el(`<div></div>`);
    b.options.forEach((o, idx) => {
      const btn = el(`<button class="opt">${esc(o)}</button>`);
      btn.onclick = () => {
        [...wrap.querySelectorAll('.opt')].forEach(x => x.disabled = true);
        const ok = idx === b.correct;
        if (ok) { S._battleCorrect++; sfx('correct', 0.94, 0.72); }   // 破局答對:鐘聲
        btn.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) wrap.querySelectorAll('.opt')[b.correct].classList.add('correct');
        panel.appendChild(el(`<div class="result ${ok ? 'ok' : 'bad'}">${esc(b.explanation)}</div>`));
        let saved = false;
        if (!ok) {
          S.qishi--;
          if (S.qishi <= 0 && S.inventory.steadfast_talisman > 0) {   // 定心符自動保命
            useItem('steadfast_talisman'); S.qishi = 1; saved = true;
            panel.appendChild(el(`<div class="result ok">定心符發動，氣勢保留 1 點。</div>`));
          }
          renderQishi();
        }
        const dead = S.qishi <= 0;
        const nx = el(`<button class="btn sm" style="margin-top:16px">${dead ? '——' : '繼續 ▸'}</button>`);
        nx.onclick = () => {
          if (dead) return chapterFailure(c, '氣勢耗盡，破局失敗。');
          bi++; save(); run();
        };
        panel.appendChild(nx);
        if (saved) S.flags.talisman_used = true;
        save();
      };
      wrap.appendChild(btn);
    });
    panel.appendChild(wrap);
    lay.appendChild(panel);
    stage.appendChild(lay);
  };
  run();
}

// 破局全勝 → 章節獎勵 + 戰後劇情 → 章末抉擇
function battleCleared(c) {
  const secured = (S.evidence[ckey()] || []).length;
  const got = grantChapterRewards(secured);
  const beats = c.battle_beats || [];
  const lines = beats.map(b => ({ speaker: b.speaker || '', text: b.response || b.action || '' }))
    .filter(l => l.text);
  if (got.length) lines.push({ speaker: '本章獎勵', text: got.join('、') + '　已收入行囊。' });
  save();
  if (lines.length) playDialogue(c.background, lines, null, () => finalChoice(c));
  else finalChoice(c);
}

// 通用失敗畫面:標題 + 原因 + 重來(自訂)+ 回題名
function failScreen(background, title, reason, retry, retryLabel) {
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${background}');filter:brightness(.3) grayscale(.5)"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox" style="text-align:center">
    <div class="gsub" style="color:var(--danger);font-size:1.3rem;margin-bottom:1rem">${esc(title)}</div>
    <div class="body" style="font-size:1.15rem;line-height:1.9;margin-bottom:1.5rem">${esc(reason)}</div>
  </div>`);
  const row = el(`<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"></div>`);
  const bRetry = el(`<button class="btn">${esc(retryLabel || '重來本章')}</button>`);
  bRetry.onclick = retry;
  const home = el(`<button class="btn ghost">回題名</button>`);
  home.onclick = () => go('title');
  row.append(bRetry, home);
  box.appendChild(row);
  lay.appendChild(box);
  stage.appendChild(lay);
}
function chapterFailure(c, reason) {
  S.flags['failed_ch' + c.id] = true; save();   // 敗卷重開成就用
  failScreen(c.background, '本章失敗', reason,
    () => { S.evidence[ckey()] = []; S.lost[ckey()] = []; delete S.rewarded['reward_ch' + c.id]; go('chapter'); });
}
function prologueFailure() {
  failScreen(G.prologue.background, '線索斷裂', '墜鐘案現場證據不足，無法立案。重新勘查現場。',
    () => { S.evidence.prologue = []; S.lost.prologue = []; sPrologue(); }, '重新勘查');
}

// ================= 章末抉擇 → 分流 =================
function finalChoice(c) {
  if (!c.cleared) c.cleared = true;
  if (!S.cleared.includes(c.id)) S.cleared.push(c.id);
  const fc = c.final_choice;
  if (!fc) { advance(c); return; }
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${c.background}');filter:brightness(.5)"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox"><div class="prompt">${esc(fc.prompt)}</div></div>`);
  const eff = G.logic.final_effects[String(c.id)] || {};
  [['a', 'A'], ['b', 'B']].forEach(([k, route]) => {
    if (!fc[k]) return;
    const b = el(`<button class="choice"><b>${esc(fc[k].title)}</b><small>${esc(fc[k].detail)}</small></button>`);
    b.onclick = () => {
      S.choices['final' + c.id] = fc[k].id;
      const e = eff[k] || {};
      Object.entries(e.flags || {}).forEach(([f, v]) => { S.flags[f] = v; });   // 旗標(含 false)
      Object.entries(e.rel || {}).forEach(([person, d]) => affinity(person, d)); // 章末抉擇的好感後果
      save(); afterChapter(c);
    };
    box.appendChild(b);
  });
  lay.appendChild(box);
  stage.appendChild(lay);
}

function afterChapter(c) {
  S.history = S.history || [];
  const insight = (S.evidence['ch' + c.id] || []).length;   // 格物:取得證據數
  const lizheng = S._battleCorrect || 0;                      // 理證:答對的破局戰數
  if (!S.history.find(h => h.chapter === c.id))
    S.history.push({ chapter: c.id, ending: 'clear', insight, lizheng });
  if (!S.cleared.includes(c.id)) S.cleared.push(c.id);
  S.perfect = S.perfect || {}; S.grandmaster = S.grandmaster || {};
  if (insight >= 6 && lizheng >= 4) S.perfect[c.id] = true;   // 六證且四戰全對=無漏
  if (S.difficulty === '宗師') S.grandmaster[c.id] = true;     // 宗師難度完成
  if (S.flags['failed_ch' + c.id]) S.flags.defeat_returned = true;   // 敗而復通
  reconcile();
  save();
  if (c.id === 9) return setTimeout(() => romanceSelect('intent', () => chapter9Endings(c)), 700);
  if (c.id === 11) return setTimeout(() => romanceSelect('final', () => finaleEndings(c)), 700);
  chapterClearScreen(c);
}

// 每章通關小卡(通關感 + 分享環節)
function chapterClearScreen(c) {
  const secured = (S.evidence['ch' + c.id] || []).length;
  const perfect = !!(S.perfect || {})[c.id];
  clear();
  sfx('gong', 0.7, 0.65);           // 過關:鑼聲
  const lay = el(`<div class="layer fade" style="display:flex;align-items:center;justify-content:center">
    <div class="bg" style="background-image:url('${c.background}');filter:brightness(.4)"></div>
    <div class="scrim"></div></div>`);
  const box = el(`<div class="choicebox" style="text-align:center">
    <div style="color:var(--jade);letter-spacing:.3em;margin-bottom:.6rem">通　關</div>
    <div class="gtitle" style="font-size:2.2rem">${esc(c.title)}</div>
    <div class="gsub" style="font-size:1rem;margin:1rem 0">${esc(c.subtitle)}</div>
    <div style="color:var(--pa2);margin-bottom:1.5rem">證據 ${secured}/6　${S.route} 線${perfect ? '　・格物無漏' : ''}</div>
  </div>`);
  const row = el(`<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"></div>`);
  row.appendChild(shareBtn('分享通關', `我通關了《格物江湖錄:天理殘卷》${c.title}${perfect ? '（格物無漏！)' : ''}`, c.background));
  const cont = el(`<button class="btn">繼續 ▸</button>`);
  cont.onclick = () => { S.chapter = c.id + 1; save(); go('chapter'); };
  row.append(cont);
  box.appendChild(row);
  lay.querySelector('.scrim').after(box);
  stage.appendChild(lay);
}

// ================= 三印(seal_snapshot,忠實還原) =================
function sealSnapshot() {
  const L = G.logic, rel = S.affinity || {}, flags = S.flags || {};
  const camps = new Set(); let positivePeople = 0;
  for (const [name, camp] of Object.entries(L.camp_map))
    if ((rel[name] || 0) >= 2) { positivePeople++; camps.add(camp); }
  let modestAllies = 0;
  for (const [name, v] of Object.entries(rel))
    if (name !== '裴無咎' && v >= 1) modestAllies++;
  const peopleSeal = (positivePeople >= 3 && camps.size >= 2) || ((rel['裴無咎'] || 0) >= 4 && modestAllies >= 2);
  let clearCount = 0, lateClear = true;
  for (const h of (S.history || [])) {
    if (h.ending === 'clear') { clearCount++; }
    if (h.chapter >= 7 && h.chapter <= 9 && h.ending !== 'clear') lateClear = false;
  }
  // ch7-9 必須都 clear
  for (const n of [7, 8, 9]) if (!(S.history || []).find(h => h.chapter === n && h.ending === 'clear')) lateClear = false;
  const evidenceSeal = clearCount >= 7 && lateClear;
  const peopleFlags = L.people_flags.filter(f => flags[f]).length;
  const standardFlags = L.standard_flags.filter(f => flags[f]).length;
  const hasLateKey = L.late_keys.some(f => flags[f]);
  const fragmentSeal = peopleFlags >= 2 && standardFlags >= 2 && hasLateKey;
  const count = (peopleSeal ? 1 : 0) + (evidenceSeal ? 1 : 0) + (fragmentSeal ? 1 : 0);
  return { people: peopleSeal, evidence: evidenceSeal, fragment: fragmentSeal, count };
}

// ================= 成就(reconcile + toast + 成就譜) =================
function reconcile() {
  // 條件逐條對照 achievement_service._condition_met(bytecode 還原)
  const rel = S.affinity || {}, seals = sealSnapshot();
  const hist = S.history || [], perfect = S.perfect || {}, gm = S.grandmaster || {};
  const secured = new Set(Object.values(S.evidence || {}).flat());   // 答對的證物(special_evidence)
  const deep = Object.values(rel).filter(v => v >= 3).length;
  const relCount = (thr) => Object.values(rel).filter(v => v >= thr).length;
  const storyDone = (ch) => ch === 9 ? (S.cleared.includes(9) && (S.seen_normal || []).length > 0)
    : S.cleared.includes(ch);
  const cond = {
    story_00_bell: () => storyDone(0), story_01_workshop: () => storyDone(1),
    story_02_river: () => storyDone(2), story_03_ridge: () => storyDone(3),
    story_04_forge: () => storyDone(4), story_05_thunder: () => storyDone(5),
    story_06_stars: () => storyDone(6), story_07_mirror: () => storyDone(7),
    story_08_prison: () => storyDone(8), story_09_tianli: () => storyDone(9),
    story_10_tenth_line: () => storyDone(10), story_11_shared_calibration: () => storyDone(11),
    mastery_six_evidence: () => hist.some(h => (h.insight || 0) >= 6),        // 任一章六證
    mastery_four_forms: () => hist.some(h => (h.lizheng || 0) >= 4),          // 任一章四戰全對
    mastery_perfect_chapter: () => Object.keys(perfect).length > 0,           // 任一章 六證+四戰全對
    mastery_all_eleven_perfect: () => [1,2,3,4,5,6,7,8,9,10,11].every(n => perfect[n]),
    mastery_grandmaster_finale: () => !!gm[11],                                // 宗師難度完成第11章
    mastery_error_signed: () => secured.has('calibration_wall') && secured.has('uncertainty_map'),
    relationship_lifebond: () => Object.values(rel).some(v => v >= 5),
    relationship_three_deep: () => relCount(3) >= 3,
    relationship_pei_reconciled: () => (rel['裴無咎'] || 0) >= 4,              // 原版 ≥4(非 ≥1)
    relationship_nine_paths: () => Object.keys(rel).length >= 9 && relCount(1) >= 9,
    seal_people: () => seals.people, seal_evidence: () => seals.evidence, seal_fragment: () => seals.fragment,
    ending_all_normal: () => (S.seen_normal || []).length >= 4,
    ending_all_complete: () => (S.seen_finale || []).length >= 4,
    ending_true_shared: () => (S.seen_finale || []).includes('heaven_earth_shared'),
    system_defeat_return: () => !!S.flags.defeat_returned,
    system_talisman_survivor: () => !!S.flags.talisman_used,
  };
  const newly = [];
  for (const id of G.achievements.ordered)
    if (!S.achievements[id] && cond[id] && cond[id]()) { S.achievements[id] = true; newly.push(id); }
  newly.forEach((id, i) => setTimeout(() => toast('成就解鎖：' + G.achievements.items[id].title), 400 + i * 1400));
  return newly;
}
// ---------- 稱號系統(佩印;由成就解鎖,還原原作 achievement titles）----------
const DEFAULT_TITLE = '無名格物者';
const equippedTitle = () => S.equipped_title || DEFAULT_TITLE;
function earnedTitles() {          // 預設 + 已解鎖成就所贈之稱號(依成就順序)
  const t = [DEFAULT_TITLE];
  for (const id of G.achievements.ordered) {
    const it = G.achievements.items[id];
    if (it.title_reward && S.achievements[id] && !t.includes(it.title_reward)) t.push(it.title_reward);
  }
  return t;
}
function equipTitle(name) { S.equipped_title = name; save(); }

function achievementCodex() {
  sfx('paper', 0.98, 0.5);
  const total = Object.keys(S.achievements).filter(k => S.achievements[k]).length;
  const { content } = boardScroll(920, 624, `江湖成就譜　${total}／${G.achievements.ordered.length}`, '已解成就顯名；未解僅示模糊線索');
  // 稱號佩印
  const titles = earnedTitles();
  content.appendChild(el(`<div class="pcat">佩印稱號（點擊佩用）</div>`));
  const trow = el(`<div class="tchip-row"></div>`);
  titles.forEach(t => {
    const chip = el(`<button class="tchip${t === equippedTitle() ? ' on' : ''}">${esc(t)}</button>`);
    chip.onclick = () => { equipTitle(t); trow.querySelectorAll('.tchip').forEach(c => c.classList.remove('on')); chip.classList.add('on'); sfx('paper', 1.1, 0.3); };
    trow.appendChild(chip);
  });
  content.appendChild(trow);
  for (const [ck, cat] of Object.entries(G.achievements.categories)) {
    content.appendChild(el(`<div class="pcat">${esc(cat.name)}</div>`));
    G.achievements.ordered.filter(id => G.achievements.items[id].category === ck).forEach(id => {
      const a = G.achievements.items[id], got = S.achievements[id];
      const tr = got && a.title_reward ? `<span class="prow-tr">稱號「${esc(a.title_reward)}」</span>` : '';
      content.appendChild(el(`<div class="prow${got ? '' : ' locked'}">
        <span class="prow-t">${got ? '✦ ' + esc(a.title) : '未解秘印'}</span>
        <span class="prow-d">${esc(got ? a.description : a.hint)}${tr}</span></div>`));
    });
  }
}

// ================= 情緣選擇 =================
function romanceSelect(phase, next) {
  const order = G.logic.romance_order, rel = S.affinity || {};
  const need = phase === 'final' ? 2 : 2;
  let cands = order.filter(n => (rel[n] || 0) >= need);
  if (phase === 'final') {
    // 定局:延續第9章同一人(≥2)或候選之一 ≥4
    cands = order.filter(n => (S.romance === n && (rel[n] || 0) >= 2) || (rel[n] || 0) >= 4);
  }
  if (!cands.length) { S.romance = phase === 'final' ? S.romance : ''; save(); return next(); }
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${G.title_keyart}');filter:brightness(.4)"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox"><div class="prompt">${phase === 'final' ? '第十一章・情緣定局' : '第九章・止機之後，可確認心意'}</div></div>`);
  cands.forEach(n => {
    const c = G.romance.candidates[n];
    const b = el(`<button class="choice"><b>${esc(n)}　<span class="pin">${esc(c.role)}</span></b>
      <small>${esc(phase === 'final' ? c.near : c.mid)}</small></button>`);
    b.onclick = () => { S.romance = n; save(); reconcile(); next(); };
    box.appendChild(b);
  });
  const solo = el(`<button class="choice"><b>此刻不許諾｜仍以同道相守</b><small>獨行亦非孤身，師友與同道仍在。</small></button>`);
  solo.onclick = () => { if (phase !== 'final') S.romance = ''; save(); next(); };
  box.appendChild(solo);
  lay.appendChild(box);
  stage.appendChild(lay);
}

// ================= 第九章普通結局(4) =================
// 第9章普通結局:依一路建立的關係/旗標「算出」結局(忠實還原 suggested_ending)
function suggestedEnding() {
  const rel = S.affinity || {}, f = S.flags || {};
  if (S.choices['final9'] !== 'reversible_shutdown') return 'nameless_ashes';   // 選斷軸焚卷 → 無名灰燼
  const people = (rel['柳照微'] || 0) + (rel['江濯月'] || 0) + (rel['霍離'] || 0);
  const archive = (rel['顧玄策'] || 0) + (rel['寧觀瀾'] || 0) + (f.zero_standard_secured ? 3 : 0);
  const mountain = (rel['裴無咎'] || 0) * 2 + (f.master_mirror_secured ? 2 : 0);
  if (people >= archive && people >= mountain) return 'people_witness';
  if (archive >= mountain) return 'archive_sealed';
  return 'return_mountain';
}
// 第十章「隱藏門扉」:選了可逆止機 且 三印≥2 才解鎖(忠實還原 hidden_route_unlocked)
function hiddenRouteUnlocked() {
  return S.choices['final9'] === 'reversible_shutdown' && sealSnapshot().count >= 2;
}
function chapter9Endings(c) {
  const id = suggestedEnding();
  S.normal_ending = id;
  S.seen_normal = [...new Set([...(S.seen_normal || []), id])];
  save(); reconcile();
  const e = G.endings_ch9[id];
  const unlocked = hiddenRouteUnlocked();
  // 解鎖隱藏門扉 → 續進第十章;否則普通結局完結、回題名
  showEnding(e, unlocked ? () => {
    sfx('door', 0.9, 0.62);         // 穿過隱藏門扉:開門聲(原版 play_sfx 'door'）
    toast('無名度量院的門扉在你身後開啟');
    S.chapter = 10; save(); go('chapter');
  } : null, '普通結局', unlocked ? '穿過隱藏門扉 ▸' : '回題名');
}

// 完整版真結局解鎖(忠實還原 true_ending_unlocked)
function trueEndingUnlocked(sealCount) {
  const rel = S.affinity || {}, f = S.flags || {};
  const deep = Object.values(rel).filter(v => v >= 3).length;
  return sealCount >= 3 && S.cleared.includes(10) && S.cleared.includes(11)
    && !!f.veto_clause_restored && !!f.allies_crosschecked_final
    && S.choices['final11'] === 'open_shared_standard'   // 第11章須選「萬手共衡」
    && deep >= 3 && (rel['裴無咎'] || 0) >= 1;
}
// 完整版結局:依真結局解鎖 + 第11章章末抉擇「算」出(忠實還原 suggested_ending),非自由選
function finaleEndingId(sealCount) {
  if (trueEndingUnlocked(sealCount)) return 'heaven_earth_shared';
  const fc = S.choices['final11'] || '';
  if (fc === 'open_shared_standard') return 'common_measure';
  if (fc === 'seal_four_key_standard') return 'four_keys';
  return 'masterless_road';
}
function finaleEndings(c) {
  const id = finaleEndingId(sealSnapshot().count);
  S.finale_ending = id;
  S.seen_finale = [...new Set([...(S.seen_finale || []), id])];
  save(); reconcile();
  showEnding(G.endings_finale[id], null, '完整版結局');   // 終局 → 回題名
}

// ================= 結局播放 =================
function showEnding(e, next, badge, label) {
  clear();
  preload([e.image]).then(() => {
    const lay = el(`<div class="layer fade"></div>`);
    lay.appendChild(el(`<div class="bg" style="background-image:url('${e.image}');filter:brightness(.55)"></div>`));
    lay.appendChild(el(`<div class="scrim"></div>`));
    lay.appendChild(el(`<div style="position:absolute;left:80px;right:80px;top:80px">
      <div class="intro-eyebrow">${esc(badge || '結局')}</div>
      <div class="intro-title" style="max-width:90%">${esc(e.title)}</div>
      <div style="color:var(--pa2);letter-spacing:.1em;margin-bottom:1.5rem">${esc(e.subtitle)}</div>
      <div class="intro-text" style="max-width:80%;font-size:1.15rem;max-height:280px;overflow:auto">${esc(e.text)}
        <div style="margin-top:1.2rem;color:#b9ad93">${esc(e.epilogue || '')}</div></div>
    </div>`));
    const row = el(`<div style="position:absolute;right:60px;bottom:48px;display:flex;gap:12px;align-items:center"></div>`);
    row.appendChild(shareBtn('分享此結局', `我在《格物江湖錄:天理殘卷》走到了「${e.title}」`, e.image));
    const b = el(`<button class="btn">${label || (next ? '繼續 ▸' : '回題名')}</button>`);
    b.onclick = next || (() => go('title'));
    row.appendChild(b);
    lay.appendChild(row);
    stage.appendChild(lay);
  });
}

// ================= 啟動 =================
fetch('data/game.json').then(r => r.json()).then(data => {
  G = data;
  S = loadSave() || newState();
  S.scene = 'title';                 // 一律回題名;存檔進度保留,按「繼續」才載入
  syncReduced();
  initWeather();
  initGlobalMute();
  initPWAInstall();
  initAmbient();
  initMenu();
  initAudioUnlock();
  fit();
  render();
}).catch(e => { stage.innerHTML = `<div class="loading">載入失敗：${esc(e.message)}</div>`; });
