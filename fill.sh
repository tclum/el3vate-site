#!/usr/bin/env bash
set -euo pipefail
echo "fill.sh rev 1.0"
LIVE_KEY="liveBuild"
[ "$USER" = "paceai1" ] || { echo "WRONG MACHINE: $USER"; exit 1; }
cd "$(dirname "$0")"
SLUG="${1:?usage: ./fill.sh <slug> \"text\"}"
TEXT="${2:?usage: ./fill.sh <slug> \"text\"}"
F="content/$SLUG.json"
[ -f "$F" ] || { echo "NO SUCH DISCIPLINE: $F"; ls content/*.json | xargs -n1 basename; exit 1; }
node -e '
const fs=require("fs");
const [f,key,txt]=process.argv.slice(1);
const d=JSON.parse(fs.readFileSync(f,"utf8"));
if(!(key in d)) { console.error("KEY NOT PRESENT: "+key); process.exit(1); }
d[key]=txt;
fs.writeFileSync(f,JSON.stringify(d,null,2)+"\n");
console.log("set "+key+" on "+f+" ("+txt.length+" chars)");
' "$F" "$LIVE_KEY" "$TEXT"
./ship.sh prod
