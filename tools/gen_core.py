#!/usr/bin/env python3
# 依「遊玩順序」重排 sw.js 的 CORE 清單,並寫回 sw.js。
#
# 為什麼順序是關鍵:CORE 是背景暖快取的下載順序。順序錯了不會有任何錯誤訊息,
# 但「下載到一半就斷線」的人能玩到哪一章完全由它決定。
#
# 重排前(手維護的順序,大圖排在證物切格之前):
#   序章要下載到 12.86 MB 才齊、第 2 章要 20.10 MB、第 9 章要跑完整包 28.60 MB。
#   斷線在 15 MB 的人玩得了序章與第一章,卻玩不了第二章。
# 重排後:序章 <1 MB、十一章全齊約 5 MB,剩下的 23 MB 是題名附加功能與配樂鑑賞。
#
# 分組原則是「玩家什麼時候會需要它」:
#   1 殼          開機必要
#   2 題名可見     題字/背景/字型/icon
#   3 序章        背景 + 證物切格 + 音效 + 環境樂
#   4 第 1~11 章  各章背景 + 證物切格 + 調查樂 + 破局樂(去重)
#   5 題名附加     劇情前導 / 結局圖鑑 / 先賢譜 / 片尾 / 成就譜
#   6 攻略站      design.html + 縮圖
#   7 配樂鑑賞剩餘 只在鑑賞頁單獨播的曲目(最重,擺最後)
#
# 用法:python3 tools/gen_core.py           重排並寫回 sw.js
#       python3 tools/gen_core.py --check   只檢查順序是否已正確(不改檔),CI 用
import json, os, re, sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(R, 'data/game.json'), encoding='utf-8'))
SW = os.path.join(R, 'sw.js')
sw_src = open(SW, encoding='utf-8').read()
eng = open(os.path.join(R, 'engine.js'), encoding='utf-8').read()

old = json.loads('[' + re.search(r'const CORE=\[(.*?)\];', sw_src, re.S).group(1) + ']')
A = lambda n: f'assets/audio/{n}.ogg'


def track(block, key):
    """從 engine.js 的 MUSIC 表撈出某一章的曲名(調查樂/破局樂)。"""
    m = re.search(rf'{block}:\s*\{{(.*?)\}}', re.search(r'const MUSIC = \{(.*?)\n\};', eng, re.S).group(1), re.S)
    return dict(re.findall(r'(\d+):\s*\'([a-z0-9_]+)\'', m.group(1))).get(str(key))


order, seen = [], set()


def add(*items):
    for u in items:
        if u and u in old and u not in seen:
            seen.add(u)
            order.append(u)


# 1 殼
add('./', 'index.html', 'engine.js', 'manifest.json', 'data/game.json')
# 2 題名可見
add('assets/fonts/notosanstc.woff2', 'assets/seal.svg')
add(*[u for u in old if '/img/title_' in u])
# PWA icon 只有安裝/桌面捷徑用得到,遊戲本身不需要 —— 0.79 MB 卡在序章之前很不划算,
# 挪到章節畫面之後。小的 192 仍留在 SHELL(見下),安裝當下不至於沒圖。
# 3 序章:先音效再環境樂 —— 開場立刻會用到
p = G['prologue']
add(*[u for u in old if u.endswith('.mp3')])
add(A('oriental_calm'), A('oriented_suspense'))
add(p['background'], *[h.get('cell') for h in p['hotspots']])
# 4a 第一章整組(含音樂):開場體驗要完整,不要一進第一章就沒配樂
c1 = G['chapters'][0]
add(c1['background'], *[cl.get('cell') for cl in c1['clues']])
add(A(track('investigation', 1) or ''), A(track('battle', 1) or ''))
# 4b 其餘各章「只先拿畫面」:背景 + 證物切格 每章約 0.2 MB,十章不到 2.5 MB。
#    這是斷線時的安全網 —— 音樂缺檔會靜音但照玩(engine 的 sceneMusic 缺檔靜音),
#    畫面缺了才是真的玩不下去。所以畫面優先於音樂。
for c in G['chapters'][1:]:
    add(c['background'], *[cl.get('cell') for cl in c['clues']])
# 4c 補各章音樂(照章序)
for c in G['chapters'][1:]:
    add(A(track('investigation', c['id']) or ''), A(track('battle', c['id']) or ''))
# 5 PWA icon(安裝才用)+ 題名附加功能
add(*[u for u in old if '/icons/' in u])
add(*[s.get('image') for s in G.get('story_intro', [])])
add(*[e['image'] for e in list(G['endings_ch9'].values()) + list(G['endings_finale'].values())])
add(*[f'assets/img/sage_{k}.webp' for k in G['scientists']['nodes']])
add('assets/img/credits_cast_main.webp', 'assets/img/credits_cast_crew.webp',
    'assets/img/achievement_emblem_atlas.webp')
# 6 攻略站
add('design.html', *[u for u in old if '/thumb/' in u])
# 7 剩下的(配樂鑑賞才會單獨播的曲目等)
add(*old)

missing = [u for u in old if u not in seen]
assert not missing, f'重排掉了東西:{missing}'
assert len(order) == len(old), f'{len(order)} != {len(old)}'

if order == old:
    print('CORE 順序已正確,不需改動。')
    sys.exit(0)
if '--check' in sys.argv:
    print('CORE 順序與遊玩順序不符 —— 跑 python3 tools/gen_core.py 重排。', file=sys.stderr)
    sys.exit(1)

new_line = 'const CORE=[' + ', '.join(json.dumps(u, ensure_ascii=False) for u in order) + '];'
sw_src = re.sub(r'const CORE=\[.*?\];', lambda _: new_line, sw_src, count=1, flags=re.S)

# SHELL = install 事件會等待的預抓清單,它沒抓完新 SW 就不會 activate。
# 只放「畫出題名畫面所需的最小集」:多放一項就多擋一項的時間。
# design.html(179KB)與兩張 512 icon(各 347KB)都不是開機必要,交給背景暖快取。
# icon-192 留著(59KB):安裝當下要有圖,而它很小。
SHELL = ['./', 'index.html', 'engine.js', 'manifest.json', 'data/game.json',
         'assets/fonts/notosanstc.woff2', 'assets/seal.svg',
         *[u for u in order if '/img/title_' in u], 'assets/icons/icon-192-v2.png']
assert all(u in order for u in SHELL), [u for u in SHELL if u not in order]
sw_src = re.sub(r'const SHELL=\[.*?\];',
                lambda _: 'const SHELL=[' + ','.join(json.dumps(u, ensure_ascii=False) for u in SHELL) + '];',
                sw_src, count=1, flags=re.S)
open(SW, 'w', encoding='utf-8').write(sw_src)

# 回報:重排後每一章要下載多少才齊
size = lambda u: os.path.getsize(os.path.join(R, u)) if os.path.exists(os.path.join(R, u)) else 0
need = {0: {p['background'], *[h.get('cell') for h in p['hotspots']], A('oriental_calm'), A('oriented_suspense')}}
for c in G['chapters']:
    need[c['id']] = {c['background'], *[cl.get('cell') for cl in c['clues']],
                     A(track('investigation', c['id']) or ''), A(track('battle', c['id']) or '')}
cum, at = 0, {}
for i, u in enumerate(order):
    cum += size(u)
    for ch, s in need.items():
        if ch not in at and all(order.index(x) <= i for x in s if x in order):
            at[ch] = cum
print(f'CORE 已重排({len(order)} 項)。背景下載到多少 MB 時各章齊備:')
for ch in sorted(at):
    print(f"  {'序章' if ch == 0 else f'第{ch:2d}章'}  {at[ch]/1048576:5.2f} MB")
print(f'  全部       {sum(size(u) for u in order)/1048576:5.2f} MB')
