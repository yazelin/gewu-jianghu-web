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
  inventory: {}, choices: {}, cleared: [], intro_seen: false,
});
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
      b.onclick = () => { affinity(o.relationship, o.delta || 0); S.choices['dlg' + S.chapter] = o.id; cb.remove(); step(); };
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
      clues: p.hotspots, min: 3, onDone: () => { S.cleared.push(0); go('chapter'); },
      failable: false,
    }));
  });
}

// ================= 章節 =================
function sChapter() {
  const c = chById(S.chapter);
  if (!c) return endGameStub();
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
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${background}')"></div>`));
  lay.appendChild(el(`<div class="scrim" style="background:rgba(10,8,6,.25)"></div>`));
  stage.appendChild(lay);

  const bar = el(`<div class="topbar"></div>`);
  const evChip = el(`<div class="chip">證據 <b class="cnt">0</b> / ${min}</div>`);
  bar.append(el(`<div class="chip">${esc(title)}</div>`), evChip, el(`<div class="spacer"></div>`));
  const bScroll = el(`<button class="util">格物卷</button>`);
  bScroll.onclick = () => evidenceModal(key, clues);
  bar.appendChild(bScroll);
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

  const spots = clues.map(cl => {
    const done = S.evidence[key].includes(cl.id), lost = S.lost[key].includes(cl.id);
    const s = el(`<div class="hotspot ${done ? 'done' : ''} ${lost ? 'lost' : ''}"
      style="left:${cl.pos.x}px;top:${cl.pos.y}px"></div>`);
    s.onclick = () => { if (!done && !lost) openClue(cl); };
    lay.appendChild(s);
    return { cl, s };
  });
  updateCount();

  function openClue(cl) {
    lay.querySelectorAll('.panel').forEach(n => n.remove());
    const panel = el(`<div class="panel">
      <h3>${esc(cl.name)}</h3>
      <img class="cell" src="${cl.cell}">
      <div class="body">${esc(cl.body)}</div>
      <div class="q">${esc(cl.question)}</div>
    </div>`);
    const optsWrap = el(`<div></div>`);
    cl.options.forEach((o, idx) => {
      const b = el(`<button class="opt">${esc(o)}</button>`);
      b.onclick = () => answer(cl, idx, panel, optsWrap);
      optsWrap.appendChild(b);
    });
    panel.appendChild(optsWrap);
    lay.appendChild(panel);
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
      const rt = cl.route_text && cl.route_text[S.route];
      panel.appendChild(el(`<div class="result ok">
        取得證據｜${esc(cl.evidence)}
        ${cl.note ? `<div class="concept">${esc(cl.concept)}</div><div>${esc(cl.note)}</div>` : ''}
        ${cl.reveal ? `<div class="reveal"><span class="spk">${esc(cl.reveal_speaker)}</span>　${esc(cl.reveal)}</div>` : ''}
        ${cl.response ? `<div class="reveal">${esc(cl.response)}</div>` : ''}
        ${rt ? `<div class="reveal"><span class="spk">${S.route} 線</span>　${esc(rt)}</div>` : ''}
      </div>`));
      toast('取得證據：' + cl.evidence);
    } else {
      S.lost[key].push(cl.id);
      spot.classList.add('lost');
      const lossText = cl.loss || (G.failure_texts[cl.id]) || '此證物已滅失,無法在本章重驗。';
      panel.appendChild(el(`<div class="result bad">
        證物滅失｜${esc(lossText)}
        ${cl.note ? `<div class="concept">正解觀念｜${esc(cl.concept)}</div><div>${esc(cl.note)}</div>` : ''}
      </div>`));
    }
    const cont = el(`<button class="btn sm" style="margin-top:14px">收起</button>`);
    cont.onclick = () => panel.remove();
    panel.appendChild(cont);
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

// ================= 破局戰(氣勢答題) =================
function battle(c) {
  S.qishi = S.qishi_max;
  let bi = 0;
  const run = () => {
    if (bi >= c.battles.length) return finalChoice(c);
    clear();
    const b = c.battles[bi];
    const lay = el(`<div class="layer fade"></div>`);
    lay.appendChild(el(`<div class="bg" style="background-image:url('${c.background}');filter:brightness(.45)"></div>`));
    lay.appendChild(el(`<div class="scrim"></div>`));
    const bar = el(`<div class="topbar"></div>`);
    bar.appendChild(el(`<div class="chip">破局戰 ${bi + 1}/${c.battles.length}</div>`));
    bar.appendChild(el(`<div class="spacer"></div>`));
    const q = el(`<div class="qishi"></div>`);
    for (let k = 0; k < S.qishi_max; k++) q.appendChild(el(`<div class="pip ${k < S.qishi ? 'on' : ''}"></div>`));
    bar.append(el(`<div class="chip">氣勢</div>`), q);
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
        if (!ok) { S.qishi--; q.children[S.qishi] && q.children[S.qishi].classList.remove('on'); }
        const nx = el(`<button class="btn sm" style="margin-top:16px">${ok || S.qishi > 0 ? '繼續 ▸' : '——'}</button>`);
        nx.onclick = () => {
          if (S.qishi <= 0) return chapterFailure(c, '氣勢耗盡,破局失敗。');
          bi++; save(); run();
        };
        panel.appendChild(nx);
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

function chapterFailure(c, reason) {
  clear();
  const lay = el(`<div class="layer fade"></div>`);
  lay.appendChild(el(`<div class="bg" style="background-image:url('${c.background}');filter:brightness(.3) grayscale(.5)"></div>`));
  lay.appendChild(el(`<div class="scrim"></div>`));
  const box = el(`<div class="choicebox" style="text-align:center">
    <div class="gsub" style="color:var(--danger);font-size:1.3rem;margin-bottom:1rem">本章失敗</div>
    <div class="body" style="font-size:1.15rem;line-height:1.9;margin-bottom:1.5rem">${esc(reason)}</div>
  </div>`);
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
  [['a', 'A'], ['b', 'B']].forEach(([k, route]) => {
    if (!fc[k]) return;
    const b = el(`<button class="choice"><b>${esc(fc[k].title)}</b><small>${esc(fc[k].detail)}</small></button>`);
    b.onclick = () => { S.choices['final' + c.id] = fc[k].id; S.route = route; save(); advance(c); };
    box.appendChild(b);
  });
  lay.appendChild(box);
  stage.appendChild(lay);
}

function advance(c) {
  toast(`第 ${c.id} 章完成`);
  if (c.id >= G.chapters.length) return endGameStub();
  S.chapter = c.id + 1;
  setTimeout(() => go('chapter'), 800);
}

// 階段 1 收尾(結局系統為階段 3)
function endGameStub() {
  clear();
  const lay = el(`<div class="layer fade" style="display:flex;align-items:center;justify-content:center">
    <div class="bg" style="background-image:url('${G.title_keyart}');filter:brightness(.4)"></div>
    <div class="scrim"></div>
    <div class="choicebox" style="text-align:center">
      <div class="gsub" style="margin-bottom:1rem">已通過目前實作的章節</div>
      <div class="body">結局／成就／情緣系統為後續階段。感謝遊玩。</div>
    </div></div>`);
  const b = el(`<button class="btn">回題名</button>`);
  b.onclick = () => go('title');
  lay.querySelector('.choicebox').appendChild(b);
  stage.appendChild(lay);
}

// ================= 啟動 =================
fetch('data/game.json').then(r => r.json()).then(data => {
  G = data;
  S = loadSave() || newState();
  fit();
  render();
}).catch(e => { stage.innerHTML = `<div class="loading">載入失敗：${esc(e.message)}</div>`; });
