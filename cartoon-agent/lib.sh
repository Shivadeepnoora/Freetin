# Shared helpers for the launch / poll / fetch / eval scripts. Source, don't run.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Key: a non-empty value in .env wins; otherwise use ANTHROPIC_API_KEY from the shell / cloud environment.
_ENV_KEY=${ANTHROPIC_API_KEY:-}
set -a; [ -f "$ROOT/.env" ] && source "$ROOT/.env"; [ -f "$ROOT/IDS.env" ] && source "$ROOT/IDS.env"; set +a
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-$_ENV_KEY}; unset _ENV_KEY
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY is empty: paste it into $ROOT/.env}"

BASE=https://api.anthropic.com/v1
H=(-H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"
   -H "anthropic-beta: managed-agents-2026-04-01" -H "content-type: application/json")
# Memory-store endpoints take their own beta header *instead of* the managed-agents one.
HM=(-H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"
    -H "anthropic-beta: agent-memory-2026-07-22" -H "content-type: application/json")
RESP="$(mktemp)"
WS="${CONSOLE_WORKSPACE:-default}"

# api METHOD PATH [BODY_FILE] [header-array-name]  -> response in $RESP, fails loudly on non-2xx
api() {
  local method=$1 path=$2 body=${3:-} hdr=${4:-H}
  local -n hh=$hdr
  local args=(-sS -X "$method" "$BASE$path" "${hh[@]}" -o "$RESP" -w '%{http_code}')
  [ -n "$body" ] && args+=(--data-binary "@$body")
  local code; code=$(curl "${args[@]}")
  if [[ $code != 2* ]]; then echo "❌ $method $path -> HTTP $code" >&2; cat "$RESP" >&2; echo >&2; return 1; fi
}

# jq-free JSON read (session payloads embed control chars that break jq): jget 'd["id"]'
jget() { python3 -c "import json,sys; d=json.JSONDecoder(strict=False).decode(open(sys.argv[1]).read()); print(eval(sys.argv[2]))" "$RESP" "$1"; }

save() { echo "$1=$2" >> "$ROOT/IDS.env"; export "$1=$2"; }
