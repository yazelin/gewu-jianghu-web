# 通關與功能驗證報告

**版本** v112 ｜ **日期** 2026-07-26 ｜ **結論** 8 個結局、30 個成就全部可由正常遊玩取得

驗證方式一律是**真的把遊戲玩完**——腳本操作真實 DOM(點熱點、答題、選抉擇),
不是直接呼叫結局函式或塞狀態。每條路線都從新案入局開始,一路打到結局畫面出現為止。

重跑指令:

```bash
bash tools/test.sh          # 常規四關,約 3 分鐘
bash tools/test.sh --full   # 再加「八結局實跑」+「三十成就實跑」,約 12 分鐘
node tools/endings.mjs      # 只跑八結局
node tools/achievements.mjs # 只跑三十成就
```

---

## 一、八個結局:全部實跑取得

結局不是選單選的,是由好感、旗標、封印、章末抉擇「算」出來的。
下表每一列都是一次完整通關,`章末`／`對話`是該局在各章選的 a／b。

| 結局 | 類別 | 章末抉擇 | 章中對話 | 通過章數 | 耗時 |
|---|---|---|---|---:|---:|
| 普通結局・萬民見證 | 普通 | `aaaaaabaa` | `aaaaaaaab` | 10 | 26s |
| 普通結局・天理入庫 | 普通 | `aaaaaaaba` | `aaaaaaaab` | 10 | 27s |
| 普通結局・折衡歸山 | 普通 | `aaaaabbba` | `aaaaaaaaa` | 10 | 27s |
| 普通結局・無名灰燼 | 普通 | `aaaaaaabb` | `aaaaaaaab` | 10 | 27s |
| 完整版真結局・天地共衡 | 完整版 | `aaaaaaabaaa` | `aaaaaaaabba` | 12 | 32s |
| 完整版結局・公議新尺 | 完整版 | `aaaaaaaaaaa` | `aaaaaaaaaaa` | 12 | 32s |
| 完整版結局・四鑰守衡 | 完整版 | `aaaaaaaaaab` | `aaaaaaaaaaa` | 12 | 32s |
| 完整版結局・無主長路 | 完整版 | `aaaaaaaaaaa` | `aaaaaaaaaab` | 12 | 32s |

另驗:同一份存檔連跑兩條不同路線,結局圖鑑會累積(不是後蓋前)。

## 二、三十個成就:連續多週目收齊

十輪連續遊玩、中間不清存檔,收藏庫一路累積到 30/30。
每輪負責的成就不同,例如宗師難度那輪拿「宗師問天」、蓄意失敗那輪拿「敗卷重開」與「一息尚存」。

| 類別 | 數量 | 狀態 |
|---|---:|---|
| 章回(雨夜鐘鳴 → 天地共校) | 12 | 全取得 |
| 精通(六證成卷、十一卷無漏、宗師問天…) | 6 | 全取得 |
| 人和(生死相託、九路同衡…) | 4 | 全取得 |
| 三印(人和/理證/殘卷) | 3 | 全取得 |
| 結局(天理四歸、天地四卷、天地共衡) | 3 | 全取得 |
| 系統(敗卷重開、一息尚存) | 2 | 全取得 |

最緊的一項是**九路同衡**(9 位角色同時好感 ≥1)。窮舉 2²² 種選擇組合後,
可行解是 `章末=aaaaaaaaaaa`、`對話=aabaaaaaabb`,在第 11 章末剛好 9/9,沒有餘裕。

## 三、這次驗證找出的三個 bug(都已修)

### 1. 無主長路結局永遠拿不到 → 天地四卷成就也拿不到

`finaleEndingId()` 把 `masterless_road` 寫成「兩個選項之外的 fallback」:

```js
const fc = S.choices['final11'] || '';
if (fc === 'open_shared_standard') return 'common_measure';
if (fc === 'seal_four_key_standard') return 'four_keys';
return 'masterless_road';        // ← 永遠走不到
```

但 `finalChoice` 一定先寫入 `S.choices.final11`,`finaleEndings` 才跑,所以 `fc` 不可能是空字串。
後果不只少一個結局:**天地四卷**(集滿 4 個完整版結局)也就永遠拿不到。

**修法的依據是結局文本本身**。無主長路是「拆成九段…沒有全城共用的唯一標準」,
也就是拆分了天衡權限卻沒有同盟互校撐住共同基準;而 `allies_crosschecked_final`
正是真結局條件鏈裡的那一項。所以改成:

- 不拆分(四鑰定衡)→ 四鑰守衡
- 拆分 + 有互校 → 公議新尺
- 拆分 + 無互校 → 無主長路

**這條是推的,不是查到的**:原作的判定在編譯後的 bytecode 裡,反編出來的資料檔沒有。
如果你手上有原作的實際行為,這條可以直接推翻。

### 2. 第 9、11 章的章末抉擇連點會重複結算好感

這兩章的 `afterChapter` 是 `setTimeout(…, 700)` 才換畫面,那 700ms 內按鈕還在、還能點,
**每點一次就再套用一次好感與旗標**。實測連點三下:

| 章 | 點 1 下 | 連點 3 下(修正前) |
|---|---|---|
| 第 1 章(對照) | `{柳照微:2, 蘇檀:1}` | 一樣(畫面同步切換,點不到第二次) |
| 第 9 章 | `{蘇檀:1}` | `{蘇檀:3}` |
| 第 11 章 | `{柳照微:1, 江濯月:1}` | `{柳照微:3, 江濯月:3}` |

偏偏這兩章的結局正是由好感算出來的——**玩家手快點兩下,就可能換到另一個結局**。
第 1~8、10 章不受影響(`chapterClearScreen` 同步 `clear()`)。
已在章末抉擇與情緣選擇加上「按下即鎖住全部選項」。

### 3. 手機橫向沒有滿版(上下有帶狀區)

`height:100%` 在手機解到的是**含瀏覽器搜尋列的大視窗**,列展開時頁面比可見區高一截。
裝成 App 沒有搜尋列,兩者剛好相等,所以只有用瀏覽器開會出事。已改 `100dvh`
(保留 `100%` 當舊瀏覽器 fallback)、加 `overscroll-behavior:none`,
`fit()` 改量 `visualViewport` 並掛它的 `resize`/`scroll`。
manifest 另加 `display_override: ["fullscreen","standalone"]` 走真全螢幕。

## 四、內容補完

稽核 `game.json` 找出「有中文文字但沒有渲染路徑」的欄位,分兩輪補了 187 條:

| 補了什麼 | 筆數 | 演在哪 |
|---|---:|---|
| `battle_beats[].action` / `.failure` | 48 | 破局結果雙欄:左算式、右現場結果或劇情代價 |
| `clues[].route_text` 之外的 `battle_beats[].route_text` | 12 | 戰後劇情多一句掛路線名的分歧走向 |
| `route_a_name` / `route_b_name` | 11 章 | 顯示「護鐘線／循印線」而不是「A 線／B 線」 |
| `romance.*.normal` / `.finale` / solo | 8 | 結局正文後的情緣後日談 |
| `romance.candidates.*.after` | 3 | 許心意當下對方的回話 |
| `milestones.*.thread` | 12 | 天理分頁,插在第 2/4 條證據之後 |
| `battle_beats[].thread` | 24 | 通關畫面的「本章脈絡」 |

現在 112 個文字葉名逐一比對過,全部有渲染路徑。

## 五、測試現況

| 測試 | 項數 | 擋的是什麼 |
|---|---:|---|
| `check_design.py` | — | design.html 與 game.json 不一致 |
| `sw-deploy.mjs` | 8 | 每次部署把 33MB 資產刪光重抓;版本號與 SHELL_CACHE 走鐘 |
| `progress.mjs` | 27 | 按新案洗掉成就;選章跳回去好感亂掉 |
| `e2e.mjs` | 40 | 通關流程、離線播放、ESC 關窗、單例視窗、手機滿版、連點重複結算 |
| `endings.mjs` | 10 | 某個結局變成拿不到 |
| `achievements.mjs` | 3 | 某個成就變成拿不到 |

全部通過,console 零錯誤。

## 六、還沒收的事

- **Edge 裝成 App 的白條**:`display_override` 要**移除重裝**才生效(manifest 是安裝當下烤進去的),
  還沒有人回報重裝後的結果。
- **Chrome 不給安裝**:硬性門檻逐條驗過全部合格(icon 192/512 尺寸正確、SW 有 fetch handler、
  `display: standalone`、無 `prefer_related_applications`)。唯一補的是 `mobile-web-app-capable`
  (原本只有已棄用的 `apple-` 版),但那通常只是警告不是阻擋,**所以我不敢說補了就會好**。
  要確診請回報者開 DevTools → Application → Manifest,那頁會直接寫出 Chrome 拒絕的理由;
  也要先確認他是不是裝過又移除(Chrome 裝過就不再送 `beforeinstallprompt`,得先移除應用程式)。
- **無主長路的判定條件是推的**,見上面第三節。
