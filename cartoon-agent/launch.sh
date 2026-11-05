#!/usr/bin/env bash
# Resumable launch: every step reads IDS.env and skips objects that already exist.
#   ./launch.sh                  first launch (model → environment → memory store → agent → session → kickoff)
#   ./launch.sh run "<title>"    new run against the live agent + memory store (fresh session + kickoff)
source "$(dirname "$0")/lib.sh"
cd "$ROOT"
MODE=${1:-launch}; TITLE=${2:-"writers room · first run"}
[ "$MODE" = run ] && unset SESSION_ID KICKED_SESSION

# 1 · model: newest Opus-class
if [ -z "${MODEL:-}" ]; then
  api GET /models
  MODEL=$(jget 'next(m["id"] for m in d["data"] if "opus" in m["id"])')
  save MODEL "$MODEL"; echo "✅ model $MODEL"
fi

# 2 · 📦 environment
if [ -z "${ENV_ID:-}" ]; then
  api POST /environments environment.json
  save ENV_ID "$(jget 'd["id"]')"; echo "✅ 📦 environment $ENV_ID"
fi

# 3 · 🧠 memory store (starts empty: the first run writes the series bible)
if [ -z "${MEMSTORE_ID:-}" ]; then
  python3 -c 'import json; print(json.dumps({"name":"writers-room-memory","description":"Canon for the cartoon channel: series-bible.md (character, friends, locations, style string) and episode-log.md (every episode written so far)."}))' > /tmp/ms.json
  api POST /memory_stores /tmp/ms.json HM || api POST /memory_stores /tmp/ms.json H
  save MEMSTORE_ID "$(jget 'd["id"]')"; echo "✅ 🧠 memory store $MEMSTORE_ID"
fi

# 4 · 🤖 agent (model substituted from step 1)
if [ -z "${AGENT_ID:-}" ]; then
  python3 - "$MODEL" > /tmp/agent.json <<'PY'
import json, sys
a = json.load(open("agent.json")); a["model"] = sys.argv[1]; print(json.dumps(a))
PY
  api POST /agents /tmp/agent.json
  save AGENT_ID "$(jget 'd["id"]')"; save AGENT_VERSION "$(jget 'd["version"]')"
  echo "✅ 🤖 agent $AGENT_ID (v$AGENT_VERSION, $MODEL)"
fi

# 5 · ▶️ session, pinned to the current agent version, memory attached read_write
if [ -z "${SESSION_ID:-}" ]; then
  python3 - "$AGENT_ID" "$AGENT_VERSION" "$ENV_ID" "$MEMSTORE_ID" "$TITLE" > /tmp/session.json <<'PY'
import json, sys
ag, ver, env, ms, title = sys.argv[1:]
print(json.dumps({"agent": {"type": "agent", "id": ag, "version": int(ver)}, "environment_id": env, "title": title,
  "resources": [{"type": "memory_store", "memory_store_id": ms, "access": "read_write",
                 "instructions": "The channel's canon: series-bible.md and episode-log.md. Read before writing; append new episodes to the log."}]}))
PY
  api POST /sessions /tmp/session.json
  save SESSION_ID "$(jget 'd["id"]')"; echo "✅ ▶️ session $SESSION_ID"
fi

# 6 · 🎯 outcome kickoff (task + rubric + max_iterations 3)
if [ "${KICKED_SESSION:-}" != "$SESSION_ID" ]; then
  python3 - > /tmp/kickoff.json <<'PY'
import json
evt = {"type": "user.define_outcome", "description": open("first_prompt.txt").read(),
       "rubric": {"type": "text", "content": open("outcome.md").read()}, "max_iterations": 3}
json.dump(evt, open("kickoff.json", "w"), indent=2)
print(json.dumps({"events": [evt]}))
PY
  api POST "/sessions/$SESSION_ID/events" /tmp/kickoff.json
  save KICKED_SESSION "$SESSION_ID"; echo "✅ 🎯 run started"
fi

echo "Watch: https://platform.claude.com/workspaces/$WS/sessions/$SESSION_ID"
