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
});

// ---------- 音樂(按需 lazy 載入,缺檔靜音) ----------
const MUSIC = {
  ambient: 'oriental_calm',                                     // 題名/一般環境樂(mp3)
  battle: { 4: 'chapter4_battle', 5: 'chapter5_battle', 7: 'chapter7_battle', 10: 'chapter10_battle' },
  investigation: { 7: 'chapter7_mirror_city' },
};
let _audio = null, _curTrack = '';
const isMuted = () => localStorage.getItem('gewu_muted') === '1';
function setMuted(v) { localStorage.setItem('gewu_muted', v ? '1' : '0'); if (_audio) _audio.muted = v; }
function playMusic(basename) {
  if (!basename) return;
  if (!_audio) { _audio = new Audio(); _audio.loop = true; _audio.volume = 0.5; }
  _audio.muted = isMuted();
  if (_curTrack === basename) return;
  _curTrack = basename;
  _audio.src = `assets/audio/${basename}.mp3`;
  _audio.play().catch(() => { });                               // 自動播放受限/缺檔 → 靜默
}
function sceneMusic(kind) {                                      // 依場景挑曲(缺則環境樂)
  if (kind === 'battle') return playMusic(MUSIC.battle[S.chapter] || MUSIC.ambient);
  if (kind === 'investigation') return playMusic(MUSIC.investigation[S.chapter] || MUSIC.ambient);
  return playMusic(MUSIC.ambient);
}
function muteButton() {
  const b = el(`<button class="util">${isMuted() ? '♪ 靜音' : '♪ 開'}</button>`);
  b.onclick = () => { setMuted(!isMuted()); b.textContent = isMuted() ? '♪ 靜音' : '♪ 開'; if (!isMuted()) _audio && _audio.play().catch(() => { }); };
  return b;
}
function musicGallery() {
  const rows = G.achievements.music_gallery.map(m => {
    const unlocked = !m.unlock || S.achievements[m.unlock];
    return `<div class="evrow" style="${unlocked ? '' : 'opacity:.5'}">
      <span class="en" style="color:${unlocked ? 'var(--jade)' : 'var(--pa2)'}">${unlocked ? esc(m.title) : '未解鎖曲目'}</span>
      <span style="color:var(--pa2);font-size:.85rem">　${esc(m.source_title)}</span></div>`;
  }).join('');
  const m = el(`<div class="modal"><div class="sheet">
    <button class="btn sm close">關閉</button><h2>配樂鑑賞</h2>
    <p style="color:var(--pa2);font-size:.85rem;margin-bottom:.8rem">環境樂逐章 lazy 載入,可於任意頂欄以 ♪ 靜音。</p>${rows}</div></div>`);
  m.querySelector('.close').onclick = () => m.remove();
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  stage.appendChild(m);
}

// ---------- world_flags / 路線 ----------
function setFlags(list) { (list || []).forEach(f => { if (f) S.flags[f] = true; }); }
function routeFor(n) {
  const cond = G.logic.route_table[String(n)];
  if (!cond) return 'A';
  const test = (f) => f.startsWith('ending:') ? S.normal_ending === f.slice(7)
    : f.startsWith('seal:') ? !!(S.flags['seal_' + f.slice(5)]) : !!S.flags[f];
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
const clear = () => { stage.innerHTML = ''; };
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

// ---------- 場景路由 ----------
function go(scene) { S.scene = scene; save(); render(); }
function render() {
  clear();
  ({
    title: sTitle, intro: sIntro, prologue: sPrologue, chapter: sChapter,
  }[S.scene] || sTitle)();
}

// ================= 題名頁 =================
function sTitle() {
  playMusic(MUSIC.ambient);
  const bg = el(`<div class="layer fade"></div>`);
  bg.appendChild(el(`<div class="bg" style="background-image:url('${G.title_keyart}');filter:brightness(.7)"></div>`));
  bg.appendChild(el(`<div class="scrim"></div>`));
  const col = el(`<div class="center-col">
    <div class="gtitle">格物江湖錄</div>
    <div class="gsub">天 理 殘 卷</div>
  </div>`);
  const bNew = el(`<button class="btn">開新局</button>`);
  bNew.onclick = () => { S = newState(); go('intro'); };
  const bCont = el(`<button class="btn ghost">繼續</button>`);
  bCont.disabled = !hasSave();
  bCont.onclick = () => { S = loadSave() || newState(); render(); };
  col.append(bNew, bCont);
  const bCodex = el(`<button class="btn sm ghost">江湖成就譜</button>`);
  bCodex.disabled = !hasSave();
  bCodex.onclick = () => { const prev = S; S = loadSave() || newState(); achievementCodex(); S = prev; };
  const bMusic = el(`<button class="btn sm ghost">配樂鑑賞</button>`);
  bMusic.disabled = !hasSave();
  bMusic.onclick = () => { const prev = S; S = loadSave() || newState(); musicGallery(); S = prev; };
  const row2 = el(`<div style="display:flex;gap:12px"></div>`);
  row2.append(bCodex, bMusic);
  col.append(row2);
  bg.appendChild(col);
  bg.appendChild(el(`<div class="linkrow">
    <a href="${G.author_url}" target="_blank" rel="noopener">作者連結｜Instagram</a>
    <a href="${G.donation_url}" target="_blank" rel="noopener">自由贊助｜支持創作</a>
  </div>`));
  stage.appendChild(bg);
}

// ================= 電影式序引(4 幕) =================
function sIntro() {
  let i = 0;
  const pages = G.story_intro;
  const show = () => {
    clear();
    const p = pages[i];
    const lay = el(`<div class="layer fade"></div>`);
    lay.appendChild(el(`<div class="bg" style="background-image:url('${p.image}');filter:brightness(.5)"></div>`));
    lay.appendChild(el(`<div class="scrim"></div>`));
    lay.appendChild(el(`<div style="position:absolute;left:80px;top:180px">
      <div class="intro-eyebrow">${esc(p.eyebrow)}</div>
      <div class="intro-title">${esc(p.title)}</div>
      <div class="intro-text">${esc(p.text)}</div>
    </div>`));
    const nav = el(`<div style="position:absolute;right:60px;bottom:48px;display:flex;gap:14px"></div>`);
    const prev = el(`<button class="btn sm ghost">上一幕</button>`); prev.disabled = i === 0;
    prev.onclick = () => { i--; show(); };
    const next = el(`<button class="btn sm">${i < pages.length - 1 ? '下一幕' : '入局'}</button>`);
    next.onclick = () => { i < pages.length - 1 ? (i++, show()) : (S.intro_seen = true, go('prologue')); };
    const skip = el(`<button class="btn sm ghost">略過</button>`);
    skip.onclick = () => { S.intro_seen = true; go('prologue'); };
    nav.append(prev, next, skip);
    lay.appendChild(nav);
    stage.appendChild(lay);
  };
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
  stage.appendChild(lay);
  const step = () => {
    if (choice && !choiceShown && i === choiceAt) { choiceShown = true; return askChoice(); }
    if (i >= lines.length) return done();
    const l = lines[i++];
    lay.querySelectorAll('.dbox').forEach(n => n.remove());
    const box = el(`<div class="dbox">
      ${l.speaker ? `<div class="spk">${esc(l.speaker)}</div>` : ''}
      <div class="txt">${esc(l.text)}</div>
      <div class="next">點擊繼續 ▾</div></div>`);
    box.onclick = step;
    lay.appendChild(box);
  };
  const askChoice = () => {
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
    playDialogue(p.background, p.narration, null, () => investigate({
      key: 'prologue', background: p.background, title: '序章・鐘樓墜案',
      clues: p.hotspots, min: 3, failable: false,
      onDone: () => {
        // 序章結果 → world_flags(第一章路線依此)
        if (S.evidence.prologue && S.evidence.prologue.includes('keeper')) setFlags(['keeper_saved']);
        if ((S.evidence.prologue || []).length >= 4) setFlags(['prologue_case_strong']);
        if (!S.cleared.includes(0)) S.cleared.push(0);
        go('chapter');
      },
    }));
  });
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
function investigate({ key, background, title, clues, min, onDone, failable }) {
  S.evidence[key] = S.evidence[key] || [];
  S.lost[key] = S.lost[key] || [];
  sceneMusic('investigation');
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${background}')"></div>`));
  lay.appendChild(el(`<div class="scrim" style="background:rgba(10,8,6,.25)"></div>`));
  stage.appendChild(lay);
  // 點背景空白處 → 收起面板
  lay.addEventListener('click', (e) => {
    if (e.target.classList.contains('bg') || e.target.classList.contains('scrim'))
      lay.querySelectorAll('.panel').forEach(p => p.remove());
  });

  const bar = el(`<div class="topbar"></div>`);
  const evChip = el(`<div class="chip">證據 <b class="cnt">0</b> / ${min}</div>`);
  bar.append(el(`<div class="chip">${esc(title)}</div>`), evChip, el(`<div class="spacer"></div>`));
  const bAff = el(`<button class="util">好感</button>`);
  bAff.onclick = () => affinityBoard();
  const bInv = el(`<button class="util">行囊</button>`);
  bInv.onclick = () => inventoryModal();
  const bScroll = el(`<button class="util">格物卷</button>`);
  bScroll.onclick = () => evidenceModal(key, clues);
  bar.append(bAff, bInv, bScroll, muteButton());
  const proceed = el(`<button class="util" style="border-color:var(--jade);color:#bfe6d2">進入破局 ▸</button>`);
  proceed.style.display = 'none';
  proceed.onclick = onDone;
  bar.appendChild(proceed);
  lay.appendChild(bar);

  const updateCount = () => {
    const n = S.evidence[key].length;
    evChip.querySelector('.cnt').textContent = n;
    proceed.style.display = n >= min ? '' : 'none';
    if (n >= min && !failable && clues.every(cl => S.evidence[key].includes(cl.id) || S.lost[key].includes(cl.id)))
      proceed.textContent = '進入第一章 ▸';
  };

  const secured = (cl) => S.evidence[key].includes(cl.id);
  const lostCl = (cl) => S.lost[key].includes(cl.id);
  const spots = clues.map(cl => {
    const s = el(`<div class="hotspot ${secured(cl) ? 'done' : ''} ${lostCl(cl) ? 'lost' : ''}"
      style="left:${cl.pos.x}px;top:${cl.pos.y}px"></div>`);
    s.onclick = () => openClue(cl);        // 已答→只讀回顧;未答→作答
    lay.appendChild(s);
    return { cl, s };
  });
  updateCount();

  const scrollDown = (panel) => requestAnimationFrame(() =>
    panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' }));

  function openClue(cl) {
    lay.querySelectorAll('.panel').forEach(n => n.remove());
    const side = cl.pos.x > 640 ? 'left' : 'right';   // 熱點在右→面板出左,反之
    const panel = el(`<div class="panel ${side}">
      <button class="pclose" title="收起">✕</button>
      <h3>${esc(cl.name)}</h3>
      <img class="cell" src="${cl.cell}">
      <div class="body">${esc(cl.body)}</div>
      <div class="q">${esc(cl.question)}</div>
    </div>`);
    panel.querySelector('.pclose').onclick = () => panel.remove();
    lay.appendChild(panel);

    // 已作答 → 只讀回顧,不再重答
    if (secured(cl) || lostCl(cl)) {
      panel.appendChild(el(resultHTML(cl, secured(cl))));
      const cont = el(`<button class="btn sm" style="margin-top:14px">收起</button>`);
      cont.onclick = () => panel.remove();
      panel.appendChild(cont);
      return;
    }

    const optsWrap = el(`<div></div>`);
    cl.options.forEach((o, idx) => {
      const b = el(`<button class="opt">${esc(o)}</button>`);
      b.onclick = () => answer(cl, idx, panel, optsWrap);
      optsWrap.appendChild(b);
    });
    // 道具:格物籤(排除一錯項)/ 墨線尺(標出物理量)
    const tools = el(`<div style="display:flex;gap:8px;margin-bottom:6px"></div>`);
    if (S.inventory.logic_token > 0) {
      const t = el(`<button class="btn sm ghost">格物籤 ×${S.inventory.logic_token}</button>`);
      t.onclick = () => {
        if (!useItem('logic_token')) return;
        const wrongs = [...optsWrap.querySelectorAll('.opt')].filter((_, i) => i !== cl.correct && !_.disabled);
        if (wrongs.length) { wrongs[0].disabled = true; wrongs[0].style.opacity = .3; wrongs[0].textContent += '　(已排除)'; }
        t.remove(); save();
      };
      tools.appendChild(t);
    }
    if (S.inventory.measuring_rule > 0) {
      const t = el(`<button class="btn sm ghost">墨線尺 ×${S.inventory.measuring_rule}</button>`);
      t.onclick = () => {
        if (!useItem('measuring_rule')) return;
        panel.querySelector('.q').insertAdjacentHTML('afterend',
          `<div class="concept" style="margin:.3rem 0">應整理的物理量｜${esc(cl.concept)}</div>`);
        t.remove(); save();
      };
      tools.appendChild(t);
    }
    if (tools.children.length) panel.appendChild(tools);
    panel.appendChild(optsWrap);
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
    const lossText = cl.loss || (G.failure_texts[cl.id]) || '此證物已滅失,無法在本章重驗。';
    return `<div class="result bad">證物滅失｜${esc(lossText)}
      ${cl.note ? `<div class="concept">正解觀念｜${esc(cl.concept)}</div><div>${esc(cl.note)}</div>` : ''}</div>`;
  }

  function answer(cl, idx, panel, optsWrap) {
    const buttons = [...optsWrap.querySelectorAll('.opt')];
    buttons.forEach(b => b.disabled = true);
    const ok = idx === cl.correct;
    buttons[idx].classList.add(ok ? 'correct' : 'wrong');
    if (!ok) buttons[cl.correct].classList.add('correct');
    const spot = spots.find(x => x.cl.id === cl.id).s;
    if (ok) {
      S.evidence[key].push(cl.id);
      S.secured_order[key] = (S.secured_order[key] || []).concat(cl.id);
      spot.classList.add('done');
      panel.appendChild(el(resultHTML(cl, true)));
      toast('取得證據：' + cl.evidence);
      const c = chById(S.chapter);
      const ms = c && c.milestones && c.milestones[String(S.evidence[key].length)];
      if (ms) {
        const mrt = ms.route_text && ms.route_text[S.route];
        panel.appendChild(el(`<div class="reveal" style="border-top:1px solid var(--br);margin-top:.6rem;padding-top:.6rem">
          <span class="spk">${esc(ms.speaker || '推進')}</span>　${esc(ms.text)}
          ${mrt ? `<div style="margin-top:.3rem"><span class="spk">${S.route} 線</span>　${esc(mrt)}</div>` : ''}</div>`));
      }
    } else {
      S.lost[key].push(cl.id);
      spot.classList.add('lost');
      panel.appendChild(el(resultHTML(cl, false)));
    }
    const cont = el(`<button class="btn sm" style="margin-top:14px">收起</button>`);
    cont.onclick = () => panel.remove();
    panel.appendChild(cont);
    scrollDown(panel);          // 捲到底,讓說明與收起可見
    save(); updateCount();
    // 全部查完但證據不足 → 失敗
    const remaining = clues.filter(x => !S.evidence[key].includes(x.id) && !S.lost[key].includes(x.id));
    if (failable && remaining.length === 0 && S.evidence[key].length < min)
      setTimeout(() => chapterFailure(chById(S.chapter), '有效證據不足,證據鏈斷裂。'), 900);
  }
}

function evidenceModal(key, clues) {
  const got = S.evidence[key] || [];
  const rows = clues.filter(c => got.includes(c.id))
    .map(c => `<div class="evrow"><span class="en">${esc(c.evidence)}</span>　<span style="color:var(--pa2)">${esc(c.concept)}</span></div>`)
    .join('') || '<div class="evrow" style="color:var(--pa2)">尚無證據</div>';
  const m = el(`<div class="modal"><div class="sheet">
    <button class="btn sm close">關閉</button><h2>格物卷</h2>${rows}</div></div>`);
  m.querySelector('.close').onclick = () => m.remove();
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  stage.appendChild(m);
}

// ---------- 好感面板(9 人立繪 ±5) ----------
function relStage(name, value, appeared) {
  if (!appeared) return { role: '定位：尚未相識', stage: '尚未相識' };
  const isCand = G.logic.romance_order.includes(name);
  const role = name === '裴無咎' ? '定位：師徒羈絆' : isCand ? '定位：情緣候選' : '定位：重要同伴';
  let stage;
  if (isCand) {
    if (S.chapter >= 9 && value >= 2) stage = '情緣：可以確認心意';
    else if (value >= 2) stage = '情緣：牽掛漸深';
    else if (value >= 1) stage = '情緣：初有在意';
    else stage = '情緣：仍是同行者';
    if (S.romance === name) stage = '情緣：已許心意';
  } else {
    stage = (G.logic.rel_ladder.find(([t]) => value >= t) || [, '—'])[1];
    stage = '關係：' + stage;
  }
  return { role, stage };
}
function affinityBoard() {
  const cards = G.people.map(p => {
    const appeared = S.chapter >= p.first || S.cleared.length > 0 && p.first <= S.chapter;
    const v = S.affinity[p.name] || 0;
    const { role, stage } = relStage(p.name, v, appeared);
    const pips = Array.from({ length: 11 }, (_, i) => i - 5)
      .map(n => `<span style="width:12px;height:12px;border-radius:50%;display:inline-block;margin:1px;
        border:1px solid ${n === 0 ? 'var(--pa2)' : 'var(--line)'};
        background:${appeared && (v >= 0 ? n > 0 && n <= v : n < 0 && n >= v) ? (v >= 0 ? 'var(--jade)' : 'var(--danger)') : 'transparent'}"></span>`).join('');
    return `<div style="display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);${appeared ? '' : 'opacity:.4'}">
      <img src="${G.portraits[p.name]}" style="width:64px;height:96px;object-fit:cover;border-radius:6px;${appeared ? '' : 'filter:grayscale(1) brightness(.4)'}">
      <div style="flex:1">
        <div style="font-size:1.1rem;color:#f3ead6">${esc(p.name)} <span class="pin" style="color:var(--br)">${esc(role)}</span></div>
        <div style="margin:.4rem 0">${pips} <span style="color:var(--pa2);margin-left:8px">${appeared ? (v >= 0 ? '+' : '') + v : ''}</span></div>
        <div style="color:var(--jade);font-size:.9rem">${esc(stage)}</div>
      </div></div>`;
  }).join('');
  const m = el(`<div class="modal"><div class="sheet">
    <button class="btn sm close">關閉</button><h2>人物好感與情緣</h2>${cards}</div></div>`);
  m.querySelector('.close').onclick = () => m.remove();
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  stage.appendChild(m);
}

// ---------- 行囊 ----------
function inventoryModal(onChange) {
  const rows = Object.entries(G.items).map(([id, it]) => {
    const n = S.inventory[id] || 0;
    const usable = id === 'breath_manual' && n > 0 && S.qishi_max < G.max_qishi;
    return `<div class="evrow" style="display:flex;align-items:center;gap:12px">
      <div style="flex:1"><span class="en" style="color:var(--pa)">${esc(it.name)}</span> ×${n}
        <div style="color:var(--pa2);font-size:.85rem">${esc(it.description)}</div></div>
      ${usable ? `<button class="btn sm" data-use="${id}">參悟</button>` : ''}</div>`;
  }).join('');
  const m = el(`<div class="modal"><div class="sheet">
    <button class="btn sm close">關閉</button><h2>行囊　氣勢上限 ${S.qishi_max}/${G.max_qishi}</h2>${rows}</div></div>`);
  m.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
    const id = b.dataset.use;
    if (id === 'breath_manual' && useItem('breath_manual') && S.qishi_max < G.max_qishi) {
      S.qishi_max++; S.qishi = Math.min(S.qishi + 1, S.qishi_max); toast('氣勢上限提升至 ' + S.qishi_max);
    }
    save(); m.remove(); onChange && onChange(); inventoryModal(onChange);
  });
  m.querySelector('.close').onclick = () => { m.remove(); onChange && onChange(); };
  m.onclick = (e) => { if (e.target === m) { m.remove(); onChange && onChange(); } };
  stage.appendChild(m);
}

// ================= 破局戰(氣勢答題) =================
function battle(c) {
  S.qishi = S.qishi_max;
  let bi = 0;
  sceneMusic('battle');
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
    const q = el(`<div class="qishi"></div>`);
    const renderQishi = () => { q.innerHTML = ''; for (let k = 0; k < S.qishi_max; k++) q.appendChild(el(`<div class="pip ${k < S.qishi ? 'on' : ''}"></div>`)); };
    renderQishi();
    bar.append(bInv, el(`<div class="chip">氣勢</div>`), q);
    lay.appendChild(bar);
    const panel = el(`<div class="choicebox">
      <div style="color:var(--br);letter-spacing:.2em;margin-bottom:.6rem">${esc(b.title)}</div>
      <div class="body" style="font-size:1.1rem;line-height:1.9;margin-bottom:1rem">${esc(b.body)}</div>
      <div class="q" style="font-size:1.2rem;margin-bottom:1rem">${esc(b.prompt)}</div>
    </div>`);
    const wrap = el(`<div></div>`);
    b.options.forEach((o, idx) => {
      const btn = el(`<button class="opt">${esc(o)}</button>`);
      btn.onclick = () => {
        [...wrap.querySelectorAll('.opt')].forEach(x => x.disabled = true);
        const ok = idx === b.correct;
        btn.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) wrap.querySelectorAll('.opt')[b.correct].classList.add('correct');
        panel.appendChild(el(`<div class="result ${ok ? 'ok' : 'bad'}">${esc(b.explanation)}</div>`));
        let saved = false;
        if (!ok) {
          S.qishi--;
          if (S.qishi <= 0 && S.inventory.steadfast_talisman > 0) {   // 定心符自動保命
            useItem('steadfast_talisman'); S.qishi = 1; saved = true;
            panel.appendChild(el(`<div class="result ok">定心符發動,氣勢保留 1 點。</div>`));
          }
          renderQishi();
        }
        const dead = S.qishi <= 0;
        const nx = el(`<button class="btn sm" style="margin-top:16px">${dead ? '——' : '繼續 ▸'}</button>`);
        nx.onclick = () => {
          if (dead) return chapterFailure(c, '氣勢耗盡,破局失敗。');
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

function chapterFailure(c, reason) {
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${c.background}');filter:brightness(.3) grayscale(.5)"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox" style="text-align:center">
    <div class="gsub" style="color:var(--danger);font-size:1.3rem;margin-bottom:1rem">本章失敗</div>
    <div class="body" style="font-size:1.15rem;line-height:1.9;margin-bottom:1.5rem">${esc(reason)}</div>
  </div>`);
  S.flags['failed_ch' + c.id] = true; save();   // 敗卷重開成就用
  const retry = el(`<button class="btn">重來本章</button>`);
  retry.onclick = () => { S.evidence[ckey()] = []; S.lost[ckey()] = []; go('chapter'); };
  box.appendChild(retry);
  lay.appendChild(box);
  stage.appendChild(lay);
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
  const ff = G.logic.final_flags[String(c.id)] || {};
  [['a', 'A'], ['b', 'B']].forEach(([k, route]) => {
    if (!fc[k]) return;
    const b = el(`<button class="choice"><b>${esc(fc[k].title)}</b><small>${esc(fc[k].detail)}</small></button>`);
    b.onclick = () => { S.choices['final' + c.id] = fc[k].id; setFlags(ff[k]); save(); afterChapter(c); };
    box.appendChild(b);
  });
  lay.appendChild(box);
  stage.appendChild(lay);
}

function afterChapter(c) {
  S.history = S.history || [];
  if (!S.history.find(h => h.chapter === c.id)) S.history.push({ chapter: c.id, ending: 'clear' });
  if (!S.cleared.includes(c.id)) S.cleared.push(c.id);
  if (S.flags['failed_ch' + c.id]) S.flags.defeat_returned = true;   // 敗而復通
  reconcile();
  save();
  toast(`第 ${c.id} 章完成`);
  if (c.id === 9) return setTimeout(() => romanceSelect('intent', () => chapter9Endings(c)), 700);
  if (c.id === 11) return setTimeout(() => romanceSelect('final', () => finaleEndings(c)), 700);
  S.chapter = c.id + 1; save();
  setTimeout(() => go('chapter'), 700);
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
  const rel = S.affinity || {}, seals = sealSnapshot();
  const evAll = S.evidence || {};
  const six = (k) => (evAll[k] || []).length >= 6;
  const deep = Object.values(rel).filter(v => v >= 3).length;
  const cond = {
    story_00_bell: () => S.cleared.includes(0), story_01_workshop: () => S.cleared.includes(1),
    story_02_river: () => S.cleared.includes(2), story_03_ridge: () => S.cleared.includes(3),
    story_04_forge: () => S.cleared.includes(4), story_05_thunder: () => S.cleared.includes(5),
    story_06_stars: () => S.cleared.includes(6), story_07_mirror: () => S.cleared.includes(7),
    story_08_prison: () => S.cleared.includes(8), story_09_tianli: () => S.cleared.includes(9),
    story_10_tenth_line: () => S.cleared.includes(10), story_11_shared_calibration: () => S.cleared.includes(11),
    mastery_six_evidence: () => Object.keys(evAll).some(six),
    mastery_four_forms: () => S.cleared.some(n => n >= 1),
    mastery_perfect_chapter: () => G.chapters.some(c => six('ch' + c.id) && S.cleared.includes(c.id)),
    mastery_all_eleven_perfect: () => G.chapters.every(c => six('ch' + c.id)),
    mastery_grandmaster_finale: () => S.finale_ending === 'heaven_earth_shared',
    mastery_error_signed: () => Object.values(evAll).flat().length > 0 &&
      G.chapters.some(c => c.clues.some(cl => (evAll['ch' + c.id] || []).includes(cl.id) && /誤差|有效數字|可追溯|署名/.test(cl.concept))),
    relationship_lifebond: () => Object.values(rel).some(v => v >= 5),
    relationship_three_deep: () => deep >= 3,
    relationship_pei_reconciled: () => (rel['裴無咎'] || 0) >= 1,
    relationship_nine_paths: () => G.people.every(p => (rel[p.name] || 0) >= 1),
    seal_people: () => seals.people, seal_evidence: () => seals.evidence, seal_fragment: () => seals.fragment,
    ending_all_normal: () => (S.seen_normal || []).length >= 4,
    ending_all_complete: () => (S.seen_finale || []).length >= 4,
    ending_true_shared: () => S.finale_ending === 'heaven_earth_shared',
    system_defeat_return: () => !!S.flags.defeat_returned,
    system_talisman_survivor: () => !!S.flags.talisman_used,
  };
  const newly = [];
  for (const id of G.achievements.ordered)
    if (!S.achievements[id] && cond[id] && cond[id]()) { S.achievements[id] = true; newly.push(id); }
  newly.forEach((id, i) => setTimeout(() => toast('成就解鎖：' + G.achievements.items[id].title), 400 + i * 1400));
  return newly;
}
function achievementCodex() {
  const cats = G.achievements.categories;
  let html = '';
  for (const [ck, cat] of Object.entries(cats)) {
    const items = G.achievements.ordered.filter(id => G.achievements.items[id].category === ck);
    html += `<h3 style="color:var(--br);margin:1rem 0 .4rem">${esc(cat.name)}</h3>`;
    for (const id of items) {
      const a = G.achievements.items[id], got = S.achievements[id];
      html += `<div class="evrow" style="${got ? '' : 'opacity:.5'}">
        <span class="en" style="color:${got ? 'var(--jade)' : 'var(--pa2)'}">${got ? '✦ ' + esc(a.title) : '未解秘印'}</span>
        <span style="color:var(--pa2);font-size:.85rem">　${esc(got ? a.description : a.hint)}</span></div>`;
    }
  }
  const total = Object.keys(S.achievements).filter(k => S.achievements[k]).length;
  const m = el(`<div class="modal"><div class="sheet">
    <button class="btn sm close">關閉</button><h2>江湖成就譜　${total}/${G.achievements.ordered.length}</h2>${html}</div></div>`);
  m.querySelector('.close').onclick = () => m.remove();
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  stage.appendChild(m);
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
  const box = el(`<div class="choicebox"><div class="prompt">${phase === 'final' ? '第十一章・情緣定局' : '第九章・止機之後,可確認心意'}</div></div>`);
  cands.forEach(n => {
    const c = G.romance.candidates[n];
    const b = el(`<button class="choice"><b>${esc(n)}　<span class="pin">${esc(c.role)}</span></b>
      <small>${esc(phase === 'final' ? c.near : c.mid)}</small></button>`);
    b.onclick = () => { S.romance = n; save(); reconcile(); next(); };
    box.appendChild(b);
  });
  const solo = el(`<button class="choice"><b>此刻不許諾｜仍以同道相守</b><small>獨行亦非孤身,師友與同道仍在。</small></button>`);
  solo.onclick = () => { if (phase !== 'final') S.romance = ''; save(); next(); };
  box.appendChild(solo);
  lay.appendChild(box);
  stage.appendChild(lay);
}

// ================= 第九章普通結局(4) =================
function chapter9Endings(c) {
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${c.background}');filter:brightness(.4)"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox"><div class="prompt">天理衡停下後,你選擇讓真相去往何處?</div></div>`);
  Object.entries(G.endings_ch9).forEach(([id, e]) => {
    const b = el(`<button class="choice"><b>${esc(e.title)}</b><small>${esc(e.subtitle)}</small></button>`);
    b.onclick = () => {
      S.normal_ending = id;
      S.seen_normal = [...new Set([...(S.seen_normal || []), id])];
      if (id === 'people_witness') setFlags(['seal_people']);
      save(); reconcile();
      showEnding(e, () => { S.chapter = 10; save(); go('chapter'); }, '普通結局');
    };
    box.appendChild(b);
  });
  lay.appendChild(box);
  stage.appendChild(lay);
}

// ================= 完整版結局(4,真結局有嚴格條件) =================
function finaleEndings(c) {
  const seals = sealSnapshot(), rel = S.affinity || {};
  const deep = Object.values(rel).filter(v => v >= 3).length;
  const trueOK = seals.count === 3 && !!S.flags.veto_clause_restored &&
    !!S.flags.allies_crosschecked_final && deep >= 3 && (rel['裴無咎'] || 0) >= 1;
  const avail = Object.keys(G.endings_finale).filter(id =>
    id === 'heaven_earth_shared' ? trueOK : true);
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${c.background}');filter:brightness(.4)"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox"><div class="prompt">天地共衡・終局
    <div style="font-size:.9rem;color:var(--pa2);margin-top:.5rem">三印 ${seals.count}/3${trueOK ? '　真結局已解鎖' : ''}</div></div>`);
  avail.forEach(id => {
    const e = G.endings_finale[id];
    const isTrue = id === 'heaven_earth_shared';
    const b = el(`<button class="choice" ${isTrue ? 'style="border-color:var(--cin)"' : ''}>
      <b>${esc(e.title)}</b><small>${esc(e.subtitle)}</small></button>`);
    b.onclick = () => {
      S.finale_ending = id;
      S.seen_finale = [...new Set([...(S.seen_finale || []), id])];
      save(); reconcile();
      showEnding(e, () => go('title'), '完整版結局');
    };
    box.appendChild(b);
  });
  lay.appendChild(box);
  stage.appendChild(lay);
}

// ================= 結局播放 =================
function showEnding(e, next, badge) {
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
    const b = el(`<button class="btn" style="position:absolute;right:60px;bottom:48px">${next === undefined ? '回題名' : '繼續 ▸'}</button>`);
    b.onclick = next || (() => go('title'));
    lay.appendChild(b);
    stage.appendChild(lay);
  });
}

// ================= 啟動 =================
fetch('data/game.json').then(r => r.json()).then(data => {
  G = data;
  S = loadSave() || newState();
  fit();
  render();
}).catch(e => { stage.innerHTML = `<div class="loading">載入失敗：${esc(e.message)}</div>`; });
