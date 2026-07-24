# 配樂音檔來源

網頁版的配樂**不使用**原作 PCK 內的 Godot 包裝檔(OggPacketSequence,非標準 ogg,需專用 remuxer),
而是直接取用原作標示的 **CC0 原始來源**(opengameart.org 等),重編成 ~64kbps ogg / 既有 mp3,
按章 lazy 載入(不進離線 precache,守體積)。

- 授權:全部 **CC0 1.0**(公眾領域,無需署名);逐首來源見 `THIRD_PARTY_NOTICES.md` 與 `asset-ledger.csv`。
- 曲目對應(投卷 / 破局)依原作各章配樂:第 N 章投卷 = 原作該章 investigation 曲、破局 = battle 曲。
- 共 24 首:18 首 ogg(CC0 原始重編)+ 6 首 mp3。約 30 MB,全部按需載入。

因為音樂本就是 CC0、且原作已公開來源網址,直接取原始檔比反解 Godot 包裝更乾淨,音質也不受原作 16kHz 降取樣所限。
