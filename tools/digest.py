import json, html, os

A = json.load(open('all_consts.json'))
CH = {}
for f in ['campaign_content', 'campaign_late_content', 'campaign_finale_content']:
    CH.update(A[f]['CHAPTERS'])
PROG = A['campaign_story_progression']['CHAPTERS']
M = A['main']
e = lambda s: html.escape(str(s))

def atlas_cell(chid, idx):
    return f'img/cells/chapter{chid}_evidence_atlas_{idx}.png'

def qbox(q, opts, correct, note=None, concept=None):
    li = ''.join(
        f'<li class="{"ok" if i == correct else ""}">{e(o)}</li>' for i, o in enumerate(opts))
    x = f'<p class="q">{e(q)}</p><ol class="opts">{li}</ol>'
    if note:    x += f'<p class="note">{e(note)}</p>'
    if concept: x += f'<p class="concept">{e(concept)}</p>'
    return x

out = ['<h1>格物江湖錄：天理殘卷 — 內容與流程拆解</h1>',
       '<p class="lede">由 v1.4.0 Windows 發佈檔的 Godot PCK 還原。僅供本機研讀，內容著作權屬原作者。</p>']

# --- prologue -------------------------------------------------------------
out.append('<section><h2>序章・鐘樓墜案</h2>')
out.append('<div class="dlg">' + ''.join(
    f'<p><b>{e(l["speaker"])}</b>{e(l["text"])}</p>' for l in M['PROLOGUE']) + '</div>')
out.append('<p class="meta">6 個場景熱點，同一張六格證物圖切分。</p><div class="grid">')
for hid, h in M['HOTSPOTS'].items():
    i = M['EVIDENCE_ATLAS_INDEX'][hid]
    out.append(f'''<article><img src="img/cells/bell_case_evidence_atlas_{i}.png">
<h4>{e(h["name"])} <span class="pin">熱點 x{h["position"]["x"]} y{h["position"]["y"]}</span></h4>
<p class="body">{e(h["body"])}</p>{qbox(h["question"], h["options"], h["correct"], h.get("note"), h.get("concept"))}
<p class="ev">取得證據：{e(h["evidence"])}</p></article>''')
out.append('</div></section>')

# --- chapters -------------------------------------------------------------
for cid in sorted(CH, key=int):
    c, pr = CH[cid], PROG.get(cid, {})
    out.append(f'<section><h2>{e(c["title"])}</h2>')
    out.append(f'<p class="sub">{e(c["subtitle"])}</p>')
    bg = os.path.basename(c['background'])[:-4]
    out.append(f'<img class="bg" src="img/{bg}.png">')
    out.append(f'''<p class="meta">地點 {e(c["location"])}｜至少 {c["minimum_evidence"]} 項證據才能開戰
｜路線 A {e(c["route_a_name"])}／路線 B {e(c["route_b_name"])}
{"｜本章目標 " + e(pr["goal"]) if pr.get("goal") else ""}</p>''')
    for k, lab in [('route_a_intro', 'A 線開場'), ('route_b_intro', 'B 線開場'), ('common_dialogue', '共通對白')]:
        if k in c:
            out.append(f'<h3>{lab}</h3><div class="dlg">' + ''.join(
                f'<p><b>{e(l.get("speaker",""))}</b>{e(l.get("text",""))}</p>' for l in c[k]) + '</div>')
    if 'dialogue_choice' in c:
        d = c['dialogue_choice']
        out.append(f'<h3>對白抉擇（第 {d["at"]} 句後）</h3><p class="q">{e(d["prompt"])}</p><ul class="choice">' +
                   ''.join(f'<li>{e(o["text"])}<span class="pin">{e(o["relationship"])} {o["delta"]:+d}</span></li>'
                           for o in d['options']) + '</ul>')
    out.append(f'<h3>六項證據（一次性作答）</h3><div class="grid">')
    for k, cl in c['clues'].items():
        p = pr.get('clues', {}).get(k, {})
        extra = ''
        if p:
            extra = (f'<p class="reveal">推進：{e(p["reveal"])}</p>'
                     f'<p class="resp"><b>{e(p.get("speaker",""))}</b>{e(p.get("response",""))}</p>'
                     + ''.join(f'<p class="route"><b>{r} 線</b>{e(t)}</p>'
                               for r, t in p.get('route_text', {}).items())
                     + f'<p class="loss">答錯：{e(p["loss"])}</p>' if p.get('loss') else '')
        out.append(f'''<article><img src="{atlas_cell(cid, cl["atlas_index"])}">
<h4>{e(cl["name"])} <span class="pin">格 {cl["atlas_index"]}｜熱點 x{cl["position"]["x"]} y{cl["position"]["y"]}</span></h4>
<p class="body">{e(cl["body"])}</p>{qbox(cl["question"], cl["options"], cl["correct"], cl.get("note"), cl.get("concept"))}
<p class="ev">取得證據：{e(cl["evidence"])}</p>{extra}</article>''')
    out.append('</div>')
    out.append('<h3>四場答題戰</h3><div class="battles">')
    for b in c['battle']:
        out.append(f'''<article><h4>{e(b["title"])}</h4><p class="body">{e(b["body"])}</p>
{qbox(b["prompt"], b["options"], b["correct"], b.get("explanation"))}</article>''')
    out.append('</div>')
    if 'final_choice' in c:
        fc = c['final_choice']
        out.append(f'<h3>章末抉擇</h3><p class="q">{e(fc["prompt"])}</p><ul class="choice">' +
                   ''.join(f'<li><b>{e(fc[k]["title"])}</b><br>{e(fc[k]["detail"])}</li>'
                           for k in ('a', 'b') if k in fc) + '</ul>')
    out.append('</section>')

CSS = '''
:root{--ink:#14110e;--pa:#e8dfcd;--pa2:#c9bda3;--cin:#a8322a;--br:#8a6b3a;--jade:#4a7c6a}
*{box-sizing:border-box}body{margin:0;padding:2rem clamp(1rem,4vw,4rem);background:var(--ink);
color:var(--pa);font:16px/1.75 "Noto Sans TC","PingFang TC",system-ui,sans-serif;max-width:1500px;margin-inline:auto}
h1{font-size:1.9rem;border-bottom:2px solid var(--br);padding-bottom:.6rem}
h2{margin-top:3.5rem;font-size:1.5rem;color:#f0e6d2;border-left:5px solid var(--cin);padding-left:.7rem}
h3{margin-top:2rem;font-size:1.05rem;color:var(--br);letter-spacing:.1em}
h4{margin:.6rem 0 .3rem;font-size:1rem}
.lede,.sub,.meta{color:var(--pa2)}.sub{font-size:1.05rem;margin:.2rem 0 1rem}
.meta{font-size:.85rem;border-block:1px solid #3a332a;padding:.5rem 0}
img.bg{width:100%;border-radius:6px;display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.4rem}
.battles{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.2rem}
article{background:#1d1913;border:1px solid #332c22;border-radius:8px;padding:1rem}
article img{width:100%;border-radius:5px;margin-bottom:.5rem;display:block}
.pin{font-size:.72rem;color:var(--br);font-weight:400;white-space:nowrap}
.body{font-size:.9rem;color:#d6cbb4}
.q{font-weight:700;color:#f3ead6;margin:.7rem 0 .3rem}
.opts{margin:.2rem 0;padding-left:1.4rem;font-size:.9rem}
.opts li.ok{color:#8fd6b0;font-weight:700}
.opts li.ok::after{content:" ← 正解";font-size:.75rem;color:var(--jade)}
.note,.concept,.ev,.reveal,.resp,.route,.loss{font-size:.82rem;margin:.35rem 0}
.note{color:#b9ad93}.concept{color:var(--br)}.concept::before{content:"觀念｜"}
.ev{color:var(--jade)}
.reveal{color:#cfc4ab;border-top:1px dashed #3a332a;padding-top:.5rem}
.resp b,.route b,.dlg b{color:var(--cin);margin-right:.5em}
.route{color:#a99c82}.loss{color:#a8756e}
.dlg p{margin:.35rem 0;font-size:.9rem;color:#d6cbb4}
.choice{list-style:none;padding:0}.choice li{background:#1d1913;border:1px solid #332c22;
border-radius:6px;padding:.6rem .8rem;margin:.4rem 0;font-size:.9rem}
.choice .pin{float:right}
'''
open('digest.html', 'w').write(
    f'<!doctype html><meta charset="utf-8"><title>格物江湖錄 內容拆解</title><style>{CSS}</style>'
    + '\n'.join(out))
print('wrote digest.html', os.path.getsize('digest.html'), 'bytes')
