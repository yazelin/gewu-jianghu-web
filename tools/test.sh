#!/usr/bin/env bash
# 一鍵跑全部自動化測試:design.html 內容對照 + 遊戲完整 E2E。
# 用法:bash tools/test.sh          (本機:自動起 http.server 8099 再收掉)
#       bash tools/test.sh --live   (改測線上 GitHub Pages,不起本機 server)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "########## 1/2 design.html 對照 game.json ##########"
python3 tools/check_design.py

echo
echo "########## 2/2 遊戲完整 E2E ##########"
if [[ "${1:-}" == "--live" ]]; then
  node tools/e2e.mjs --live
else
  # 起臨時本機 server,結束時收掉(不影響已在跑的其他 server)
  python3 -m http.server 8099 >/dev/null 2>&1 &
  SRV=$!
  trap 'kill $SRV 2>/dev/null || true' EXIT
  sleep 2
  node tools/e2e.mjs
fi

echo
echo "########## 全部測試通過 ##########"
