import json, re, os

A = json.load(open('all_consts.json'))
M = A['main']

IMG_IDENT = {
    'BACKGROUND': 'bell_tower_concept', 'TITLE_KEYART': 'title_keyart_v14',
    'INTRO_MISSING_MASTER': 'missing_master_chamber_v14',
    'INTRO_SABOTAGED_AXLE': 'sabotaged_axle_v14',
    'INTRO_TIANHENG': 'tianheng_confrontation_v14',
    'EVIDENCE_ATLAS': 'bell_case_evidence_atlas',
    'ACHIEVEMENT_ATLAS': 'achievement_emblem_atlas',
}
def img(basename): return f'assets/img/{basename}.webp'
def cell(atlas_base, idx): return f'assets/cells/{atlas_base}_{idx}.webp'
def resolve_ident(v):
    if isinstance(v, dict) and '$ident' in v:
        return img(IMG_IDENT[v['$ident']])
    return v
def base_of(respath):           # res://.../chapter1_workshop.png -> chapter1_workshop
    return os.path.basename(respath).rsplit('.', 1)[0]

G = {'images_base': 'assets/'}

# --- title / cinematic intro ---------------------------------------------
G['title_keyart'] = img('title_keyart_v14')
G['story_intro'] = [
    {'eyebrow': p['eyebrow'], 'title': p['title'], 'text': p['text'],
     'image': resolve_ident(p['texture'])}
    for p in M['STORY_INTRO']]

# --- prologue -------------------------------------------------------------
ATLAS_IDX = M['EVIDENCE_ATLAS_INDEX']
G['prologue'] = {
    'background': img('bell_tower_concept'),
    'narration': [{'speaker': l['speaker'], 'text': l['text']} for l in M['PROLOGUE']],
    'hotspots': [
        {'id': hid, 'name': h['name'], 'pos': h['position'],
         'body': h['body'], 'question': h['question'], 'options': h['options'],
         'correct': h['correct'], 'evidence': h['evidence'],
         'note': h.get('note', ''), 'concept': h.get('concept', ''), 'sfx': h.get('sfx', ''),
         'cell': cell('bell_case_evidence_atlas', ATLAS_IDX[hid])}
        for hid, h in M['HOTSPOTS'].items()],
}

# --- chapters -------------------------------------------------------------
CH = {}
for f in ['campaign_content', 'campaign_late_content', 'campaign_finale_content']:
    CH.update(A[f]['CHAPTERS'])
PROG = A['campaign_story_progression']['CHAPTERS']

def lines(v): return [{'speaker': l.get('speaker', ''), 'text': l.get('text', '')} for l in v]

chapters = []
for cid in sorted(CH, key=int):
    c = CH[cid]; pr = PROG.get(cid, {})
    atlas_base = base_of(c['evidence_atlas'])
    clues = []
    for k, cl in c['clues'].items():
        pc = pr.get('clues', {}).get(k, {})
        clues.append({
            'id': k, 'name': cl['name'], 'atlas_index': cl['atlas_index'],
            'cell': cell(atlas_base, cl['atlas_index']), 'pos': cl['position'],
            'body': cl['body'], 'question': cl['question'], 'options': cl['options'],
            'correct': cl['correct'], 'evidence': cl['evidence'],
            'note': cl.get('note', ''), 'concept': cl.get('concept', ''),
            'reveal': pc.get('reveal', ''), 'reveal_speaker': pc.get('speaker', ''),
            'response': pc.get('response', ''), 'route_text': pc.get('route_text', {}),
            'loss': pc.get('loss', ''), 'thread': pc.get('thread', ''),
        })
    ch = {
        'id': int(cid), 'title': c['title'], 'subtitle': c['subtitle'],
        'location': c['location'], 'background': img(base_of(c['background'])),
        'min_evidence': c['minimum_evidence'],
        'route_a_name': c['route_a_name'], 'route_b_name': c['route_b_name'],
        'route_a_intro': lines(c.get('route_a_intro', [])),
        'route_b_intro': lines(c.get('route_b_intro', [])),
        'common_dialogue': lines(c.get('common_dialogue', [])),
        'dialogue_choice': c.get('dialogue_choice'),
        'clues': clues,
        'battles': c['battle'],
        'final_choice': c.get('final_choice'),
        'goal': pr.get('goal', ''),
        'milestones': pr.get('milestones', {}),
        'battle_beats': pr.get('battle', []),
    }
    chapters.append(ch)
G['chapters'] = chapters

# --- side systems (for later phases) -------------------------------------
G['items'] = A['item_catalog']['ITEMS']
G['max_qishi'] = A['item_catalog']['MAX_QISHI']
G['romance'] = {'order': A['romance_content']['CANDIDATE_ORDER'],
                'candidates': A['romance_content']['CANDIDATES'],
                'solo_normal': A['romance_content']['SOLO_NORMAL'],
                'solo_finale': A['romance_content']['SOLO_FINALE']}
def fix_ending(e):
    e = dict(e); e['image'] = img(base_of(e['image'])); return e
G['endings_ch9'] = {k: fix_ending(v) for k, v in A['ending_content']['ENDINGS'].items()}
G['endings_finale'] = {k: fix_ending(v) for k, v in A['finale_ending_content']['ENDINGS'].items()}
G['affinity_range'] = [A['ending_content']['AFFINITY_MIN'], A['ending_content']['AFFINITY_MAX']]
G['people_flags'] = A['ending_content']['PEOPLE_FLAGS']
G['achievements'] = {'categories': A['achievement_catalog']['CATEGORIES'],
                     'ordered': A['achievement_catalog']['ORDERED_IDS'],
                     'items': A['achievement_catalog']['ACHIEVEMENTS'],
                     'music_gallery': A['achievement_catalog']['MUSIC_GALLERY']}
G['failure_texts'] = {}
for f in ['failure_content', 'failure_late_content', 'failure_finale_content']:
    G['failure_texts'].update(A[f].get('LOST_EVIDENCE', {}))
G['author_url'] = M['AUTHOR_URL']
G['donation_url'] = M['DONATION_URL']

# --- 邏輯規則(從 main.gd bytecode 還原,見 tools/LOGIC.md)-----------------
G['portraits'] = {   # 角色名 → 立繪 webp
    '沈硯': img('shen_yan_user_cut'), '柳照微': img('liu_zhaowei'), '祁望舒': img('qi_wangshu'),
    '蘇檀': img('su_tan'), '江濯月': img('jiang_zhuoyue'), '顧玄策': img('gu_xuance'),
    '霍離': img('huo_li'), '謝驚弦': img('xie_jingxian'), '寧觀瀾': img('ning_guanlan'),
    '裴無咎': img('pei_wugou'),
}
# 好感面板 9 人(排除主角沈硯),登場章(尚未登場顯示暗色)
G['people'] = [
    {'name': '柳照微', 'first': 1}, {'name': '祁望舒', 'first': 1}, {'name': '蘇檀', 'first': 1},
    {'name': '江濯月', 'first': 2}, {'name': '顧玄策', 'first': 3}, {'name': '霍離', 'first': 4},
    {'name': '謝驚弦', 'first': 5}, {'name': '寧觀瀾', 'first': 6}, {'name': '裴無咎', 'first': 1},
]
G['logic'] = {
    # 進入該章走 A 線的條件(全 True 才 A,否則 B);缺項預設 A
    'route_table': {
        '1': {'all': ['keeper_saved', 'prologue_case_strong']},
        '2': {'all': ['apprentice_protected']},
        '3': {'all': ['jiang_alliance']},
        '4': {'all': ['witness_saved']},
        '5': {'all': ['forge_workers_saved', 'huo_alliance']},
        '6': {'all': ['leihuo_witnesses_saved', 'xie_alliance']},
        '7': {'all': ['true_ephemeris_published', 'observatory_students_saved']},
        '8': {'all': ['mirror_testimony_published']},
        '9': {'all': ['artisan_league_freed']},
        '10': {'any': ['ending:people_witness', 'seal:people']},
        '11': {'all': ['veto_clause_restored']},
    },
    # 章末抉擇 a/b 設定的 world_flags(a=救人線 / b=奪證線)
    'final_flags': {
        '1': {'a': ['apprentice_protected'], 'b': ['copper_seal', 'registry_exposed']},
        '2': {'a': ['jiang_alliance', 'river_passengers_saved'], 'b': ['residual_page_recovered']},
        '3': {'a': ['witness_saved'], 'b': ['wugou_cipher_recovered']},
        '4': {'a': ['forge_workers_saved', 'huo_alliance'], 'b': ['thermal_core_secured']},
        '5': {'a': ['leihuo_witnesses_saved', 'xie_alliance'], 'b': ['field_notes_recovered']},
        '6': {'a': ['true_ephemeris_published', 'observatory_students_saved', 'ning_alliance'], 'b': ['secret_star_chart_recovered']},
        '7': {'a': ['mirror_testimony_published'], 'b': ['master_mirror_secured']},
        '8': {'a': ['artisan_league_freed'], 'b': ['zero_standard_secured']},
        '9': {'a': ['public_measurement_network'], 'b': ['original_standard_chain']},
        '10': {'a': ['veto_clause_restored'], 'b': ['origin_table_secured']},
        '11': {'a': ['shared_standard_opened'], 'b': ['four_key_standard_sealed']},
    },
    'start_inventory': {'steadfast_talisman': 1, 'logic_token': 1, 'measuring_rule': 1},
    'reward_rule': {'always': 'calm_powder', 'ev5': 'logic_token', 'ev6': 'breath_manual'},
    # 關係階梯(非候選)value 門檻 → 標籤
    'rel_ladder': [[4, '生死相託'], [2, '信任加深'], [1, '開始信任'], [0, '態度未定'], [-2, '有所疏離'], [-99, '戒備甚深']],
    'romance_order': G['romance']['order'],
}

os.makedirs('/home/ct/gewu-jianghu-web/data', exist_ok=True)
json.dump(G, open('/home/ct/gewu-jianghu-web/data/game.json', 'w'), ensure_ascii=False, separators=(',', ':'))
sz = os.path.getsize('/home/ct/gewu-jianghu-web/data/game.json')
print(f'game.json {sz//1024} KB  | {len(G["chapters"])} chapters, '
      f'{sum(len(c["clues"]) for c in chapters)} clues, '
      f'{sum(len(c["battles"]) for c in chapters)} battles, '
      f'{len(G["prologue"]["hotspots"])} prologue hotspots')
# sanity: every referenced image exists
missing = []
def check(p):
    if isinstance(p, str) and p.startswith('assets/') and not os.path.exists('/home/ct/gewu-jianghu-web/' + p):
        missing.append(p)
def walk(o):
    if isinstance(o, dict): [walk(v) for v in o.values()]
    elif isinstance(o, list): [walk(v) for v in o]
    else: check(o)
walk(G)
print('missing images:', sorted(set(missing)) or 'none')
