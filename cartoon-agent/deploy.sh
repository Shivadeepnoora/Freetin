#!/usr/bin/env bash
# 🗓️ Scheduled deployment, created only after a run passes. Every Sunday 08:30 Asia/Kolkata.
#   ./deploy.sh          create (skips if DEPLOYMENT_ID exists) and read back upcoming runs
#   ./deploy.sh run      fire a manual run now (explicit POST)
source "$(dirname "$0")/lib.sh"
cd "$ROOT"
if [ "${1:-}" = run ]; then
  echo '{}' > /tmp/empty.json
  api POST "/deployments/$DEPLOYMENT_ID/run?beta=true" /tmp/empty.json
  jget 'json.dumps(d, indent=2)[:800]'; exit
fi
if [ -z "${DEPLOYMENT_ID:-}" ]; then
  # kickoff text is replayed verbatim every Sunday: refuse if it contains a literal date
  if grep -nE '20[0-9]{2}-[0-9]{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* [0-9]{1,2}' first_prompt.txt outcome.md; then
    echo "❌ literal date found above: use relative wording"; exit 1; fi
  python3 - "$AGENT_ID" "$AGENT_VERSION" "$ENV_ID" "$MEMSTORE_ID" > deployment.json <<'PY'
import json, sys
ag, ver, env, ms = sys.argv[1:]
print(json.dumps({"name": "cartoon-writers-room · Sunday batch",
  "agent": {"type": "agent", "id": ag, "version": int(ver)}, "environment_id": env,
  "initial_events": [json.load(open("kickoff.json"))],
  "resources": [{"type": "memory_store", "memory_store_id": ms, "access": "read_write",
                 "instructions": "The channel's canon: series-bible.md and episode-log.md. Read before writing; append new episodes to the log."}],
  "schedule": {"type": "cron", "expression": "30 8 * * 0", "timezone": "Asia/Kolkata"}}, indent=2))
PY
  if ! api POST "/deployments?beta=true" deployment.json; then
    echo "↻ retrying with agent as a plain id (latest version)"
    python3 -c 'import json; d=json.load(open("deployment.json")); d["agent"]=d["agent"]["id"]; json.dump(d, open("deployment.json","w"), indent=2)'
    api POST "/deployments?beta=true" deployment.json
  fi
  save DEPLOYMENT_ID "$(jget 'd["id"]')"; echo "✅ 🗓️ deployment $DEPLOYMENT_ID"
else
  api GET "/deployments/$DEPLOYMENT_ID?beta=true"
fi
jget '"upcoming: " + ", ".join((d.get("schedule") or {}).get("upcoming_runs_at") or [])'
echo "https://platform.claude.com/workspaces/$WS/deployments/$DEPLOYMENT_ID"
