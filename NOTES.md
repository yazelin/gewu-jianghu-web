# 開發進度

## ✅ 全部完成(3 階段,每階段 Playwright 驗證,零 console error)

### 階段 1 — 可玩核心
題名頁 / 電影式序引 4 幕 / 序章 6 熱點調查 / 章節迴圈(章名卡→A・B 線對白→共通對白含好感抉擇
→六證調查→四場破局戰→章末抉擇→分流)/ localStorage 存讀檔。

### 階段 2 — 系統
- **精確 A/B 分流**:world_flags + route_table(從 `_determine_campaign_route` 還原)。
  序章 keeper_saved 決定 ch1;各章末抉擇設 people/alliance flags 決定下一章;ch10 依第 9 章結局。
  已驗證:ch1 keeper→A/未救→B、ch5 雙旗標 AND、ch10 結局決定。
- **行囊 5 道具**:格物籤(排除錯項)/墨線尺(提示)/清心散(關間回氣)/定心符(自動保命)/吐納殘訣(+氣勢上限)。
- **章節獎勵**:固定清心散,≥5 證加格物籤,≥6 證加吐納殘訣(once-only)。
- **好感面板**:9 人立繪 ±5 刻度 + 關係階梯 + 情緣階段。
- 取證觸發章末劇情推進里程碑;破局後戰後劇情 beats。

### 階段 3 — 結局 / 情緣 / 成就 / 配樂
- **三印**(seal_snapshot 忠實還原):人和/理證/殘卷印。
- **結局 4+4**:第 9 章 4 普通結局 + 第 11 章 4 完整版結局。真結局(天地共衡)嚴格條件:
  三印全+否決條款+九路覆核+≥3 深交+裴無咎≥1,達標才解鎖(已驗證三印 3/3 觸發)。
- **情緣 3 線**:柳照微/江濯月/蘇檀;第 9 章許諾(≥2)、第 11 章定局(延續或 ≥4)。
- **30 成就**:章回/格物/人物/三印/敗局 5 類,reconcile + 解鎖 toast + 成就譜(未解顯模糊線索)。
- **配樂系統**:按章 lazy 背景樂 + ♪ 靜音(持久)+ 配樂鑑賞 15 曲。接 6 首 MP3(戰鬥樂+環境樂)。
- **音效 SFX**(1:1 還原原作):8 個音效由原作 PCK 抽出(答對鐘聲 / 翻卷 / 腳步 / 木頭 / 鑼 / 開門),
  觸發點與各章 clue 專屬音效對齊原作 `play_sfx` / `_campaign_clue_sfx`(見 `provenance/AUDIO.md`)。

### 場景保真(對照原作 main.gd 反編)
- **證據點**:狀態符號(◇/✓/✕)+ 證據名稱按鈕 + 物理概念 tooltip(非純圓點,還原原作 190×38 按鈕)。
- **對話立繪**:發話者為角色時左側顯示大立繪卡(還原原作 `_portrait_card`),旁白時隱藏。
- **好感／行囊／格物卷 三面板**:由簡化清單改為原作固定座標排版板(`toggle_affinity_board` /
  `toggle_inventory` / `toggle_evidence_board`)——好感 3×3 網格卡 + 刻度計 + 三印狀態列 + 情緣資格說明;
  行囊道具卡列 + 氣勢列 + 關鍵物彙整 + 各道具使用鈕;格物卷雙欄 ◆ 證據卡。文字/座標/顏色對齊原作。

### 離線
- **Service Worker**(`sw.js`)全量 precache 146 檔(html/js/json + WebP + 圖示 + 21 配樂 + 8 音效,約 19.6 MB)。
  首次進入即背景載齊,之後完全離線可玩;程式走 network-first、`/assets/` 走 cache-first。
- PWA `manifest.json`(`display:standalone` / landscape,可安裝);手機直向顯示轉橫屏提示。

## 自動化測試(可重複跑,免肉眼檢查)
一鍵:`bash tools/test.sh`(本機自動起 server)/ `bash tools/test.sh --live`(改測線上 Pages)。
兩支獨立測試,退出碼 0=全過、1=有落差(可接 CI):

- **`tools/check_design.py`** — 拿 `data/game.json`(事實母本)自動對照 `design.html`(公式站/攻略):
  逐塊解析每題的正解標記,驗 116 題答案與遊戲完全一致;並驗題數守恆、11 章 / 8 結局 / 30 成就 /
  情緣候選齊備、保留原作者致謝。改資料後重生成公式站,跑這支就知道有沒有漏或標錯。
- **`tools/e2e.mjs`**(Playwright headless)— 15 項:
  - A 線新局→選難度→序→第一~九章自動全破到普通結局(用 game.json 答案鍵自動作答)。
  - 隱藏路線:注入「三印齊全」合法存檔進第十章,**實跑第十、十一章**到完整版真結局
    `heaven_earth_shared`(cleared 含 10、11)。
  - 解鎖邏輯單元檢查:封印計算 3/3、隱藏門扉正/反例、真結局門檻。
  - 題名分享鈕、配樂鑑賞可單獨播放、成就譜、公式站可達。
  - Service Worker 全量 precache、斷網重載題名、未播章末音檔命中快取。
  - 全程 console 零錯誤。
- 現況:本機 15/15、design 對照全一致;線上 Pages 同套亦通過。

## 視覺語言:冷面板 vs 暖面板,兩層是刻意的

| | 用色 | 用在哪 |
|---|---|---|
| **冷面板** `rgba(9,17,19,.99)` + 銅邊 + `0 20px 60px` 投影 | `.pboard` / `.modal .sheet` | 跳出遊戲世界的**查閱與系統**:成就譜、結局圖鑑、配樂鑑賞、先賢譜、好感、行囊、格物卷、選單、確認框 |
| **暖面板** `rgba(20,17,14,.92)` 系 | `.dbox` / `.choicebox` / `.choice` / `.btn` | **劇情當下**:對話框、抉擇、破局戰,要像場景裡的燈火與紙 |

兩者共用同一套強調色:**朱砂 `--cin` 做強調與 hover、銅 `--br` 做提示與標題、米 `--pa` 做正文**。
所以冷暖之分不是不一致,是「meta vs 劇情」的分層——加新畫面時照這張表歸類。

**每個冷面板的表頭一律用 `boardHeader()`**:銅色標題 → 小注 → **朱砂細線**。
那條線是整套設計的簽名元素,而它最容易被漏掉——配樂鑑賞、結局圖鑑、先賢譜原本各自手刻標題,
三個全都沒有畫線,擺在成就譜旁邊就像另一個產品。抽成共用函式之後就不可能再漏。
`.modal` 用 `modalShell()`,同一套表頭 + 圓形 X(沿用 `.pclose`,ESC 才走同一條關閉路徑)。

## 效能:滿版背景不要掛 filter(不只是別動畫它)

先是發現「動畫 filter」很貴(見下一段),修掉之後才看見下一層:**靜態 filter 也很貴**。
序引 4 秒取樣只有 31 fps,逐項關掉後只有 `.bg` 的 filter 有差(雨幕、kenburns、
letterbox、印章全部關掉都沒差)。而且不是幾道的問題,是有沒有的問題:

| .bg 的 filter | fps |
|---|---|
| 三道 brightness+contrast+saturate | 31.5 |
| 只留一道 brightness | 34.7 |
| 只留一道 contrast | 35.7 |
| **完全不掛** | **54.7** |

提升合成層試過六種寫法(will-change:transform / filter、translateZ、雨幕提層…)**全部無效**。

**正解:把調色烘進圖檔,執行期零 filter。** 亮度因為各畫面不同(`--bgb` .3~.86)不能烘,
改用**黑色遮罩**:黑色疊 α 的結果 = 原色×(1−α),與 `brightness(1−α)` 數學上完全等價,
但走合成器幾乎免費。

烘的時候不要用線性 contrast:`(x−0.5)×1.1+0.5` 會把暗部推成負值,夜景實測**暗部 23% 被壓成純黑**,
而且烘進去就救不回來。改用保端點的 S 曲線 `x^a/(x^a+(1−x)^a)`,0→0、1→1 不截切。
參數對著改動前的螢幕實測值校準(不是憑感覺):a=1.35、saturate=1.25。

| | fps | 中間調 | 飽和 |
|---|---|---|---|
| 題名 改前 | 57.5 | 12.0 | 0.473 |
| 題名 改後 | 60.2 | 11.7 | 0.468 |
| 序引 改前 | 30.3 | 17.0 | 0.284 |
| **序引 改後** | **59.9** | 16.3 | 0.281 |

只有 24 張真的當滿版背景用的圖需要烘(不是全部 132 張),**改檔名加 `-g`** 而不是 bump
`ASSET_CACHE`——改名只重抓這 24 張 7.1MB,bump 會讓整包 33MB 重來。

## 效能:不要動畫 filter

首頁題字的呼吸光暈曾把畫面從 60fps 砍到 **16.4fps**,最慢一幀 **117ms**(肉眼可見卡頓)。
原因是 `animation` 改的是 `filter`,而那個 filter 是四道鏈式 `drop-shadow`,
半徑還在 3→4、11→17、26→40 之間變化。等於**每一幀**都要把整張 2100×640 重做四次模糊。

逐項關掉量出來的證據(雨幕、kenburns、背景 filter、印章全部關掉都沒差,只有它有差):

| 方案 | fps | 最慢一幀 |
|---|---|---|
| 單層四道 + 動畫 filter | 16.4 | 117 ms |
| 兩層四道 + 動畫 opacity | 48.5 | 33 ms |
| 兩層兩道 + 動畫 opacity | 52.4 | 50 ms |
| 單層四道靜態 | 59.9 | 33 ms |
| **單層兩道靜態(現況)** | **60.2** | **16.8 ms** |

規矩:**`filter` / `box-shadow` / `border-radius` 這類要重新光柵化的屬性不要放進 keyframes。**
需要脈動就疊兩層、各自靜態,動畫 `opacity`(合成器處理,幾乎免費)。但那還是要付兩層的
光柵化成本,所以先問「這個脈動值不值 10fps」——這次的答案是不值。

## 存檔分兩層:本局進度 vs 收藏庫

| localStorage 鍵 | 內容 | 新案入局時 |
|---|---|---|
| `gewu_save_v1` | 本局進度:章節、好感、旗標、證據、`rewarded`、各章入口快照 | **清掉** |
| `gewu_codex_v1` | 屬於玩家的紀錄:`achievements`、`seen_normal`、`seen_finale`、`perfect`、`grandmaster`、`equipped_title` | **保留** |

**為什麼要分:** 集滿型成就本來拿不到。`ending_all_normal` 要求同一份存檔裡累積 4 個普通結局,
但第 9 章走哪個結局是由第 1~9 章累積的好感決定的,想換結局就得改前面章節,
而唯一能回頭的方法(新案)剛好把 `seen_normal` 清成 `[]` —— 收集迴圈跟自己打架。
分層之後多周目變成累加,`ending_all_normal` / `ending_all_complete` 才真的拿得到。

`rewarded`(本章獎勵已發過)**不放進收藏庫** —— 那是本局狀態,「重來本章」要能重發。

`save()` 每次都會 `mergeCodex(S)`(旗標 OR、清單聯集,只進不出);`newState()` 會 `...codexSeed()` 把收藏庫倒回來;
開機時雙向合流一次,舊玩家的成就會自動搬進收藏庫。

## 選章:回到快照,不是憑空跳章

每次進章(序章結束、章末推進、隱藏門扉)都會 `checkpoint()` 存一份該章入口的 S 快照到 `save.checkpoints[n]`。
題名的「選章」在**通關過一次之後**開放,選了就把那份快照整個換回來。

**不能用預設值跳章** —— 第 9 章結局是 `柳照微+江濯月+霍離` 對 `顧玄策+寧觀瀾+…` 對 `裴無咎*2+…` 的比大小,
拿預設好感跳到第 9 章會算出毫無意義的結局。快照才讓結局判定維持正確。

`tools/progress.mjs` 擋這兩件事的回歸(新案確認、成就跨周目、選章好感正確),已接進 `test.sh`。

## 離線快取:兩層,改版時只 bump 該 bump 的那個

`sw.js` 有**兩個**快取名,分家的依據是「壽命」不是「一起改」:

| 常數 | 內容 | 什麼時候 bump |
|---|---|---|
| `SHELL_CACHE` | HTML / `engine.js` / `manifest.json` / `data/`(約 0.4MB) | **每次部署都要 bump**,這是觸發新 SW + 自動重整的開關 |
| `ASSET_CACHE` | `assets/` 底下全部(圖 + 音,約 33MB) | **平常不要動**。只有「同名檔換了內容」才 bump |

新增或改名的資產不用 bump —— URL 變了就自然是新的,快取查不到就會去抓。本 repo 的慣例是改內容時
一併改檔名(`title_keyart_v14.webp`),照這個慣例走就永遠不用碰 `ASSET_CACHE`。

**為什麼要分:** 原本兩者共用一個 `CACHE`,而它每次部署都 bump,`activate` 就把 33MB 整包刪掉重抓。
量過:改版後若瀏覽器 HTTP 快取已被清,實抓 **28.86MB**;分層之後同樣情境是 **0.84MB**。
而且每次重寫 33MB 都在製造掉檔窗口 —— `cache.put` 失敗(配額不足、SW 被回收)是靜默的,
排在最後、檔案最大的音檔最容易掉,結果就是「圖都在、音樂不能播」。

**兩條配套的規矩:**
- 徽章不准自我宣告。`index.html` 跑完暖快取後會再問 SW `offline-status`(逐項 `cache.match` 實查),
  只有真的一個不缺才顯示「已可離線遊玩」,補不齊就顯示 `離線包 154/160`。
  數 `fetch` 成功次數是不算數的 —— fetch 回 200 不代表 `cache.put` 有成功。
- 音檔走 Range 請求拿到的是 **206**,`Cache.put` 對 206 會直接 throw。`cacheable()` 擋掉它,
  另外用 `backfill()` 抓一次完整檔補存,所以「聽過的曲子」自己會留在離線包裡。

`bash tools/test.sh` 的第 2 關(`tools/sw-deploy.mjs`)就是在擋這件事回歸 —— 它會實際模擬一次部署,
斷言資產快取存活、音檔 31/31 沒被清掉。這個 bug 壞掉時功能完全正常,只是偷抓 28MB,一般 E2E 測不出來。

## 手機滿版:用 100dvh,不要用 height:100%

手機瀏覽器的「搜尋列」會隨捲動收合/展開,可見高度跟著變。`height:100%` 解到的是
**含 chrome 的大視窗**,所以列展開時頁面比可見區高一截 → 舞台上下露出沒被填滿的帶狀區
(症狀就是「裝成 App 正常、用瀏覽器開有白條」,差的正好是一條搜尋列的高度)。

三個地方要一起改,少一個就還是漏:

- `html,body` / `#wrap` / `#ambient` 都寫 `height:100dvh`(前面留一行 `height:100%` 當舊瀏覽器 fallback)。
- `html,body` 加 `overscroll-behavior:none`,擋橡皮筋回彈時露出瀏覽器底色。
- `fit()` 量的是 `visualViewport.width/height`,不是 `innerWidth/innerHeight` ——
  瀏覽器列收合時 `innerHeight` 不保證同步更新,舞台會停在舊比例。
  同理事件要掛 `visualViewport` 的 `resize`/`scroll`,只掛 window 的 `resize` 收不到這種變化。

擋板:e2e「手機橫向:瀏覽器列收合/展開後仍滿版」——把視窗高在 340/390 之間來回改,
每次都驗 `#wrap`、`#ambient` 的 `offsetHeight` 等於 `innerHeight` 且舞台上下留白 ≤1px。
注意 `#ambient` 有 `scale(1.18)` 做模糊溢出,量它只能用 `offsetHeight`,
`getBoundingClientRect()` 會把 transform 算進去(401 ≠ 340)。

## 資料裡有、卻沒有渲染路徑的欄位

game.json 是從原作反編來的,欄位比我們演的多。**壞掉時畫面完全正常,只有內容悄悄消失**,
一般 e2e 測不出來,所以每補一項就要留擋板。已補:

- `battle_beats[].action` / `.failure` → 破局結果雙欄(左算式、右現場結果/劇情代價)。
  與 `battles` 逐題對齊,但只有第 1~6 章有(各 4 題 4 筆),7~11 章沒有 → 不能假設 beat 存在。
- `route_a_name` / `route_b_name` → 顯示「護鐘線／循印線」而不是「A 線／B 線」。
- `romance.candidates.*.normal|finale` / `solo_normal|solo_finale` → 結局正文後的情緣後日談。
  普通結局用 `normal`、完整版結局用 `finale`,**兩者文字不同不可共用**。

第二輪再挖出來的:

- `battle_beats[].route_text.A|B`(12)→ 戰後劇情多一句掛路線名的分歧走向。
- `romance.candidates.*.after`(3)→ 許心意當下對方的回話,選完先播再往下走。
- `milestones.*.thread`(12)→ 天理分頁,依取得順序插在第 2/4 條證據之後(青色 ◆ 與證據脈絡區分)。
- `battle_beats[].thread`(24)→ 通關畫面的「本章脈絡」。破局全勝才走到那頁,所以到此都成立。

**稽核方法別再用純靜態比對,我來回錯過兩次:**

1. 用葉欄位名比對 → **漏掉動態取鍵**。`G.failure_texts[cl.id]`、`c[kind]`、`route_text[S.route]`
   的葉名(`bell`、`normal`、`A`)在程式碼裡當然找不到,但它們有在演,結果誤報 100+ 條。
2. 改成「祖先鏈上有動態取鍵就放行」 → **反向漏報**。`chapters[` 到處都是,底下什麼都被放行,
   `battle_beats[].route_text` 就是這樣躲過去的。
3. 再加 DOM 變數黑名單 → **又誤殺**。`b.explanation` 的 `b` 同時是常見 DOM 變數名。

可用的做法:列出每個文字葉名 + 它在 engine.js 的**實際引用行**,人工掃一遍(約 110 行,很快)。
剩下的 `✗` 只會是三組動態取鍵(`failure_texts.*`、`A`/`B`、`normal`/`finale`),逐一寫 runtime
測試驗它真的印得出來。**「有引用」不等於「有演」**——`.after` 就撞到 DOM 的 `Element.after()`。

## 手機安裝與全螢幕

- `display: standalone` 會留一條瀏覽器/系統列(回報過「橫向上下有白條」)。
  橫式遊戲加 `display_override: ["fullscreen","standalone"]`,支援的走全螢幕、不支援的照舊。
- Chrome 認的是 `mobile-web-app-capable`,`apple-mobile-web-app-capable` 已棄用(可並存)。
- 畫面右下 `#ver` 版本號與 `SHELL_CACHE` 同號,sw-deploy 有擋板盯著別走鐘——
  版本號騙人比沒有版本號更糟。

## 已知取捨(ponytail ceiling)
- **配樂**取原作標示的 CC0 原始來源重編(非反解 PCK),見 `provenance/AUDIO.md`;**音效 SFX** 則以自寫 remuxer
  從原作 PCK 的 Godot 匯入串流(OggPacketSequence)抽出、8 個全接並進 precache。
- 破局失敗僅「重來本章」;原作專屬失敗文本已在 `data/game.json` failure_texts(證物滅失文本已用於答錯)。
- A/B 分流的 alliance flags(結盟)主要由章末抉擇驅動,與原作章內特殊觸發可能有極少數邊界差異。
