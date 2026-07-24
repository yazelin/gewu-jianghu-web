# 來源與授權

## 原作

- **作品**:《格物江湖錄:天理殘卷》(GeWu Tianli)
- **原作者**:GitHub [@changyi123456](https://github.com/changyi123456) — 一位物理老師,為學生製作的物理解題 RPG
- **作者 Instagram**:[@aiphysicsteacher](https://www.instagram.com/aiphysicsteacher)
- **自由贊助**:https://aiphysicsteacher123.bobaboba.me
- **原始發佈**:https://github.com/changyi123456/gewu-jianghu-lu
- **引擎**:Godot 4.7(單檔匯出,PE32+ / macOS Universal)

## 本 repo 的資料從何而來

原始碼未公開;原作者只發佈了編譯後的 Windows / macOS 執行檔。本 repo 內的資料是從
**合法下載的 v1.4.0 Windows 免費發佈檔**還原:

| 檔案來源 | SHA-256 |
|---|---|
| `GeWu_Tianli_v1.4.0_Windows_x86_64.zip` | `6ffe25a56c61ddbeea5b34bed9a9592225838adadf0812bc0e233273d48a523a` |
| `GeWu_Tianli_v1.4.0.exe` | `10fa7b96bd593552cd2a1e45dc70451d9ac9896f6531a96b3798743f57d2a193` |

還原方法(腳本見 `tools/`):
1. 從 exe 尾端解出內嵌的 Godot PCK(格式 v4、GDPC、flags=2)。
2. 解 zstd 壓縮的 `.gdc` GDScript bytecode,還原常數池與 token 串 → `data/all_consts.json`。
3. 從 `.ctex` 貼圖切出無損 WebP → 轉為 `assets/*.webp`。

**文字、題目、正確答案、詳解、對白** = 從遊戲檔逐字解碼的原始值,未經改寫。
**圖片** = 從遊戲貼圖 1:1 取出(切格邏輯已對照 `main.gd` 的 `_atlas_texture(atlas, 3, 2, index)` 驗證一致)。

## 授權

原作者已口頭授權本 repo 擁有者 **林亞澤(yazelin)** 自行修改、二次創作、及製作網頁版。

- 原作的**程式、劇情、介面編排、生成美術**著作權仍屬原作者 [@changyi123456](https://github.com/changyi123456)。
- 隨遊戲散布的**配樂與音效**為 CC0 1.0(來源見 `data/` 內的第三方告知與 `asset-ledger`)。
- **字型** Noto Sans TC 為 SIL OFL 1.1。

## 使用限制

- 本 repo 為**私有**。內含的還原資料等同「教師版解答母本」(每題標了正解與詳解),不得公開散布,以免成為學生作弊金鑰。
- 本網頁二創上線前,對外版本需與原作者確認署名方式與連結(Instagram / 贊助頁)。
