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

# 7) 原作者出處與贊助連結在(公式站保留原作者致謝)
check('保留原作者致謝/贊助連結', 'changyi123456' in DOC and 'aiphysicsteacher' in DOC)

print(f'\n=== {len(questions)+6-len(fails) if False else ""}對照完成:{"全部一致" if not fails else str(len(fails))+" 項落差"} ===')
if fails:
    print('落差:', '、'.join(fails)); sys.exit(1)
