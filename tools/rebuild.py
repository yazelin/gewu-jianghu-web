import re, json, os
from gdconst import parse

KEYS = set('''title subtitle location background evidence_atlas minimum_evidence
route_a_name route_b_name route_a_intro route_b_intro common_dialogue dialogue_choice
at prompt options id relationship delta clues name atlas_index position body question
correct evidence note concept battle battles explanation speaker text chapter chapters
CHAPTERS reward requires stage lines'''.split())

def cjk(s): return isinstance(s, str) and bool(re.search(r'[㐀-鿿]', s))
def asc(s): return isinstance(s, str) and bool(re.fullmatch(r'[a-z][a-z0-9_]*', s))

def rebuild(binfile):
    _, C = parse(binfile)
    chapters, i, n = [], 0, len(C)
    while i < n:
        v = C[i]
        if isinstance(v, str) and re.match(r'^第[一二三四五六七八九十]+章・', v):
            ch = {'title': v, 'clues': [], 'battles': [], 'story': []}
            i += 1
            # header CJK strings until the first clue id
            hdr = []
            while i < n and not (asc(C[i]) and C[i] not in KEYS):
                if isinstance(C[i], str) and C[i].startswith('res://'): ch.setdefault('art', []).append(C[i])
                elif cjk(C[i]): hdr.append(C[i])
                i += 1
            ch['header'] = hdr
            # clues + battles
            while i < n:
                if isinstance(C[i], str) and re.match(r'^第[一二三四五六七八九十]+章・', C[i]): break
                if isinstance(C[i], str) and re.match(r'^第[一二三四五六七八九十]+關', C[i]):
                    b = [C[i]]; i += 1
                    while i < n and len(b) < 8:
                        if cjk(C[i]) and not re.match(r'^第[一二三四五六七八九十]+關', C[i]): b.append(C[i])
                        elif isinstance(C[i], str) and re.match(r'^第[一二三四五六七八九十]+關', C[i]): break
                        i += 1
                    ch['battles'].append(dict(zip(
                        ['name','body','question','o1','o2','o3','o4','explanation'], b)))
                    continue
                if asc(C[i]) and C[i] not in KEYS:
                    cid = C[i]; i += 1; vals = []
                    while i < n and len(vals) < 9:
                        if asc(C[i]) and C[i] not in KEYS: break
                        if isinstance(C[i], str) and re.match(r'^第[一二三四五六七八九十]+[章關]', C[i]): break
                        if cjk(C[i]): vals.append(C[i])
                        i += 1
                    if len(vals) >= 9:
                        ch['clues'].append(dict(zip(
                            ['name','body','question','o1','o2','o3','evidence','note','concept'],
                            vals[:9]), id=cid))
                    else:
                        ch['story'] += vals
                    continue
                if cjk(C[i]): ch['story'].append(C[i])
                i += 1
            chapters.append(ch)
        else:
            i += 1
    return chapters

if __name__ == '__main__':
    all_ch = []
    for f in ['campaign_content','campaign_late_content','campaign_finale_content']:
        all_ch += rebuild('gdc_raw/%s.bin' % f)
    json.dump(all_ch, open('chapters.json','w'), ensure_ascii=False, indent=1)
    for c in all_ch:
        print('%-24s clues=%d battles=%d art=%d' % (
            c['title'][:22], len(c['clues']), len(c['battles']), len(c.get('art', []))))
