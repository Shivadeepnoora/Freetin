#!/usr/bin/env bash
# ./poll.sh [SESSION_ID] [--wait]   status + outcome verdicts; --wait loops until the run settles
source "$(dirname "$0")/lib.sh"
SID=${SESSION_ID}; WAIT=0
for a in "$@"; do [ "$a" = --wait ] && WAIT=1 || SID=$a; done
while :; do
  api GET "/sessions/$SID"
  line=$(jget '"%s | evals: %s" % (d["status"], [(e.get("result"), e.get("iteration")) for e in d.get("outcome_evaluations") or []])')
  echo "$(date +%H:%M:%S) $line"
  st=${line%% *}
  if [ $WAIT = 0 ] || [[ $st == idle || $st == terminated ]]; then break; fi
  sleep 30
done
