#!/bin/zsh
# Dump REA pseudocode for a list of Ghidra addresses into out/functions/<addr>.txt
set -u
export GHIDRA_INSTALL_DIR=/Users/judge/.local/share/ghidra/ghidra_12.1.2_PUBLIC
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
cd "$(dirname "$0")"
mkdir -p out/functions
for a in "$@"; do
  f="out/functions/${a}.txt"
  [[ -s "$f" ]] && continue
  rea function NM_UNPACKED.EXE "$a" --snapshot ./nm-snap --format json 2>/dev/null \
    | python3 -c '
import json,sys
d=json.load(sys.stdin); r=d.get("normalized_result") or {}
p=r.get("procedure") or {}
print("NAME",p.get("name"),"ENTRY",p.get("address"))
print("RANGES",p.get("body",{}).get("ranges"))
print("CALLERS",[(c.get("name"),c.get("address")) for c in r.get("callers",[])])
print("CALLEES",[(c.get("name"),c.get("address")) for c in r.get("callees",[])])
print("-----")
print(r.get("pseudocode"))
' > "$f"
  echo "done $a $(wc -l < "$f") lines"
done
