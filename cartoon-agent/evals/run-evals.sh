#!/usr/bin/env bash
# Regression check: case-02 runs the pinned agent version against a SCRATCH memory store seeded with the
# memory snapshot in evals/case-02/input/ (so the live channel memory is never touched).
#   ./evals/run-evals.sh            -> evals/results-v<AGENT_VERSION>.json
source "$(dirname "$0")/../lib.sh"
cd "$ROOT"
CASE=evals/case-02; IN=$CASE/input
[ -f "$IN/series-bible.md" ] || { echo "Missing $IN/series-bible.md (copy runs/<case-1 session>/memory-snapshot/* there)"; exit 1; }

# scratch memory store, seeded from the snapshot
python3 -c 'import json; print(json.dumps({"name":"writers-room-eval-scratch","description":"Scratch copy of the channel canon for an eval run."}))' > /tmp/ms.json
api POST /memory_stores /tmp/ms.json HM || api POST /memory_stores /tmp/ms.json H
MS=$(jget 'd["id"]'); echo "✅ 🧠 scratch memory store $MS"
for f in series-bible.md episode-log.md; do
  python3 -c 'import json,sys; print(json.dumps({"path": "/"+sys.argv[1], "content": open(sys.argv[2]).read()}))' "$f" "$IN/$f" > /tmp/mem.json
  api POST "/memory_stores/$MS/memories" /tmp/mem.json HM || api POST "/memory_stores/$MS/memories" /tmp/mem.json H
done

python3 - "$AGENT_ID" "$AGENT_VERSION" "$ENV_ID" "$MS" > /tmp/session.json <<'PY'
import json, sys
ag, ver, env, ms = sys.argv[1:]
print(json.dumps({"agent": {"type": "agent", "id": ag, "version": int(ver)}, "environment_id": env, "title": f"eval case-02 · v{ver}",
  "resources": [{"type": "memory_store", "memory_store_id": ms, "access": "read_write"}]}))
PY
api POST /sessions /tmp/session.json; SID=$(jget 'd["id"]'); echo "✅ ▶️ eval session $SID"
python3 -c 'import json; print(json.dumps({"events":[json.load(open("kickoff.json"))]}))' > /tmp/k.json
api POST "/sessions/$SID/events" /tmp/k.json

"$ROOT/poll.sh" "$SID" --wait
api GET "/sessions/$SID"
jget 'json.dumps({"case":"case-02","session":d["id"],"agent_version":d["agent"].get("version"),"verdicts":[{"result":e.get("result"),"explanation":e.get("explanation")} for e in d.get("outcome_evaluations") or []],"usage":d.get("usage")}, indent=2)' > "evals/results-v$AGENT_VERSION.json"
"$ROOT/fetch.sh" "$SID" >/dev/null
echo "→ evals/results-v$AGENT_VERSION.json · outputs in runs/$SID"
