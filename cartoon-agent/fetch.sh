#!/usr/bin/env bash
# ./fetch.sh [SESSION_ID]   download the run's outputs into runs/<session>/ (only once the session is idle)
source "$(dirname "$0")/lib.sh"
SID=${1:-$SESSION_ID}; OUT="$ROOT/runs/$SID"; mkdir -p "$OUT"
api GET "/files?scope_id=$SID"
jget '"\n".join("%s\t%s" % (f["id"], f["filename"]) for f in d["data"])' | while IFS=$'\t' read -r fid name; do
  [ -z "$fid" ] && continue
  dest="$OUT/$name"; mkdir -p "$(dirname "$dest")"
  curl -sS --fail "$BASE/files/$fid/content" "${H[@]}" -o "$dest" && echo "⬇️  $name"
done
echo "→ $OUT"
