#!/usr/bin/env python3
# 產生 design.html —— 完整設計/公式站(劇情/分支/答案/結局/成就),讀 data/game.json
import json, html, os, re

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(R, 'data/game.json'), encoding='utf-8'))
e = lambda s: html.escape(str(s if s is not None else ''))
CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一']

# 攻略站縮圖:全解析度美術當小圖用,整頁滑完要多載好幾 MB(實測 9.3MB → 5.1MB)。
# 尺寸=2×實測顯示尺寸(2x 螢幕剛好夠)。data-thumb-kind 讓 gen_thumbs.py 知道照哪組規格縮,
# width/height 一併寫進標籤:瀏覽器才算得出版面、捲動時不會一路跳,也是 gen_thumbs.py 的驗收基準。
# 改了版面就要重量顯示尺寸(見 tools/gen_thumbs.py 註解)。
THUMB_2X = {'who': (208, 284), 'ending': (692, 389)}


def imgtag(src, cls=''):
    """原尺寸就用的圖(證物切格 440x372 顯示 346px、章節背景 1672x941 顯示 1178px,
    都只有 1.3~1.4 倍,縮了在 2x 螢幕會軟,所以不縮)。但一定要寫 width/height:
    沒寫的話瀏覽器算不出版面,113 張 lazy 圖一路載進來時整頁會不停跳,
    看起來就像「一直在載」——這比實際位元組數更像卡。"""
    from PIL import Image as _I
    w, h = _I.open(os.path.join(R, src)).size
    c = f' class="{cls}"' if cls else ''
    return f'<img{c} src="{src}" width="{w}" height="{h}" loading="lazy" decoding="async">'


def thumb(src, kind, alt=''):
    w, h = THUMB_2X[kind]
    a = ' alt="' + alt + '"' if alt else ''
    return (f'<img src="assets/thumb/{os.path.basename(src)}" data-thumb-kind="{kind}"'
            f' width="{w}" height="{h}" loading="lazy" decoding="async"{a}>')


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
out.append(' · <a href="#endings">結局</a> · <a href="#romance">情緣</a> · <a href="#seals">三印</a> · <a href="#ach">成就</a>')
out.append('<br><b>人物</b> <a href="#people">人物誌(好感增減全出處)</a> · <a href="#sages">格物先賢譜</a>'
           ' · <a href="#route">真結局路線(全章推薦選擇)</a> · <a href="#ab">A／B 線判定</a></nav>')

# ---- 人物誌(全部由 game.json 推導:立場/登場/台詞/好感出處)----
LADDER, CAMP = G['logic']['rel_ladder'], G['logic']['camp_map']
CAMP_NAME = {'民': '民間', '學': '學者', '律': '律法'}
GATE = {'江濯月': 2, '顧玄策': 3, '霍離': 4, '謝驚弦': 5, '寧觀瀾': 6}   # engine.js relIntroduced

# 登場白(第一句台詞)與台詞數
first_say, n_say = {}, {}
def _say(lines, where):
    for l in lines or []:
        s = l.get('speaker')
        if not s or s == '旁白': continue
        n_say[s] = n_say.get(s, 0) + 1
        first_say.setdefault(s, (where, l.get('text', '')))
_say(G['prologue'].get('narration'), '序章')
for c in G['chapters']:
    for k in ('route_a_intro', 'route_b_intro', 'common_dialogue'):
        _say(c.get(k), c['title'])
    for cl in c['clues']:
        if cl.get('reveal_speaker'):
            _say([{'speaker': cl['reveal_speaker'], 'text': cl['reveal']}], c['title'])

# 好感增減全出處:(抉擇點, 章, 說明, 增減);同一抉擇點只能擇一
rel_ev = {}
def _ev(name, pt, where, label, d):
    rel_ev.setdefault(name, []).append((pt, where, label, d))
for o in (G['prologue'].get('choice') or {}).get('options', []):
    if o.get('relationship'): _ev(o['relationship'], 'p-dlg', '序章', '對白：' + o['text'], o.get('delta', 0))
for o in (G['prologue'].get('final_choice') or {}).get('options', []):
    if o.get('rel'): _ev(o['rel'], 'p-fin', '序章', '章末：' + o['text'], o['delta'])
for c in G['chapters']:
    for o in (c.get('dialogue_choice') or {}).get('options', []):
        if o.get('relationship'): _ev(o['relationship'], f'{c["id"]}-dlg', c['title'], '對白：' + o['text'], o.get('delta', 0))
    for key in ('a', 'b'):
        for n, d in (G['logic']['final_effects'].get(str(c['id']), {}).get(key, {}).get('rel') or {}).items():
            _ev(n, f'{c["id"]}-fin', c['title'], '章末：' + c['final_choice'][key]['title'], d)

def rel_max(name):                       # 每個抉擇點取最佳(可全避開負值)
    best = {}
    for pt, _w, _l, d in rel_ev.get(name, []):
        best[pt] = max(best.get(pt, 0), d)
    return sum(v for v in best.values() if v > 0)

lad = '｜'.join(f'{"更低" if t < -50 else ("0" if t == 0 else f"{t:+d}")} {n}' for t, n in LADDER)
out.append('<section id="people"><h2>人物誌(9 名同行者 + 沈硯)</h2>')
out.append('<p class="sub">每個人的立場、登場、以及「好感從哪裡來」的完整出處——好感決定三印、結局分數與情緣。</p>')
out.append(f'<p class="meta">好感階梯:{e(lad)}｜好感範圍 {G["affinity_range"][0]}～{G["affinity_range"][1]}</p>')
out.append('<h3>關係總表</h3><ul class="rules">')
out.append('<li><b>折衡門師徒</b>:沈硯(末徒、玩家視角)—裴無咎(師父)。序章即失蹤，第七章才現身；'
           '定位固定為「師徒羈絆」，不進情緣，但真結局要求裴無咎好感 ≥1，普通結局「歸山」分數算他兩倍。</li>')
out.append('<li><b>三立場(人和印判定用)</b>:' +
           '；'.join(f'{CAMP_NAME[k]}={"／".join(n for n, v in CAMP.items() if v == k)}' for k in ('民', '學', '律')) +
           '。人和印要好感 ≥2 者達 3 人且橫跨 2 立場。</li>')
out.append(f'<li><b>情緣候選</b>:{"／".join(G["romance"]["order"])}(詳見 <a href="#romance">情緣</a>)；'
           '其餘登場者定位為「重要同伴」。</li>')
out.append('<li><b>登場門檻</b>:' + '、'.join(f'{n} 第{CN[c]}章' for n, c in GATE.items()) +
           '；未到章數前顯示「尚未相識」，好感也不列入「九路同行」成就。</li>')
out.append('</ul>')
out.append('<h3>人物卡(含好感增減全出處)</h3><div class="grid">')
for name in ['沈硯'] + [p['name'] for p in G['people']]:
    if name in G['romance']['candidates']:
        pos = '情緣候選・' + G['romance']['candidates'][name]['role']
    elif name == '沈硯': pos = '主角・折衡門末徒'
    elif name == '裴無咎': pos = '師徒羈絆'
    else: pos = '重要同伴'
    camp = CAMP_NAME.get(CAMP.get(name), '折衡門' if name in ('沈硯', '裴無咎') else '—')
    where, line = first_say.get(name, ('—', ''))
    meta = f'{camp}｜首次開口 {where}｜台詞 {n_say.get(name, 0)} 句'
    rows = ''
    for _pt, w, lab, d in rel_ev.get(name, []):
        rows += (f'<tr><td>{e(w)}</td><td>{e(lab)}</td>'
                 f'<td class="d{" neg" if d < 0 else ""}">{d:+d}</td></tr>')
    tot = rel_max(name)
    cap = min(tot, G['affinity_range'][1])
    warn = '' if cap >= 5 else f'——好感永遠到不了 +5，「生死相託」成就不能由這條線取得{"；情緣定局需 ≥4，只剩零容錯" if name in G["romance"]["candidates"] and cap == 4 else ""}'
    tail = (f'<table class="rel"><tr><th>章</th><th>抉擇</th><th>好感</th></tr>{rows}</table>'
            f'<p class="note">實際可達上限 <b>+{cap}</b>{e(warn)}(每個抉擇點取最佳可得 +{tot}，'
            f'但好感夾在 {G["affinity_range"][0]}～{G["affinity_range"][1]}；同章對白與章末各算一次，A／B 只能擇一)</p>') if rows else \
           ('<p class="note">沈硯是玩家視角，沒有自己的好感值；'
            '所有抉擇改變的是別人怎麼看他。</p>' if name == '沈硯' else '<p class="note">全章沒有好感增減出處。</p>')
    out.append(f'<article><div class="who">{thumb(G["portraits"][name], "who", e(name))}'
               f'<div><h4>{e(name)}</h4><p class="pin">{e(pos)}<br>{e(meta)}</p></div></div>'
               f'<p class="qt">{e(line)}</p>{tail}</article>')
out.append('</div></section>')

# ---- 格物先賢譜(遊戲內圖鑑,純觀念索引)----
SC = G['scientists']
out.append('<section id="sages"><h2>格物先賢譜(9 位)</h2>')
out.append('<p class="sub">遊戲主選單與每章右上「先賢譜」可開。它<b>不影響任何數值</b>——沒有加成、沒有解鎖、不進成就。</p>')
out.append('<p class="meta">實際用途有三:①<b>本章觀念索引</b>——開圖時「鎏金」的節點就是本回要用的物理線,'
           '不確定該往哪個方向想時可以當提示;②<b>觀念系譜</b>——青線＝概念承接、朱線＝同期爭論／競逐,'
           '看得出章與章之間的物理是怎麼接起來的;③結局工作人員名單「特別感謝・格物先賢」依年代排序帶過一次。</p>')
out.append('<h3>各章鎏金(本回相關先賢)</h3><ul class="rules">')
for ch, ids in SC['active_by_chapter'].items():
    out.append(f'<li><b>第{CN[int(ch)]}章</b>:{"、".join(SC["nodes"][i]["name"] for i in ids)}</li>')
out.append(f'<li><b>其餘章回(預設)</b>:{"、".join(SC["nodes"][i]["name"] for i in SC["active_default"])}</li>')
out.append('</ul>')
out.append('<h3>觀念承接線</h3><ul class="rules">')
for ed in SC['edges']:
    out.append(f'<li>{e(SC["nodes"][ed["from"]]["name"])} → {e(SC["nodes"][ed["to"]]["name"])}'
               f'：{"同期爭論／競逐(朱線)" if ed["color"] == "cinnabar" else "概念承接(青線)"}</li>')
out.append('</ul>')
out.append('<h3>先賢卡(圖上由左至右依年代)</h3><div class="grid">')
for sid in SC.get('chrono', SC['order']):
    n = SC['nodes'][sid]
    out.append(f'<article><div class="who">{thumb(f"assets/img/sage_{sid}.webp", "who", e(n["name"]))}'
               f'<div><h4>{e(n["name"])}</h4><p class="pin">{e(n["years"])}<br>{e(n["chapter"])}</p></div></div>'
               f'<p class="body">{e(n["detail"])}</p></article>')
out.append('</div></section>')

# ---- 序章 ----
p = G['prologue']
out.append('<section><h2>序章・鐘樓墜案</h2>')
out.append('<div class="dlg">' + ''.join(f'<p><b>{e(l["speaker"])}</b>{e(l["text"])}</p>' for l in p['narration']) + '</div>')
out.append('<div class="grid">')
for h in p['hotspots']:
    out.append(f'''<article>{imgtag(h["cell"])}
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
    out.append(imgtag(c["background"], 'bg'))
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
        out.append(f'''<article>{imgtag(cl["cell"])}
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
    out.append(f'<article>{thumb(en["image"], "ending")}<h4>{e(en["title"])}</h4>'
               f'<p class="sub">{e(en["subtitle"])}</p><p class="body">{e(en["text"])}</p>'
               f'<p class="note">{e(en.get("epilogue"))}</p></article>')
out.append('</div>')
out.append('<h3>第十一章・完整版結局(4,依真結局解鎖+章末抉擇判定)</h3>')
out.append('<p class="meta">真結局「天地共衡」條件(缺一不可):三印全成 + 第十/十一章通關 + 否決條款 + 九路覆核 + '
           '第十一章選「萬手共衡」+ 至少 3 人深交(+3)+ 裴無咎≥1。'
           '否則:選萬手共衡→公議新尺;選四鑰定衡→四鑰守衡;其餘→無主長路。</p><div class="grid">')
for eid, en in G['endings_finale'].items():
    tag = '（真結局）' if eid == 'heaven_earth_shared' else ''
    out.append(f'<article>{thumb(en["image"], "ending")}<h4>{e(en["title"])}{tag}</h4>'
               f'<p class="sub">{e(en["subtitle"])}</p><p class="body">{e(en["text"])}</p>'
               f'<p class="note">{e(en.get("epilogue"))}</p></article>')
out.append('</div></section>')

# ---- 情緣 ----
ROM = G['romance']
out.append('<section id="romance"><h2>情緣(3 人:柳照微／江濯月／蘇檀)</h2>')
out.append('<p class="sub">情緣只有這三人。裴無咎固定「師徒羈絆」，其餘登場者固定「重要同伴」，'
           '不論好感多高都不會進情緣。</p>')
out.append('<h3>判定規則</h3><ul class="rules">')
out.append('<li><b>第九章「許諾」</b>:通關第九章後跳選擇——候選＝已登場且好感 ≥2 的情緣人選;'
           '可以不選(獨行)。順序固定為 ' + '／'.join(ROM['order']) + '。</li>')
out.append('<li><b>第十一章「定局」</b>:候選＝好感 ≥4;'
           '或第九章已許諾同一人且好感仍 ≥2(等於許諾可以用較低的好感續約)。</li>')
out.append('<li><b>可行性</b>:' + '；'.join(
    f'{n}(登場 {"序章" if ROM["candidates"][n]["first_chapter"] == 0 else "第" + CN[ROM["candidates"][n]["first_chapter"]] + "章"}'
    f'、可達上限 +{min(rel_max(n), G["affinity_range"][1])})' for n in ROM['order']) +
    '。江濯月上限剛好等於定局門檻 +4，且第二章章末選「踏浪追船」是 −2，等於直接出局。</li>')
out.append('<li><b>沒選任何人</b>也有專屬收尾(獨行結語)，不是缺漏。</li>')
out.append('</ul>')
out.append('<h3>三人的四段情話 + 結局</h3><div class="grid">')
for name in ROM['order']:
    r = ROM['candidates'][name]
    fch = '序章登場' if r['first_chapter'] == 0 else '第' + CN[r['first_chapter']] + '章登場'
    out.append(f'<article><div class="who">{thumb(G["portraits"][name], "who", e(name))}'
               f'<div><h4>{e(name)}</h4><p class="pin">{e(r["role"])}<br>{fch}｜'
               f'可達上限 +{min(rel_max(name), G["affinity_range"][1])}</p></div></div>'
               f'<p class="qt">{e(r["mid"])}</p><p class="qt">{e(r["near"])}</p><p class="qt">{e(r["after"])}</p>'
               f'<p class="reveal"><b>普通結局</b>{e(r["normal"])}</p>'
               f'<p class="route"><b>完整版結局</b>{e(r["finale"])}</p></article>')
out.append('</div>')
out.append(f'<p class="meta"><b>獨行(不結情緣)</b>｜普通結局:{e(ROM["solo_normal"])}'
           f'　完整版:{e(ROM["solo_finale"])}</p></section>')

# ---- 三印 ----
out.append('<section id="seals"><h2>三印(seal_snapshot)</h2><ul class="rules">')
out.append('<li><b>人和印</b>:(好感≥2 者達 3 人且橫跨 2 立場)或(裴無咎≥4 且其餘好感≥1 者達 2 人)。'
           '立場:民=柳照微/江濯月/霍離、學=蘇檀/謝驚弦/寧觀瀾、律=顧玄策/祁望舒</li>')
out.append('<li><b>理證印</b>:通關章數≥7 且第 7、8、9 章皆完整通關</li>')
out.append('<li><b>殘卷印</b>:人證旗標≥2 且原器旗標≥2 且持有後段關鍵物(破鏡證詞/天理母鏡/百工盟冊/零度母尺 之一)</li>')
out.append('</ul></section>')

# ---- 路線求解:用 game.json 的規則跑出一條真結局路線,並在生成時驗證 ----
# 抉擇點:(key, 章, [(選項 id, 說明, 好感, 旗標) × 2]);順序＝實際遊玩順序
DEC = []
_pc, _pf = G['prologue']['choice'], G['prologue']['final_choice']
DEC.append(('P-dlg', '序章', [(o['id'], '對白：' + o['text'], {o['relationship']: o.get('delta', 0)}, {})
                              for o in _pc['options']]))
# 序章旗標由 prologueResolve 依「案情強度」給:救人＋強→keeper_saved、追兇＋強→copper_seal
DEC.append(('P-fin', '序章', [(o['id'], '章末：' + o['text'], {o['rel']: o['delta']},
                               {'prologue_case_strong': True,
                                ('keeper_saved' if o['id'] == 'rescue' else 'copper_seal'): True})
                              for o in _pf['options']]))
for c in G['chapters']:
    DEC.append((f'{c["id"]}-dlg', c['title'],
                [(o['id'], '對白：' + o['text'], {o['relationship']: o.get('delta', 0)},
                  {o['flag']: True} if o.get('flag') else {}) for o in c['dialogue_choice']['options']]))
    fx = G['logic']['final_effects'][str(c['id'])]
    DEC.append((f'{c["id"]}-fin', c['title'],
                [(c['final_choice'][k]['id'], '章末：' + c['final_choice'][k]['title'],
                  fx[k].get('rel', {}), fx[k].get('flags', {})) for k in ('a', 'b')]))
FIN_KEYS = [k for k, _c, _o in DEC if k.endswith('-fin')]
DLG_KEYS = [k for k, _c, _o in DEC if k.endswith('-dlg')]
LO, HI = G['affinity_range']

def simulate(plan):
    rel, flags, chosen, snap9 = {}, {}, {}, None
    for key, _ch, opts in DEC:
        oid, _lab, r, f = opts[plan[key]]
        for n, d in r.items(): rel[n] = max(LO, min(HI, rel.get(n, 0) + d))
        flags.update(f)
        chosen[key] = oid
        if key == '9-fin': snap9 = (dict(rel), dict(flags))
    return rel, flags, chosen, snap9

def seal_snapshot(rel, flags):                     # 忠實對照 engine.js sealSnapshot()
    L = G['logic']
    pos = [n for n in CAMP if rel.get(n, 0) >= 2]
    modest = sum(1 for n, v in rel.items() if n != '裴無咎' and v >= 1)
    people = (len(pos) >= 3 and len({CAMP[n] for n in pos}) >= 2) or (rel.get('裴無咎', 0) >= 4 and modest >= 2)
    evidence = True                                # 序章+11 章全通關 → 通關數 ≥7 且 7/8/9 皆 clear
    frag = (sum(1 for f in L['people_flags'] if flags.get(f)) >= 2
            and sum(1 for f in L['standard_flags'] if flags.get(f)) >= 2
            and any(flags.get(f) for f in L['late_keys']))
    return {'people': people, 'evidence': evidence, 'fragment': frag,
            'count': sum([people, evidence, frag])}

def audit(plan):                                   # 這條路線拿得到什麼(全部照引擎規則算)
    rel, flags, chosen, snap9 = simulate(plan)
    s9 = seal_snapshot(*snap9)
    s = seal_snapshot(rel, flags)
    deep = sum(1 for v in rel.values() if v >= 3)
    gate10 = chosen['9-fin'] == 'reversible_shutdown' and s9['count'] >= 2       # hiddenRouteUnlocked
    true_end = bool(gate10 and s['count'] >= 3 and flags.get('veto_clause_restored')
                and flags.get('allies_crosschecked_final')
                and chosen['11-fin'] == 'open_shared_standard'
                and deep >= 3 and rel.get('裴無咎', 0) >= 1)                     # trueEndingUnlocked
    r9, f9 = snap9                                 # 第九章普通結局:suggestedEnding() 三方比分
    ppl = r9.get('柳照微', 0) + r9.get('江濯月', 0) + r9.get('霍離', 0)
    arc = r9.get('顧玄策', 0) + r9.get('寧觀瀾', 0) + (3 if f9.get('zero_standard_secured') else 0)
    mnt = r9.get('裴無咎', 0) * 2 + (2 if f9.get('master_mirror_secured') else 0)
    normal = ('nameless_ashes' if chosen['9-fin'] != 'reversible_shutdown' else
              'people_witness' if ppl >= arc and ppl >= mnt else
              'archive_sealed' if arc >= mnt else 'return_mountain')
    return {'rel': rel, 'flags': flags, 'chosen': chosen, 'seals': s, 'seals9': s9,
            'normal': normal, 'score9': (ppl, arc, mnt),
            'deep': deep, 'gate10': gate10, 'true': true_end,
            'nine': sum(1 for p in G['people'] if rel.get(p['name'], 0) >= 1),
            'top': max(rel.values()), 'pei': rel.get('裴無咎', 0)}

def score(a):                                      # 真結局優先,其次盡量多刷人物成就
    return (a['true'], a['gate10'], a['nine'], min(a['deep'], 9), a['top'], a['pei'])

best = None
for mask in range(1 << len(FIN_KEYS)):             # 12 個章末抉擇全枚舉
    plan = {k: (mask >> i) & 1 for i, k in enumerate(FIN_KEYS)}
    plan.update({k: 0 for k in DLG_KEYS})
    for _ in range(3):                             # 對白抉擇:逐點爬山(只影響好感與少數旗標)
        for k in DLG_KEYS:
            cur = score(audit(plan))
            plan[k] ^= 1
            if score(audit(plan)) <= cur: plan[k] ^= 1
    a = audit(plan)
    if best is None or score(a) > score(best[1]): best = (dict(plan), a)
PLAN, AUD = best
if not AUD['true']:
    raise SystemExit('求解失敗:找不到能解真結局的路線,先檢查 game.json 是否改過')

out.append('<section id="route"><h2>真結局路線(全章推薦選擇)</h2>')
out.append('<p class="sub">這張表是用 data/game.json 的判定規則直接解出來的,'
           '生成頁面時會重跑一次驗證——解不出真結局就不會產出這一節。</p>')
out.append('<p class="meta">前提:每章六證全取、破局戰四場全對(序章需理證 ≥3 且洞察 ≥3 才拿得到 keeper_saved)。'
           f'照著選的結果:三印 3／3、深交(好感 ≥3)共 {AUD["deep"]} 人、九路(好感 ≥1){AUD["nine"]}／9、'
           f'裴無咎 {AUD["pei"]:+d}、最高好感 +{AUD["top"]}。</p>')
out.append('<table class="ach"><tr><th>章</th><th>對白抉擇</th><th>章末抉擇</th><th>這一步拿到什麼</th></tr>')
_rows = {}
for key, ch, opts in DEC:
    oid, lab, r, f = opts[PLAN[key]]
    gain = '、'.join([f'{n} {d:+d}' for n, d in r.items()] +
                     [('旗標 ' + k) for k, v in f.items() if v])
    _rows.setdefault(ch, {})[key[-3:]] = (lab.split('：', 1)[1], gain)
for ch in dict.fromkeys(c for _k, c, _o in DEC):
    d, fn = _rows[ch].get('dlg', ('—', '')), _rows[ch].get('fin', ('—', ''))
    out.append(f'<tr><td>{e(ch)}</td><td>{e(d[0])}</td><td>{e(fn[0])}</td>'
               f'<td>{e("；".join(x for x in (d[1], fn[1]) if x))}</td></tr>')
out.append('</table>')
out.append('<h3>這條路線的驗算</h3><ul class="rules">')
out.append('<li><b>最終好感</b>:' + '、'.join(f'{p["name"]} {AUD["rel"].get(p["name"], 0):+d}' for p in G['people']) + '</li>')
out.append(f'<li><b>三印</b>:人和印 {"成" if AUD["seals"]["people"] else "未成"}、'
           f'理證印 {"成" if AUD["seals"]["evidence"] else "未成"}(全章通關即得)、'
           f'殘卷印 {"成" if AUD["seals"]["fragment"] else "未成"} → 共 {AUD["seals"]["count"]}／3</li>')
out.append(f'<li><b>第十章隱藏門扉</b>:第九章選「折衡止機」且當下三印 ≥2(此路線為 {AUD["seals9"]["count"]}) → '
           f'{"開啟" if AUD["gate10"] else "不開"}</li>')
out.append('<li><b>真結局七項</b>:三印 3、通關第十／十一章、旗標 veto_clause_restored(第十章「還人一票」)、'
           '旗標 allies_crosschecked_final(第十一章對白「交給柳照微與九路同行者分段交叉覆核」)、'
           '第十一章章末選「萬手共衡」、深交 ≥3 人、裴無咎 ≥1 —— 本路線全部滿足。</li>')
_p, _a, _m = AUD['score9']
out.append(f'<li><b>第九章普通結局</b>(順帶算出):人證 {_p}(柳照微＋江濯月＋霍離)、'
           f'入庫 {_a}(顧玄策＋寧觀瀾＋零度母尺×3)、歸山 {_m}(裴無咎×2＋天理母鏡×2) → '
           f'「{e(G["endings_ch9"][AUD["normal"]]["title"])}」;此結局同時讓第十章走 A 線。</li>')
out.append('<li><b>情緣</b>:此路線柳照微 +5、江濯月 ' + f'{AUD["rel"].get("江濯月", 0):+d}' +
           '、蘇檀 ' + f'{AUD["rel"].get("蘇檀", 0):+d}' + '，第十一章定局門檻 ≥4，'
           '所以三人之中誰能定局，看你這局把好感投在哪一條。</li>')
out.append('</ul></section>')

# ---- A／B 線判定 ----
FLAG_SRC = {}
for key, ch, opts in DEC:
    for oid, lab, _r, f in opts:
        for fl, v in f.items():
            if v: FLAG_SRC.setdefault(fl, f'{ch}{lab}')
out.append('<section id="ab"><h2>A／B 線是怎麼決定的</h2>')
out.append('<p class="sub">每章開場走 A 線還是 B 線，不是選單選的，是進章當下用旗標算出來的('
           'engine.js <code>routeFor</code>)：條件全中(all)或任一中(any)就是 A 線，否則 B 線。'
           'A/B 只換開場、線索敘述與可用的活證，六證與破局戰題目相同。</p>')
out.append('<table class="ach"><tr><th>章</th><th>A 線</th><th>B 線</th><th>A 線條件(旗標來自)</th></tr>')
for c in G['chapters']:
    cond = G['logic']['route_table'].get(str(c['id']), {})
    kind = 'all' if 'all' in cond else 'any'
    parts = []
    for f in cond.get(kind, []):
        if f.startswith('ending:'): parts.append(f'第九章普通結局＝{e(G["endings_ch9"][f[7:]]["title"])}')
        elif f.startswith('seal:'): parts.append('已成人和印')
        else: parts.append(f'{f}(來自 {FLAG_SRC.get(f, "序章案情強度")})')
    join = ' 且 ' if kind == 'all' else ' 或 '
    out.append(f'<tr><td>第{CN[c["id"]]}章</td><td>{e(c["route_a_name"])}</td><td>{e(c["route_b_name"])}</td>'
               f'<td>{join.join(parts)}</td></tr>')
out.append('</table>')
out.append('<p class="meta">看得出規律:A 線＝上一章選了「救人／護證／公開」那一邊，B 線＝選了「奪物／追兇／封存」那一邊。'
           '第十章比較特別——用第九章的普通結局或人和印二擇一;第十一章看第十章有沒有接回否決條款。</p></section>')

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
_deep = [n for n in AUD['rel'] if AUD['rel'][n] >= 3]
_five = [n for n in AUD['rel'] if AUD['rel'][n] >= 5]
_route = '照「<a href="#route">真結局路線</a>」走即可'
SOLVE = {
    'mastery_six_evidence': '任一章六證全答對。六證是一次性作答、答錯不能重來,照本站該章六證的「← 正解」選。',
    'mastery_four_forms': '任一章四場破局戰全對(破局戰答錯會扣氣勢,不會鎖住成就,可重來該章)。',
    'mastery_perfect_chapter': '同一章同時做到六證 + 四戰全對(通關小卡會出現「格物無漏」)。',
    'mastery_all_eleven_perfect': '第一到十一章每章都「格物無漏」——含第十、十一章,所以必須先走通真結局路線解鎖後段。',
    'mastery_grandmaster_finale': '難度選「宗師」(無提示、只給規則)並通關第十一章;'
                                  '前置是先解鎖第十章隱藏門扉,' + _route + '。',
    'mastery_error_signed': '第十章「十代校準牆」與第十一章「四城誤差圖」這兩件證物都要答對(其他證物答錯不影響本條)。',
    'relationship_lifebond': f'任一人好感 +5。{_route}——這條路線走完 {"、".join(_five)} 都是 +5;'
                             '最快的是柳照微:序章章末「救人」+2、第一章對白「先解鎖療傷」+1、'
                             '第一章章末「護學徒」+2,第一章結束就 +5。',
    'relationship_three_deep': f'同時 3 人好感 ≥+3。{_route}——該路線 9 人全部 ≥+3(共 {len(_deep)} 人),遠超門檻。',
    'relationship_pei_reconciled': f'裴無咎 ≥+4(不是 ≥1)。他的好感只給「奪物線」:第五章「截取磁圖」+2、'
                                   f'第六章「入庫奪圖」+2、第七章「藏鏡追源」+2 是三個大頭;'
                                   f'{_route}可拿到 {AUD["rel"].get("裴無咎", 0):+d}。',
    'relationship_nine_paths': f'9 人都要登場且好感 ≥+1(寧觀瀾第六章才登場,所以至少要打到第六章以後)。'
                               f'{_route}——該路線 {AUD["nine"]}／9 全中。',
    'seal_people': '好感 ≥+2 者達 3 人且橫跨 2 個立場(民/學/律)。最省力是「柳照微+霍離(民)+顧玄策或蘇檀(學或律)」;'
                   '或走師徒線:裴無咎 ≥+4 且另有 2 人 ≥+1。',
    'seal_evidence': '通關章數 ≥7 且第七、八、九章都完整通關——正常一路打下來就會有,不用特別繞。',
    'seal_fragment': '人證旗標 ≥2(救鐘守/護學徒/救乘客/護證人/救工匠/保盟眾/救觀測生/公開鏡證/百工出獄/眾證網)'
                     '＋原器旗標 ≥2(銅印/名冊/殘頁/暗碼/熱核/磁圖/星圖/母鏡/零度尺/原器鏈)'
                     '＋後段關鍵物之一(公開鏡證/天理母鏡/百工盟冊/零度母尺)。'
                     '重點:救人線與奪物線要各拿幾章,全救或全奪都會缺一邊。',
    'ending_all_normal': '四種普通結局要看過 4 次。結局不是選的,是用第九章當下的三方分數算的('
                         '人證＝柳照微＋江濯月＋霍離、入庫＝顧玄策＋寧觀瀾＋零度母尺×3、'
                         '歸山＝裴無咎×2＋天理母鏡×2,最高者勝;第九章選「斷軸焚卷」則直接是無名灰燼)。'
                         '成就與結局紀錄存在收藏庫、跨局累積,所以分幾輪刷沒關係。',
    'ending_all_complete': '四種完整版結局:真結局「天地共衡」、第十一章選萬手共衡但條件不全→公議新尺、'
                           '選四鑰定衡→四鑰守衡、其餘→無主長路。同樣跨局累積。',
    'ending_true_shared': '真結局七項缺一不可:三印全成、通關第十與十一章、第十章接回否決條款、'
                          '第十一章對白選九路交叉覆核、第十一章章末選萬手共衡、3 人好感 ≥+3、裴無咎 ≥+1。'
                          + _route + '(整張表已驗算過)。',
    'system_defeat_return': '故意在某章破局戰輸掉(氣勢歸零),再重打該章通關即可。',
    'system_talisman_survivor': '帶著開局就有的「定心符」,讓氣勢被打到歸零一次,由它自動擋下。',
}
out.append(f'<section id="ach"><h2>成就(30)+ 解法</h2>')
out.append('<p class="sub">解鎖條件是判定式,解法是怎麼拿到。人物與結局類的解法都用 '
           '<a href="#route">真結局路線</a> 實際算過。</p>')
out.append('<p class="meta">成就、結局紀錄、格物無漏與宗師紀錄存在「收藏庫」('
           'localStorage <code>gewu_codex_v1</code>),<b>開新案不會清掉</b>——集滿型成就可以分好幾輪慢慢刷。</p>')
for ck, cat in ac['categories'].items():
    out.append(f'<h3>{e(cat["name"])}</h3><table class="ach"><tr><th>名稱</th><th>解鎖條件</th><th>解法</th><th>稱號</th></tr>')
    for aid in ac['ordered']:
        a = ac['items'][aid]
        if a['category'] != ck: continue
        sol = SOLVE.get(aid, '照本站該章的六證正解與破局戰答案打完即可。')
        out.append(f'<tr><td>{e(a["title"])}</td><td>{e(COND.get(aid, a["hint"]))}</td>'
                   f'<td class="sol">{sol}</td><td>{e(a.get("title_reward", "—"))}</td></tr>')
    out.append('</table>')
out.append('</section>')

CSS = '''
@font-face{font-family:"Noto Sans TC";src:url("assets/fonts/notosanstc.woff2") format("woff2");font-weight:100 900;font-display:swap}\n:root{--ink:#14110e;--pa:#e8dfcd;--pa2:#c9bda3;--cin:#a8322a;--br:#8a6b3a;--jade:#5fa383;--danger:#c0564c;--steel:#7f9cc0;--gold:#c9a24b}
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
.note{color:#b9ad93}.concept{color:var(--steel)}.concept::before{content:"觀念｜"}.ev{color:var(--jade)}
.reveal b,.route b,.dlg b{color:var(--cin);margin-right:.4em}.route{color:#a99c82}.loss{color:#a8756e}
.dlg p{margin:.3rem 0;font-size:.9rem;color:#d6cbb4}
.choice{list-style:none;padding:0}.choice li{background:#1d1913;border:1px solid #332c22;border-radius:6px;padding:.6rem .8rem;margin:.4rem 0;font-size:.9rem}
.rules{padding-left:1.2rem}.rules li{margin:.5rem 0;font-size:.92rem}.rules b{color:#f3ead6}
table.ach{width:100%;border-collapse:collapse;font-size:.88rem;margin:.4rem 0}
table.ach th,table.ach td{border:1px solid #332c22;padding:.5rem .7rem;text-align:left}
table.ach th{color:var(--br);background:#1d1913}table.ach td:first-child{color:#f3ead6;white-space:nowrap}
table.ach td.sol{font-size:.82rem;color:#c9bda3;min-width:15rem;white-space:normal}
table.ach td.sol a{color:var(--jade)}
.who{display:grid;grid-template-columns:104px 1fr;gap:.9rem;align-items:start}
.who img{width:104px;height:142px;object-fit:cover;object-position:top center;margin:0}
.who h4{margin:0 0 .2rem}.who .pin{margin-top:0;line-height:1.7}
.qt{font-size:.86rem;color:#d6cbb4;border-left:2px solid var(--cin);padding-left:.6rem;margin:.7rem 0}
.qt::before{content:"「"}.qt::after{content:"」"}
table.rel{width:100%;border-collapse:collapse;font-size:.78rem;margin:.4rem 0}
table.rel th{color:var(--br);text-align:left;font-weight:400;border-bottom:1px solid #332c22;padding:.2rem .3rem}
table.rel td{border-bottom:1px solid #262119;padding:.25rem .3rem;vertical-align:top}
table.rel td:first-child{color:#b9ad93;white-space:nowrap}
table.rel td.d{text-align:right;white-space:nowrap;color:#8fd6b0}table.rel td.d.neg{color:#a8756e}
'''
OG = 'https://yazelin.github.io/gewu-jianghu-web'
# OG 圖換內容要換檔名(FB/LINE 各自照 URL 快取,同名換內容抓不到新的),
# 所以這裡不能寫死 'og.jpg' —— 從 index.html 讀,單一事實來源在那邊。
OG_IMG = re.search(r'og:image" content="[^"]*/(og[^"]*\.jpg)"', open(os.path.join(R, 'index.html'), encoding='utf-8').read()).group(1)
HEAD = (
    '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<title>格物江湖錄:天理殘卷 — 設計與公式站(攻略)</title>'
    '<meta name="description" content="《格物江湖錄:天理殘卷》完整攻略:全題答案、A/B 分支、結局判定與 30 成就條件。">'
    '<link rel="canonical" href="' + OG + '/design.html">'
    '<meta property="og:type" content="article">'
    '<meta property="og:title" content="格物江湖錄:天理殘卷 — 設計與公式站">'
    '<meta property="og:description" content="完整劇情、答案、A/B 分支、結局判定與 30 成就條件。">'
    '<meta property="og:image" content="' + OG + '/assets/' + OG_IMG + '">'
    '<meta property="og:url" content="' + OG + '/design.html">'
    '<meta name="twitter:card" content="summary_large_image">'
    '<meta name="twitter:title" content="格物江湖錄:天理殘卷 — 設計與公式站">'
    '<meta name="twitter:image" content="' + OG + '/assets/' + OG_IMG + '">'
    '<style>' + CSS + '</style></head><body>')
SW = ("\n<!-- 公式站也要自己註冊 SW:第一次從這頁進來的人,否則永遠不會有離線包 -->\n"
      "<script>if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});</script>\n")
doc = HEAD + '\n'.join(out) + SW + '</body></html>'
open(os.path.join(R, 'design.html'), 'w', encoding='utf-8').write(doc)
print('wrote design.html', len(doc) // 1024, 'KB')
# design.html 引用 assets/thumb/,那些檔要另外產;忘了跑就會整頁破圖。
print('接著跑:python3 tools/gen_thumbs.py')
