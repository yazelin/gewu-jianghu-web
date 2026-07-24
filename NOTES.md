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

### 離線
- **Service Worker**(`sw.js`)全量 precache 138 檔(html/js/json + WebP + 圖示 + 21 音檔,約 19.5 MB)。
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

## 已知取捨(ponytail ceiling)
- **ogg 環境樂(22 首)**未內含:Godot 以 OggPacketSequence 包裝(非標準 ogg 分頁),需 Godot re-export
  或自寫 remuxer。刻意排除以守離線體積;配樂鑑賞列出、缺檔靜音降級。戰鬥樂(mp3)已接。
- 破局失敗僅「重來本章」;原作專屬失敗文本已在 `data/game.json` failure_texts(證物滅失文本已用於答錯)。
- A/B 分流的 alliance flags(結盟)主要由章末抉擇驅動,與原作章內特殊觸發可能有極少數邊界差異。
