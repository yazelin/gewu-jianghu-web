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
- **Service Worker**(`sw.js`)precache 核心 124 檔(html/js/json + 120 張 WebP,約 11 MB)。
  已驗證:斷網重載題名正常、game.json 走快取。音樂與 ogg 不入 precache(按需 cache,守體積)。
- PWA `manifest.json`(fullscreen / landscape);手機直向顯示轉橫屏提示。

## 驗證紀錄(Playwright,headless Chromium)
- 全 11 章自動通關:cleared [0–11]、第 9 章結局 + 完整版結局 + 情緣 + 16 成就,零 error。
- 注入滿好感存檔:三印 3/3、真結局解鎖、結局播放 / 成就譜 / 配樂鑑賞視覺確認。
- A/B 分流 8 組案例、離線斷網重載,全數通過。

## 已知取捨(ponytail ceiling)
- **ogg 環境樂(22 首)**未內含:Godot 以 OggPacketSequence 包裝(非標準 ogg 分頁),需 Godot re-export
  或自寫 remuxer。刻意排除以守離線體積;配樂鑑賞列出、缺檔靜音降級。戰鬥樂(mp3)已接。
- 破局失敗僅「重來本章」;原作專屬失敗文本已在 `data/game.json` failure_texts(證物滅失文本已用於答錯)。
- A/B 分流的 alliance flags(結盟)主要由章末抉擇驅動,與原作章內特殊觸發可能有極少數邊界差異。
