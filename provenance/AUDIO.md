# 配樂音檔來源

網頁版的配樂**不使用**原作 PCK 內的 Godot 包裝檔(OggPacketSequence,非標準 ogg,需專用 remuxer),
而是直接取用原作標示的 **CC0 原始來源**(opengameart.org 等),重編成 ~64kbps ogg / 既有 mp3,
按章 lazy 載入(不進離線 precache,守體積)。

- 授權:全部 **CC0 1.0**(公眾領域,無需署名);逐首來源見 `THIRD_PARTY_NOTICES.md` 與 `asset-ledger.csv`。
- 曲目對應(投卷 / 破局)依原作各章配樂:第 N 章投卷 = 原作該章 investigation 曲、破局 = battle 曲。
- 共 24 首:18 首 ogg(CC0 原始重編)+ 6 首 mp3。約 30 MB,全部按需載入。

因為音樂本就是 CC0、且原作已公開來源網址,直接取原始檔比反解 Godot 包裝更乾淨,音質也不受原作 16kHz 降取樣所限。

## 音效 SFX(`assets/audio/sfx/`)

為求 1:1 還原原作手感,音效**直接從原作 PCK 抽出**(Godot 匯入串流 `.oggvorbisstr` / `.mp3str` / `.sample`,
以自寫 remuxer 還原 vorbis 封包、PCM 轉檔),再轉成通用 mp3(iOS 亦可播)。觸發點與各章 clue 專屬音效
1:1 對齊原作 `main.gd`(`play_sfx` / `_campaign_clue_sfx`)。全部 **CC0 1.0**,來源見 `asset-ledger.csv`:

| 檔案(鍵) | 原作來源檔 | 作者 | opengameart 來源 |
|---|---|---|---|
| `correct.mp3`(答對鐘聲) | correct_bell.wav | Fupi | content/correct-bell |
| `paper.mp3`(翻卷) | paper_scroll.mp3 | Luckius | content/various-paper-sound-effects |
| `step_a.mp3` / `step_b.mp3`(腳步) | footstep_01/02.ogg | GboxMikeFozzy | content/footsteps-0 |
| `creak.mp3`(木頭吱嘎) | wood_creak.ogg | AntumDeluge / Department64 | content/tree-creaking |
| `gong.mp3`(鑼) | gong_01.ogg | rubberduck | content/100-cc0-sfx |
| `door.mp3`(開門) | door_open.ogg | rubberduck | content/100-cc0-sfx |
| `wood.mp3`(木擊) | wooden_01.ogg | rubberduck | content/100-cc0-sfx |

共 8 個、約 94 KB,**全部進離線 precache**(短音、體積小,首載即可完全離線)。
