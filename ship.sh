#!/usr/bin/env bash
set -euo pipefail
echo "ship.sh rev 1.3"
[ "$USER" = "paceai1" ] || { echo "WRONG MACHINE: $USER"; exit 1; }
cd "$(dirname "$0")"
[ -f src/build.js ] || { echo "WRONG DIR: $(pwd)"; exit 1; }
[ -f .vercel-link/project.json ] || { echo "MISSING .vercel-link/project.json"; exit 1; }
echo "--- build ---"
node src/build.js
echo "--- restore vercel link (build wipes dist/) ---"
mkdir -p dist/.vercel
cp .vercel-link/project.json dist/.vercel/project.json
cat dist/.vercel/project.json; echo
STAMP=$(grep -o 'build: [^>]*' dist/index.html | head -1 | sed 's/ *-*$//' || true)
[ -n "$STAMP" ] || { echo "FAIL: no build stamp in dist/index.html"; exit 1; }
echo "local stamp: $STAMP"
echo "--- gates ---"
node src/validate.js
MODE="${1:-preview}"
echo "--- scrub credentials from deploy root ---"
rm -f dist/.env.local dist/.env
find dist -name '.env*' -print
echo "--- deploy: $MODE ---"
cd dist
if [ "$MODE" = "prod" ]; then
  npx vercel deploy --prod --yes 2>&1 | tee /tmp/ship.log
else
  npx vercel deploy --yes 2>&1 | tee /tmp/ship.log
fi
rm -f .env.local .env
cd ..
if [ "$MODE" = "prod" ]; then
  URL="https://el3vate.vercel.app"
  echo "--- verify live site serves this build ---"
  OK=0
  for i in 1 2 3 4 5; do
    LIVE=$(curl -sS -H 'Cache-Control: no-cache' "$URL/" | grep -o 'build: [^>]*' | head -1 | sed 's/ *-*$//' || true)
    echo "  attempt $i: ${LIVE:-<none>}"
    if [ "$LIVE" = "$STAMP" ]; then OK=1; break; fi
    sleep 3
  done
  [ "$OK" = "1" ] || { echo "FAIL: live site not serving this build (local: $STAMP)"; exit 1; }
  echo "  match"
else
  URL=$(grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' /tmp/ship.log | tail -1)
fi
echo "--- open: $URL ---"
open "$URL"
