# 從 main.gd bytecode 還原的遊戲邏輯規則

## A/B 路線決策表(`_determine_campaign_route`)
`route(N) = 'A' if <cond> else 'B'`,cond 讀 `world_flags`:

| 章 | 進入該章走 A 線的條件 |
|---|---|
| 1 | keeper_saved 且 prologue_case_strong |
| 2 | apprentice_protected |
| 3 | jiang_alliance |
| 4 | witness_saved |
| 5 | forge_workers_saved 且 huo_alliance |
| 6 | leihuo_witnesses_saved 且 xie_alliance |
| 7 | true_ephemeris_published 且 observatory_students_saved |
| 8 | mirror_testimony_published |
| 9 | artisan_league_freed |
| 10 | last_normal_ending=='people_witness' 或 三印之 people |
| 11 | veto_clause_restored |
| 其他 | A |

## flag 由什麼設定(label → flag,取自 bytecode 的 `[label, flag]` 配對)
選項標題 / 證物名 / 里程碑標籤命中 label 時,設對應 flag=true。

- 章末抉擇(A 側救人 / B 側奪證)例:護住學徒→apprentice_protected、保住活證→witness_saved、
  地爐眾匠生還→forge_workers_saved、雷火盟眾生還→leihuo_witnesses_saved、觀測生獲救→observatory_students_saved、
  公開破鏡證詞→mirror_testimony_published、百工出獄→artisan_league_freed、眾證同步網→public_measurement_network…
  B 側:取得銅印→copper_seal、公開名冊→registry_exposed、取得密箭→wugou_cipher_recovered…
- 結盟 flag:河運結盟→jiang_alliance、燼火堂結盟→huo_alliance、雷火盟結盟→xie_alliance、玄穹臺結盟→ning_alliance
- 證物命中:破鏡證詞→mirror_testimony_published、天理母鏡→master_mirror_secured、百工盟冊→artisan_league_freed、
  零度母尺→zero_standard_secured、半枚銅印→copper_seal…
- 序章:鐘守生還→keeper_saved、prologue_case_strong(序章證據夠強)

## 道具取得(每章一次,`claim_key` 防重領)
- 固定:清心散 ×1
- 有效證據 ≥5:格物籤 ×1
- 有效證據 ≥6:吐納殘訣 ×1(永久 +1 氣勢上限,最高 5)

新局初始行囊:定心符 ×1、格物籤 ×1、墨線尺 ×1

## 道具效果(item_catalog)
- breath_manual 吐納殘訣:永久 +1 氣勢上限(≤5)
- calm_powder 清心散:破局戰關間 +1 氣勢(不超上限)
- steadfast_talisman 定心符:氣勢將歸零時自動消耗,保留 1 點
- logic_token 格物籤:證據作答前排除一個錯誤選項
- measuring_rule 墨線尺:證據作答前標出應整理的物理量(提示,不揭答案)

## 立繪對應(PORTRAITS)
沈硯→shen_yan_user_cut、柳照微→liu_zhaowei、祁望舒→qi_wangshu、蘇檀→su_tan、江濯月→jiang_zhuoyue、
顧玄策→gu_xuance、霍離→huo_li、謝驚弦→xie_jingxian、寧觀瀾→ning_guanlan、裴無咎→pei_wugou

## 關係階段階梯(好感面板)
非候選人物「關係」:value≥4 生死相託 / ≥2 信任加深 / ≥1 開始信任 / ==0 態度未定 / ≥-2 有所疏離 / else 戒備甚深
定位:裴無咎=師徒羈絆、候選=情緣、其他=重要同伴、未登場=尚未相識
候選人「情緣」:(章≥9 且 value≥2) 可以確認心意 / value≥2 牽掛漸深 / value≥1 初有在意 / 已許/共度 依 flag

## 情緣(romance,V13 doc + bytecode)
- 候選僅 3 人:柳照微、江濯月、蘇檀
- 第 9 章表心意:當前好感最高候選且 value≥2 → 可許諾
- 第 11 章定局:延續第 9 章同一人且 value≥2,或候選之一 value≥4

## 結局(CH10_11 doc + ending data)
- 第 9 章 4 普通結局:people_witness / archive_sealed / return_mountain / nameless_ashes(依三印 seals + 路線)
- 第 11 章 4 完整版結局:heaven_earth_shared(真結局,需三印全+雙章完整證鏈+否決條款+9路覆核+≥3人深交+裴無咎≥1)
  / common_measure / four_keys / masterless_road
