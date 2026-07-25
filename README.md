# 格物江湖錄:天理殘卷 — 網頁版

武俠懸疑・**物理解謎 RPG**,題目涵蓋國中理化至高中物理。純網頁、**可離線遊玩**、可安裝到手機主畫面。

- **線上遊玩:** https://yazelin.github.io/gewu-jianghu-web/
- **設計與公式站(攻略):** https://yazelin.github.io/gewu-jianghu-web/design.html

## 致謝原作者

原作《格物江湖錄:天理殘卷》由物理老師 **[@changyi123456](https://github.com/changyi123456)**
以 Godot 4.7 製作,為學生設計、以武俠推理帶出物理。
**遊戲的劇情、題目、美術與世界觀全部出自原作者**,本網頁版經其授權製作。

**若你喜歡這款遊戲,請支持原作者:**
[Instagram @aiphysicsteacher](https://www.instagram.com/aiphysicsteacher) ·
[自由贊助原作者](https://aiphysicsteacher123.bobaboba.me)

## 本網頁版的貢獻(由 [林亞澤 / yazelin](https://github.com/yazelin) 製作)

本網頁版基於原作 [gewu-jianghu-lu **release v1.4.0**](https://github.com/changyi123456/gewu-jianghu-lu/releases/tag/v1.4.0) 製作。
原作只發佈 Windows / macOS 執行檔、**沒有 Linux 版**;我把它做成純網頁版,讓所有平台(含手機)都能玩:

- **1:1 復刻**:11 章 + 序章、116 題物理、A/B 雙線分流、9 人好感、5 道具、氣勢戰鬥、
  4+4 結局(含真結局)、3 情緣、三印、30 成就、三檔難度、配樂——流程與判定逐條對照原作 bytecode 還原
- **純前端、可離線**:無框架、Service Worker 離線核心約 4 MB、PWA 可安裝、localStorage 存檔
- **手機友善**:等比縮放、直向提示轉橫屏、社群分享(把結局圖傳出去)
- **設計/公式站** `design.html`:完整劇情、答案、分支與後果、結局判定公式、30 成就條件**與解法**、
  人物誌(10 人立場/登場門檻/登場白 + 好感增減全出處與可達上限)、格物先賢譜、情緣三線完整判定、
  A／B 線判定表,以及**用 game.json 規則解出並在生成時驗證的真結局全章路線**

## 目錄

```
index.html / engine.js / sw.js / manifest.json   網頁版程式(MIT)
design.html                                       設計與公式站(攻略)
data/game.json                                    還原的完整遊戲資料
assets/img · assets/cells · assets/audio          圖(WebP)· 證物切格 · 配樂(CC0)
tools/                                            還原腳本 + 邏輯還原紀錄(LOGIC.md)
provenance/                                        原作授權告知 · SHA-256 · 音檔來源
SOURCE.md / LICENSE / NOTES.md                     來源溯源 / 授權 / 開發紀錄
```

## 授權

- **程式碼**:MIT([林亞澤](https://github.com/yazelin)),僅涵蓋本網頁移植原創程式碼。
- **遊戲內容與美術**:著作權屬原作者 [@changyi123456](https://github.com/changyi123456),經授權製作網頁版。
- **配樂/音效**:CC0 1.0。**字型** Noto Sans TC:SIL OFL 1.1。詳見 [LICENSE](LICENSE) 與 [SOURCE.md](SOURCE.md)。

## 本機試玩

```bash
python3 -m http.server 8099   # 於 repo 根目錄,開 http://localhost:8099
```

---

<div align="center">

**網頁版作者:林亞澤(yazelin)**

[GitHub](https://github.com/yazelin) ·
[Facebook](https://www.facebook.com/yaze.lin.gm) ·
[Buy Me a Coffee](https://buymeacoffee.com/yazelin) ·
[部落格](https://yazelin.github.io/)

</div>
