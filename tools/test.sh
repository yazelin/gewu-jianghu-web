#!/usr/bin/env bash
# 一鍵跑全部自動化測試:design.html 內容對照 + 遊戲完整 E2E。
# 用法:bash tools/test.sh          (本機:自動起 http.server 8099 再收掉)
#       bash tools/test.sh --live   (改測線上 GitHub Pages,不起本機 server)
#       bash tools/test.sh --full   (再加跑「八結局實跑」與「30 成就實跑」,約 12 分鐘)
#
# 為什麼實跑那兩支不預設跑:各要 5~7 分鐘(每條路線都是完整通關)。
# 但改動結局判定、好感、旗標、封印、獎勵、成就條件時一定要跑 --full——
# 那類 bug 不會讓畫面壞掉,只會讓某個結局或成就變成永遠拿不到。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "########## 1/4 design.html 對照 game.json + 暖快取順序 ##########"
python3 tools/check_design.py
# CORE 的順序決定「下載到一半就斷線」的人能玩到哪一章。順序錯了不會有任何錯誤訊息,
# 所以要有守門:改過資產清單就重跑 python3 tools/gen_core.py。
python3 tools/gen_core.py --check

echo
echo "########## 2/4 SW 部署存活(資產快取不被改版清掉)##########"
node tools/sw-deploy.mjs

echo
echo "########## 3/4 進度與收藏庫(新案確認 / 成就跨周目 / 選章)##########"
node tools/progress.mjs

echo
echo "########## 4/4 遊戲完整 E2E ##########"
if [[ "${1:-}" == "--live" ]]; then
  node tools/e2e.mjs --live
else
  # 起臨時本機 server,結束時收掉(不影響已在跑的其他 server)。
  # 埠要動態挑:8099 被別的專案殘留的 http.server 佔過,綁不上時 python 直接失敗退出,
  # 而測試照樣連得上那個埠 —— 於是整輪測到別人的網站,還一路報看不懂的錯
  # (症狀是 newState is not defined,因為那根本不是這個遊戲)。
  PORT=$(python3 -c "import socket;s=socket.socket();s.bind(('127.0.0.1',0));print(s.getsockname()[1]);s.close()")
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SRV=$!
  trap 'kill $SRV 2>/dev/null || true' EXIT
  sleep 2
  # 確認連到的真的是這個 repo,不是別人佔埠的服務
  curl -sf "http://127.0.0.1:$PORT/data/game.json" -o /dev/null \
    || { echo "本機 server 起不來或埠被佔(埠 $PORT)"; exit 1; }
  GEWU_PORT="$PORT" node tools/e2e.mjs
fi

if [[ "${1:-}" == "--full" ]]; then
  echo
  echo "########## 5/6 八結局實跑(正常遊玩打到每一個結局)##########"
  node tools/endings.mjs
  echo
  echo "########## 6/6 三十成就實跑(連續多週目收齊)##########"
  node tools/achievements.mjs
fi

echo
echo "########## 全部測試通過 ##########"
