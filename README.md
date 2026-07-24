# 格物江湖錄:天理殘卷 — 網頁版(還原 + 二創)

原作《格物江湖錄:天理殘卷》是物理老師 [@changyi123456](https://github.com/changyi123456)
為學生做的物理解題 RPG(Godot 4.7)。本 repo 將其還原並改寫為**純網頁、可離線遊玩**的版本。

> 來源、著作權、授權詳見 [SOURCE.md](SOURCE.md)。**私有 repo,勿公開散布。**

## 內容規模

- 序章 + 11 章,A/B 雙劇情線
- 116 題物理(66 項一次性證據 + 44 場答題戰,國中理化~高中物理)
- 9 人好感(−5~+5)、3 條情緣、5 種道具、氣勢戰鬥
- 第 9 章 4 個普通結局 + 第 11 章 4 個完整版結局、30 項成就、15 首配樂鑑賞

## 目錄

```
data/          還原出的完整遊戲資料(JSON)
  all_consts.json   ← 全部系統的結構化資料(章節/題目/結局/成就/好感/道具…)
assets/
  img/         48 張場景/立繪/結局圖(WebP q82,約 8 MB)
  cells/       72 張證物特寫(六格圖切格,WebP)
tools/         還原用腳本(PCK 解包 + GDScript bytecode 還原 + 切圖)
digest.html    唯讀內容對照表(教師版解答,116 題全標正解)
```

## 網頁版(已完成,可玩)

純前端單頁,無框架、無外部依賴。開 `index.html`(經 http 或部署)即玩。

- **1:1 復刻**:固定 1280×720 舞台等比縮放(復現原作 Godot `canvas_items+keep`);全部題目/對白/結局逐字
- **完整系統**:A/B 雙線分流、5 道具、9 人好感、氣勢戰鬥、4+4 結局(含真結局)、3 情緣、30 成就、三印、配樂
- **離線**:Service Worker precache 核心(約 11 MB WebP);斷網可玩;PWA 可安裝
- **存檔**:localStorage 純 JSON,不含資產
- 手機直向提示轉橫屏

進度與驗證紀錄見 [NOTES.md](NOTES.md);還原的邏輯規則見 [tools/LOGIC.md](tools/LOGIC.md)。

### 本機試玩
```bash
cd gewu-jianghu-web && python3 -m http.server 8099
# 開 http://localhost:8099
```
