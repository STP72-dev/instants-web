#!/usr/bin/env bash
# Usage: scripts/smoke.sh [base-url] [path|content-type ...]
# Checks that each path answers 200 and its Content-Type starts with the expected type.
# "/" (text/html) is always checked; later issues pass extra "path|type" args.
set -euo pipefail

base="${1:-http://localhost:8080}"
shift || true
base="${base%/}"

checks=("/|text/html" "$@")
failed=0

for check in "${checks[@]}"; do
  path="${check%%|*}"
  want="${check#*|}"
  if [[ "$path" == "$check" || -z "$want" ]]; then
    echo "FAIL  $check  (expected \"path|type\")"
    failed=1
    continue
  fi

  if ! out="$(curl -sS -o /dev/null --max-time 10 -w '%{http_code}|%{content_type}' "$base$path" 2>&1)"; then
    echo "FAIL  $path  (curl: $out)"
    failed=1
    continue
  fi
  status="${out%%|*}"
  got="${out#*|}"

  want_lc="$(tr '[:upper:]' '[:lower:]' <<<"$want")"
  got_lc="$(tr '[:upper:]' '[:lower:]' <<<"$got")"
  if [[ "$status" == "200" && "$got_lc" == "$want_lc"* ]]; then
    echo "ok    $path  $status  $got"
  else
    echo "FAIL  $path  status=$status type=\"$got\" (want 200, \"$want\")"
    failed=1
  fi
done

exit "$failed"
