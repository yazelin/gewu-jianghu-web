#!/usr/bin/env python3
# 自動對照 design.html(公式站/攻略)與 data/game.json(事實母本)。
# 逐題驗證公式站標記的「正解」與遊戲真答案一致,並確認全部內容齊備。
# 退出碼 0=全過,1=有落差。用法:python3 tools/check_design.py
import json, html, os, sys, re

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(R, 'data/game.json'), encoding='utf-8'))
DOC = open(os.path.join(R, 'design.html'), encoding='utf-8').read()
e = lambda s: html.escape(str(s if s is not None else ''))

fails = []
def check(name, cond, extra=''):
    print(f'{"PASS" if cond else "FAIL"}  {name}' + (f'  — {extra}' if extra else ''))
    if not cond: fails.append(name)

# 收集所有題目(序章熱點 + 序章破局選擇 + 各章六證 + 破局戰)
questions = []
for h in G['prologue']['hotspots']:
    questions.append(('序章・' + h['name'], h['options'], h['correct']))
for b in G['prologue'].get('battle', []):
    questions.append(('序章破局・' + b['title'], b['options'], b['correct']))
for c in G['chapters']:
    for cl in c['clues']:
        questions.append((c['title'] + '・' + cl['name'], cl['options'], cl['correct']))
    for b in c['battles']:
        questions.append((c['title'] + '・' + b['title'], b['options'], b['correct']))

# 1) 逐題:把 design.html 每個題目區塊(問題 + 選項)解析出來,
#    比對「該題被標記的正解」是否 == game.json 該題的真答案(用問題文字對應,不做全域字串比對)。
# 由來源建「問題文字 -> 正解文字」
src_q = []
for h in G['prologue']['hotspots']: src_q.append((h['question'], h['options'][h['correct']]))
for b in G['prologue'].get('battle', []): src_q.append((b['prompt'], b['options'][b['correct']]))
for c in G['chapters']:
    for cl in c['clues']: src_q.append((cl['question'], cl['options'][cl['correct']]))
    for b in c['battles']: src_q.append((b['prompt'], b['options'][b['correct']]))
want = {e(q): e(a) for q, a in src_q}

# 從 design.html 抓每個 <p class="q">問題</p><ol class="opts">…<li class="ok">正解</li>…</ol>
blocks = re.findall(r'<p class="q">([^<]*)</p><ol class="opts">(.*?)</ol>', DOC, re.S)
seen = 0
bad = []
for q_text, li_html in blocks:
    if q_text not in want: continue            # 只驗真正的題目(略過章末/對白抉擇的 <ul>)
    seen += 1
    m = re.search(r'<li class="ok">(.*?)</li>', li_html)
    got = m.group(1) if m else None
    if got != want[q_text]:
        bad.append(f'{q_text[:20]}…(公式站標「{got}」/ 應為「{want[q_text]}」)')
missing = [q for q in want if q not in {b[0] for b in blocks}]
check(f'逐題正解與遊戲一致(共 {len(want)} 題)', not bad and not missing and seen == len(want),
      '；'.join(bad[:5]) if bad else (f'缺 {len(missing)} 題' if missing else f'{seen} 題逐塊比對正解全部相符'))

# 2) 題數守恆:design.html 的正解標記數 == 題目總數(抓漏題/多題)
ok_marks = DOC.count('<li class="ok">')
check('題數守恆(正解標記數 = 題目總數)', ok_marks == len(questions), f'標記 {ok_marks} / 應有 {len(questions)}')

# 3) 章節齊備(序章 + 11 章標題全在)
miss_ch = [c['title'] for c in G['chapters'] if e(c['title']) not in DOC]
check('11 章標題齊備', not miss_ch, '缺:' + '、'.join(miss_ch) if miss_ch else '含序章共 12 段')

# 4) 結局齊備(第九章 4 + 完整版 4,標題全在)
end_titles = [en['title'] for en in G['endings_ch9'].values()] + [en['title'] for en in G['endings_finale'].values()]
miss_end = [t for t in end_titles if e(t) not in DOC]
check(f'結局齊備({len(end_titles)} 個)', not miss_end, '缺:' + '、'.join(miss_end) if miss_end else '普通 4 + 完整版 4')
check('標示真結局「天地共衡」', '（真結局）' in DOC or '(真結局)' in DOC)

# 5) 成就齊備(30 條標題全在)
ach = G['achievements']
ach_titles = [ach['items'][a]['title'] for a in ach['ordered']]
miss_ach = [t for t in ach_titles if e(t) not in DOC]
check(f'成就齊備({len(ach_titles)} 條)', not miss_ach, '缺:' + '、'.join(miss_ach) if miss_ach else '30 條全列')

# 6) 情緣候選齊備
miss_rom = [n for n in G['romance']['candidates'] if e(n) not in DOC]
check('情緣候選齊備', not miss_rom, '缺:' + '、'.join(miss_rom) if miss_rom else '、'.join(G['romance']['candidates']))

# 7) 人物誌:10 張人物卡齊備,且好感增減列數 == game.json 推導的出處總數
names = ['沈硯'] + [p['name'] for p in G['people']]
miss_p = [n for n in names if f'<h4>{e(n)}</h4>' not in DOC]
check(f'人物卡齊備({len(names)} 張)', not miss_p, '缺:' + '、'.join(miss_p) if miss_p else '沈硯 + 9 名同行者')
n_rel = sum(1 for o in (G['prologue'].get('choice') or {}).get('options', []) if o.get('relationship'))
n_rel += sum(1 for o in (G['prologue'].get('final_choice') or {}).get('options', []) if o.get('rel'))
for c in G['chapters']:
    n_rel += sum(1 for o in (c.get('dialogue_choice') or {}).get('options', []) if o.get('relationship'))
    for key in ('a', 'b'):
        n_rel += len(G['logic']['final_effects'].get(str(c['id']), {}).get(key, {}).get('rel') or {})
got_rel = len(re.findall(r'<td class="d(?: neg)?">', DOC))
check('好感增減出處齊備', got_rel == n_rel, f'列出 {got_rel} / 應有 {n_rel}')

# 8) 先賢譜 9 位齊備
sages = [n['name'] for n in G['scientists']['nodes'].values()]
miss_s = [n for n in sages if e(n) not in DOC]
check(f'先賢譜齊備({len(sages)} 位)', not miss_s, '缺:' + '、'.join(miss_s) if miss_s else '9 位全列')

# 9) 真結局路線:把頁面上那張表讀回來,用 game.json 的規則獨立重算一次真結局條件
sec = DOC[DOC.find('id="route"'):DOC.find('id="ab"')]
picked = re.findall(r'<tr><td>([^<]*)</td><td>([^<]*)</td><td>([^<]*)</td><td>[^<]*</td></tr>', sec)
rel, flags, chosen = {}, {}, {}
for ch_title, dlg_text, fin_text in picked:
    node = G['prologue'] if ch_title == '序章' else next((c for c in G['chapters'] if e(c['title']) == ch_title), None)
    if not node: continue
    cid = 'p' if ch_title == '序章' else node['id']
    for o in (node.get('dialogue_choice') or node.get('choice') or {}).get('options', []):
        if e(o['text']) != dlg_text: continue
        rel[o['relationship']] = max(-5, min(5, rel.get(o['relationship'], 0) + o.get('delta', 0)))
        if o.get('flag'): flags[o['flag']] = True
    if cid == 'p':
        for o in G['prologue']['final_choice']['options']:
            if e(o['text']) != fin_text: continue
            rel[o['rel']] = max(-5, min(5, rel.get(o['rel'], 0) + o['delta']))
            flags['prologue_case_strong'] = True
            flags['keeper_saved' if o['id'] == 'rescue' else 'copper_seal'] = True
    else:
        for key in ('a', 'b'):
            if e(node['final_choice'][key]['title']) != fin_text: continue
            chosen[node['id']] = node['final_choice'][key]['id']
            eff = G['logic']['final_effects'][str(node['id'])].get(key, {})
            for n, d in (eff.get('rel') or {}).items(): rel[n] = max(-5, min(5, rel.get(n, 0) + d))
            flags.update(eff.get('flags') or {})
L = G['logic']
pos = [n for n in L['camp_map'] if rel.get(n, 0) >= 2]
modest = sum(1 for n, v in rel.items() if n != '裴無咎' and v >= 1)
seal_people = (len(pos) >= 3 and len({L['camp_map'][n] for n in pos}) >= 2) or (rel.get('裴無咎', 0) >= 4 and modest >= 2)
seal_frag = (sum(1 for f in L['people_flags'] if flags.get(f)) >= 2
             and sum(1 for f in L['standard_flags'] if flags.get(f)) >= 2
             and any(flags.get(f) for f in L['late_keys']))
deep = sum(1 for v in rel.values() if v >= 3)
true_end = (seal_people and seal_frag and chosen.get(9) == 'reversible_shutdown'
            and flags.get('veto_clause_restored') and flags.get('allies_crosschecked_final')
            and chosen.get(11) == 'open_shared_standard' and deep >= 3 and rel.get('裴無咎', 0) >= 1)
check('真結局路線可重現(照表重算)', len(picked) == 12 and bool(true_end),
      f'{len(picked)} 章；三印人和={seal_people} 殘卷={seal_frag}；深交 {deep} 人；裴無咎 {rel.get("裴無咎", 0):+d}')

# 10) 成就解法齊備(每條成就都有解法欄)
check('成就解法齊備(30 條)', DOC.count('<td class="sol">') == len(ach_titles),
      f'{DOC.count(chr(60) + "td class=" + chr(34) + "sol" + chr(34) + ">")} / {len(ach_titles)}')

# 11) 原作者出處與贊助連結在(公式站保留原作者致謝)
check('保留原作者致謝/贊助連結', 'changyi123456' in DOC and 'aiphysicsteacher' in DOC)

# ---- 完整版結局的判定規則:攻略站的敘述要跟 engine.js 的實際分支一致 ----
# 這條走鐘過:masterless_road 本來寫成「兩個選項之外的 fallback」(永遠走不到的死碼),
# 程式改用 allies_crosschecked_final 分流之後,攻略站仍寫著舊的「其餘→無主長路」,
# 等於在教一條不存在的解法。攻略站是生成的,規則敘述卻是手寫散文,不盯就會漂。
ENG = open(os.path.join(R, 'engine.js'), encoding='utf-8').read()
_fin = re.search(r'function finaleEndingId\(.*?\n\}', ENG, re.S).group(0)
_uses_tenth = 'tenth_line_traced' in _fin
check('完整版結局判定規則:攻略站敘述與 engine.js 一致',
      _uses_tenth == ('逐筆比對' in DOC and '無主長路' in DOC) and '其餘→無主長路' not in DOC,
      'engine 用 tenth_line_traced 分流' if _uses_tenth else 'engine 未用 tenth_line_traced 分流')

print(f'\n=== {len(questions)+6-len(fails) if False else ""}對照完成:{"全部一致" if not fails else str(len(fails))+" 項落差"} ===')
if fails:
    print('落差:', '、'.join(fails)); sys.exit(1)

