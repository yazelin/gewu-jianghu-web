#!/usr/bin/env python3
# 產生 design.html —— 完整設計/公式站(劇情/分支/答案/結局/成就),讀 data/game.json
import json, html, os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(R, 'data/game.json'), encoding='utf-8'))
e = lambda s: html.escape(str(s if s is not None else ''))
CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一']

def qbox(q, opts, correct, note='', concept=''):
    li = ''.join(f'<li class="{"ok" if i == correct else ""}">{e(o)}</li>' for i, o in enumerate(opts))
    x = f'<p class="q">{e(q)}</p><ol class="opts">{li}</ol>'
    if concept: x += f'<p class="concept">{e(concept)}</p>'
    if note: x += f'<p class="note">{e(note)}</p>'
    return x

# 注:此頁由 tools/gen_design.py 生成;重新生成後需重跑 promo-footer apply.py 補三件套 footer。
out = ['<h1>格物江湖錄:天理殘卷 — 設計與公式站</h1>',
       '<p class="lede">完整劇情、答案、A/B 分支、結局條件與成就判定,等同一份攻略。'
       '遊戲本體請見 <a href="index.html">index.html</a>。</p>',
       '<p class="lede">原作由物理老師 <a href="https://github.com/changyi123456" target="_blank" rel="noopener">@changyi123456</a> 製作,'
       '劇情/題目/美術著作權屬原作者,本網頁版經授權製作(見 SOURCE.md)。喜歡請支持原作者:'
       '<a href="https://www.instagram.com/aiphysicsteacher" target="_blank" rel="noopener">Instagram</a> · '
       '<a href="https://aiphysicsteacher123.bobaboba.me" target="_blank" rel="noopener">自由贊助</a>。</p>']

# ---- 目錄 ----
out.append('<nav class="toc"><b>目錄</b> ')
out.append(' · '.join([f'<a href="#c{c["id"]}">第{CN[c["id"]]}章</a>' for c in G['chapters']]))
out.append(' · <a href="#endings">結局</a> · <a href="#romance">情緣</a> · <a href="#seals">三印</a> · <a href="#ach">成就</a></nav>')

# ---- 序章 ----
p = G['prologue']
out.append('<section><h2>序章・鐘樓墜案</h2>')
out.append('<div class="dlg">' + ''.join(f'<p><b>{e(l["speaker"])}</b>{e(l["text"])}</p>' for l in p['narration']) + '</div>')
out.append('<div class="grid">')
for h in p['hotspots']:
    out.append(f'''<article><img src="{h["cell"]}" loading="lazy">
    <h4>{e(h["name"])}</h4><p class="body">{e(h["body"])}</p>
    {qbox(h["question"], h["options"], h["correct"], h.get("note"), h.get("concept"))}
    <p class="ev">證據：{e(h["evidence"])}</p></article>''')
out.append('</div>')
# 序章前置抉擇
if p.get('choice'):
    ch = p['choice']
    out.append(f'<h3>對白抉擇</h3><p class="q">{e(ch["prompt"])}</p><ul class="choice">' +
               ''.join(f'<li>{e(o["text"])}<span class="pin">好感 {e(o.get("relationship"))} {o.get("delta",0):+d}</span></li>' for o in ch['options']) + '</ul>')
# 序章破局(3 選擇 + 滑桿)
if p.get('battle'):
    out.append('<h3>破局戰（3 式選擇 + 終式滑桿）</h3><div class="battles">')
    for b in p['battle']:
        out.append(f'<article><h4>{e(b["title"])}</h4><p class="body">{e(b["body"])}</p>'
                   f'{qbox(b["prompt"], b["options"], b["correct"], b.get("explanation"))}</article>')
    s = p['slider']
    out.append(f'''<article><h4>{e(s["title"])}</h4><p class="body">{e(s["body"])}</p>
    <p class="q">{e(s["prompt"])}</p>
    <p class="note ok">正解：支點距離 ≥ {s["threshold"]} m（反向力矩＝300×10×距離，須達 {s["target"]} N·m）</p></article>''')
    out.append('</div>')
# 序章章末抉擇 + 三結局
if p.get('final_choice'):
    fc = p['final_choice']
    out.append(f'<h3>章末抉擇（決定第一章 A／B 線）</h3><ul class="choice">' +
               ''.join(f'<li><b>{e(o["text"])}</b><span class="pin">好感 {e(o["rel"])} {o["delta"]:+d}</span></li>' for o in fc['options']) + '</ul>')
    out.append('<p class="meta">案情強度＝理證 ≥ 3 且洞察 ≥ 3。救人＋強→鐘止人存（keeper_saved，章1 A 線）；'
               '追兇＋強→雨痕追兇（copper_seal，章1 B 線）；否則→殘鐘疑雲。</p>')
if p.get('endings'):
    out.append('<h3>序章結局</h3><div class="grid">')
    for eid, en in p['endings'].items():
        out.append(f'<article><h4>{e(en["title"])}</h4><p class="body">{e(en["text"])}</p>'
                   f'<p class="reveal">章末後續：{e(en["followup"])}</p></article>')
    out.append('</div>')
out.append('</section>')

# ---- 各章 ----
for c in G['chapters']:
    fe = G['logic']['final_effects'].get(str(c['id']), {})
    out.append(f'<section id="c{c["id"]}"><h2>{e(c["title"])}</h2><p class="sub">{e(c["subtitle"])}</p>')
    out.append(f'<img class="bg" src="{c["background"]}" loading="lazy">')
    out.append(f'<p class="meta">地點 {e(c["location"])}｜至少 {c["min_evidence"]} 證進破局｜'
               f'A 線「{e(c["route_a_name"])}」／B 線「{e(c["route_b_name"])}」'
               f'{"｜目標：" + e(c["goal"]) if c.get("goal") else ""}</p>')
    for k, lab in [('route_a_intro', 'A 線開場'), ('route_b_intro', 'B 線開場'), ('common_dialogue', '共通對白')]:
        if c.get(k):
            out.append(f'<h3>{lab}</h3><div class="dlg">' +
                       ''.join(f'<p><b>{e(l.get("speaker"))}</b>{e(l.get("text"))}</p>' for l in c[k]) + '</div>')
    if c.get('dialogue_choice'):
        d = c['dialogue_choice']
        out.append(f'<h3>對白抉擇</h3><p class="q">{e(d["prompt"])}</p><ul class="choice">' +
                   ''.join(f'<li>{e(o["text"])}<span class="pin">好感 {e(o.get("relationship"))} {o.get("delta",0):+d}'
                           f'{"｜旗標 " + e(o["flag"]) if o.get("flag") else ""}</span></li>' for o in d['options']) + '</ul>')
    out.append('<h3>六證(一次性作答)</h3><div class="grid">')
    for cl in c['clues']:
        rt = cl.get('route_text', {})
        extra = ''
        if cl.get('reveal'):
            extra += f'<p class="reveal"><b>{e(cl.get("reveal_speaker"))}</b>{e(cl["reveal"])}</p>'
        if rt:
            extra += ''.join(f'<p class="route"><b>{r} 線</b>{e(t)}</p>' for r, t in rt.items())
        if cl.get('loss'):
            extra += f'<p class="loss">答錯：{e(cl["loss"])}</p>'
        out.append(f'''<article><img src="{cl["cell"]}" loading="lazy">
        <h4>{e(cl["name"])}</h4><p class="body">{e(cl["body"])}</p>
        {qbox(cl["question"], cl["options"], cl["correct"], cl.get("note"), cl.get("concept"))}
        <p class="ev">證據：{e(cl["evidence"])}</p>{extra}</article>''')
    out.append('</div>')
    out.append('<h3>四場破局戰</h3><div class="battles">')
    for b in c['battles']:
        out.append(f'<article><h4>{e(b["title"])}</h4><p class="body">{e(b["body"])}</p>'
                   f'{qbox(b["prompt"], b["options"], b["correct"], b.get("explanation"))}</article>')
    out.append('</div>')
    if c.get('final_choice'):
        fc = c['final_choice']
        out.append(f'<h3>章末抉擇(決定分支與後果)</h3><p class="q">{e(fc["prompt"])}</p><ul class="choice">')
        for key in ('a', 'b'):
            if not fc.get(key): continue
            eff = fe.get(key, {})
            fl = '、'.join(f'{k}={"開" if v else "關"}' for k, v in (eff.get('flags') or {}).items())
            rl = '、'.join(f'{k}{v:+d}' for k, v in (eff.get('rel') or {}).items())
            out.append(f'<li><b>{e(fc[key]["title"])}</b><br>{e(fc[key]["detail"])}'
                       f'<span class="pin">旗標 {e(fl)}｜好感 {e(rl)}</span></li>')
        out.append('</ul>')
    out.append('</section>')

# ---- 結局 ----
out.append('<section id="endings"><h2>結局</h2>')
out.append('<h3>第九章・普通結局(4,依分數自動判定)</h3>')
out.append('<p class="meta">未選「可逆止機」→ 無名灰燼;否則比三方分數:'
           '人證(柳照微+江濯月+霍離)、入庫(顧玄策+寧觀瀾+零度母尺×3)、歸山(裴無咎×2+天理母鏡×2),最高者勝。'
           '第十章需「可逆止機 且 三印≥2」才解鎖。</p><div class="grid">')
for eid, en in G['endings_ch9'].items():
    out.append(f'<article><img src="{en["image"]}" loading="lazy"><h4>{e(en["title"])}</h4>'
               f'<p class="sub">{e(en["subtitle"])}</p><p class="body">{e(en["text"])}</p>'
               f'<p class="note">{e(en.get("epilogue"))}</p></article>')
out.append('</div>')
out.append('<h3>第十一章・完整版結局(4,依真結局解鎖+章末抉擇判定)</h3>')
out.append('<p class="meta">真結局「天地共衡」條件(缺一不可):三印全成 + 第十/十一章通關 + 否決條款 + 九路覆核 + '
           '第十一章選「萬手共衡」+ 至少 3 人深交(+3)+ 裴無咎≥1。'
           '否則:選萬手共衡→公議新尺;選四鑰定衡→四鑰守衡;其餘→無主長路。</p><div class="grid">')
for eid, en in G['endings_finale'].items():
    tag = '（真結局）' if eid == 'heaven_earth_shared' else ''
    out.append(f'<article><img src="{en["image"]}" loading="lazy"><h4>{e(en["title"])}{tag}</h4>'
               f'<p class="sub">{e(en["subtitle"])}</p><p class="body">{e(en["text"])}</p>'
               f'<p class="note">{e(en.get("epilogue"))}</p></article>')
out.append('</div></section>')

# ---- 情緣 ----
out.append('<section id="romance"><h2>情緣(柳照微/江濯月/蘇檀)</h2>')
out.append('<p class="meta">第九章許諾:登場且好感≥2。第十一章定局:好感≥4,或延續第九章許諾對象且好感≥2。</p><div class="grid">')
for name, r in G['romance']['candidates'].items():
    out.append(f'<article><h4>{e(name)} <span class="pin">{e(r["role"])}</span></h4>'
               f'<p class="body">{e(r["mid"])}</p><p class="reveal">{e(r["near"])}</p></article>')
out.append('</div></section>')

# ---- 三印 ----
out.append('<section id="seals"><h2>三印(seal_snapshot)</h2><ul class="rules">')
out.append('<li><b>人和印</b>:(好感≥2 者達 3 人且橫跨 2 立場)或(裴無咎≥4 且其餘好感≥1 者達 2 人)。'
           '立場:民=柳照微/江濯月/霍離、學=蘇檀/謝驚弦/寧觀瀾、律=顧玄策/祁望舒</li>')
out.append('<li><b>理證印</b>:通關章數≥7 且第 7、8、9 章皆完整通關</li>')
out.append('<li><b>殘卷印</b>:人證旗標≥2 且原器旗標≥2 且持有後段關鍵物(破鏡證詞/天理母鏡/百工盟冊/零度母尺 之一)</li>')
out.append('</ul></section>')

# ---- 成就 ----
ac = G['achievements']
COND = {
    'story_00_bell': '完成序章', 'story_01_workshop': '完成第一章', 'story_02_river': '完成第二章',
    'story_03_ridge': '完成第三章', 'story_04_forge': '完成第四章', 'story_05_thunder': '完成第五章',
    'story_06_stars': '完成第六章', 'story_07_mirror': '完成第七章', 'story_08_prison': '完成第八章',
    'story_09_tianli': '完成第九章並看見一個普通結局', 'story_10_tenth_line': '完成第十章',
    'story_11_shared_calibration': '完成第十一章',
    'mastery_six_evidence': '任一章取得六證', 'mastery_four_forms': '任一章四場破局戰全對',
    'mastery_perfect_chapter': '任一章六證且四戰全對', 'mastery_all_eleven_perfect': '第一至十一章皆六證且四戰全對',
    'mastery_grandmaster_finale': '在「宗師」難度完成第十一章', 'mastery_error_signed': '答對第十章「十代校準牆」與第十一章「四城誤差圖」',
    'relationship_lifebond': '任一人物好感達 +5', 'relationship_three_deep': '同時 3 人好感≥+3',
    'relationship_pei_reconciled': '裴無咎好感≥+4', 'relationship_nine_paths': '9 名登場人物皆好感≥+1',
    'seal_people': '完成人和印', 'seal_evidence': '完成理證印', 'seal_fragment': '完成殘卷印',
    'ending_all_normal': '看過 4 種普通結局', 'ending_all_complete': '看過 4 種完整版結局',
    'ending_true_shared': '達成真結局「天地共衡」',
    'system_defeat_return': '某章破局失敗後再通關', 'system_talisman_survivor': '定心符自動發動保命一次',
}
out.append(f'<section id="ach"><h2>成就(30)</h2>')
for ck, cat in ac['categories'].items():
    out.append(f'<h3>{e(cat["name"])}</h3><table class="ach"><tr><th>名稱</th><th>解鎖條件</th><th>稱號</th></tr>')
    for aid in ac['ordered']:
        a = ac['items'][aid]
        if a['category'] != ck: continue
        out.append(f'<tr><td>{e(a["title"])}</td><td>{e(COND.get(aid, a["hint"]))}</td><td>{e(a.get("title_reward", "—"))}</td></tr>')
    out.append('</table>')
out.append('</section>')

CSS = '''
:root{--ink:#14110e;--pa:#e8dfcd;--pa2:#c9bda3;--cin:#a8322a;--br:#8a6b3a;--jade:#5fa383;--danger:#c0564c}
*{box-sizing:border-box}body{margin:0;padding:2rem clamp(1rem,4vw,4rem);background:var(--ink);color:var(--pa);
font:16px/1.75 "Noto Sans TC","PingFang TC",system-ui,sans-serif;max-width:1500px;margin-inline:auto}
a{color:var(--br)}a:hover{color:var(--cin)}
h1{font-size:1.9rem;border-bottom:2px solid var(--br);padding-bottom:.6rem}
h2{margin-top:3rem;font-size:1.5rem;color:#f0e6d2;border-left:5px solid var(--cin);padding-left:.7rem;scroll-margin-top:1rem}
h3{margin-top:1.8rem;font-size:1.05rem;color:var(--br);letter-spacing:.08em}
h4{margin:.5rem 0 .3rem;font-size:1rem}
.lede,.sub,.meta{color:var(--pa2)}.sub{margin:.2rem 0 .8rem}
.meta{font-size:.85rem;border-block:1px solid #3a332a;padding:.5rem 0;line-height:1.8}
.toc{background:#1d1913;border:1px solid #332c22;border-radius:8px;padding:.8rem 1rem;font-size:.9rem;margin:1rem 0;line-height:2}
img.bg{width:100%;border-radius:6px;display:block;margin:.5rem 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.2rem}
.battles{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
article{background:#1d1913;border:1px solid #332c22;border-radius:8px;padding:1rem}
article img{width:100%;border-radius:5px;margin-bottom:.5rem;display:block}
.pin{display:block;font-size:.75rem;color:var(--br);margin-top:.3rem}
.body{font-size:.9rem;color:#d6cbb4}
.q{font-weight:700;color:#f3ead6;margin:.6rem 0 .3rem}
.opts{margin:.2rem 0;padding-left:1.4rem;font-size:.9rem}
.opts li.ok{color:#8fd6b0;font-weight:700}.opts li.ok::after{content:" ← 正解";font-size:.75rem;color:var(--jade)}
.note,.concept,.ev,.reveal,.route,.loss{font-size:.82rem;margin:.3rem 0}
.note{color:#b9ad93}.concept{color:var(--br)}.concept::before{content:"觀念｜"}.ev{color:var(--jade)}
.reveal b,.route b,.dlg b{color:var(--cin);margin-right:.4em}.route{color:#a99c82}.loss{color:#a8756e}
.dlg p{margin:.3rem 0;font-size:.9rem;color:#d6cbb4}
.choice{list-style:none;padding:0}.choice li{background:#1d1913;border:1px solid #332c22;border-radius:6px;padding:.6rem .8rem;margin:.4rem 0;font-size:.9rem}
.rules{padding-left:1.2rem}.rules li{margin:.5rem 0;font-size:.92rem}.rules b{color:#f3ead6}
table.ach{width:100%;border-collapse:collapse;font-size:.88rem;margin:.4rem 0}
table.ach th,table.ach td{border:1px solid #332c22;padding:.5rem .7rem;text-align:left}
table.ach th{color:var(--br);background:#1d1913}table.ach td:first-child{color:#f3ead6;white-space:nowrap}
'''
OG = 'https://yazelin.github.io/gewu-jianghu-web'
HEAD = (
    '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>格物江湖錄:天理殘卷 — 設計與公式站(攻略)</title>'
    '<meta name="description" content="《格物江湖錄:天理殘卷》完整攻略:全題答案、A/B 分支、結局判定與 30 成就條件。">'
    '<link rel="canonical" href="' + OG + '/design.html">'
    '<meta property="og:type" content="article">'
    '<meta property="og:title" content="格物江湖錄:天理殘卷 — 設計與公式站">'
    '<meta property="og:description" content="完整劇情、答案、A/B 分支、結局判定與 30 成就條件。">'
    '<meta property="og:image" content="' + OG + '/assets/og.jpg">'
    '<meta property="og:url" content="' + OG + '/design.html">'
    '<meta name="twitter:card" content="summary_large_image">'
    '<meta name="twitter:title" content="格物江湖錄:天理殘卷 — 設計與公式站">'
    '<meta name="twitter:image" content="' + OG + '/assets/og.jpg">'
    '<style>' + CSS + '</style></head><body>')
doc = HEAD + '\n'.join(out) + '</body></html>'
open(os.path.join(R, 'design.html'), 'w', encoding='utf-8').write(doc)
print('wrote design.html', len(doc) // 1024, 'KB')
