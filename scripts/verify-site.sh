#!/usr/bin/env bash
# Release smoke test: home, a topic hub of each kind, an entry page per source format, one download of each file type,
# search index, thumbnails and the 404 page — each must answer 200 (404 for the missing page) with the right Content-Type.
# Usage: scripts/verify-site.sh [base-url]     (default http://localhost:8080)
set -euo pipefail
base="${1:-http://localhost:8080}"
here="$(cd "$(dirname "$0")" && pwd)"

"$here/smoke.sh" "$base" \
  "/topics/nonconformist/|text/html" \
  "/topics/forecastlabai/|text/html" \
  "/entries/ai-start-guide/|text/html" \
  "/entries/ai-model-routing/|text/html" \
  "/entries/instants-prime-flow/|text/html" \
  "/entries/forecastlabai-architecture/|text/html" \
  "/search/|text/html" \
  "/search-index.json|application/json" \
  "/files/md/ai-start-guide.md|text/markdown" \
  "/files/mermaid/ai-model-routing.mmd|text/plain" \
  "/files/excalidraw/instants-prime-flow.excalidraw|application/vnd.excalidraw+json" \
  "/exports/mermaid/ai-model-routing.png|image/png" \
  "/exports/md/ai-start-guide.pdf|application/pdf" \
  "/downloads/nonconformist.zip|application/zip" \
  "/thumbs/instants-prime-flow.webp|image/webp"

# The topic zip must exist (200, application/zip) AND be offered as a download — checked on the same response.
headers="$(curl -sS --max-time 10 -o /dev/null -D - "$base/downloads/git.zip" | tr -d '\r')"
status="$(head -n1 <<<"$headers" | awk '{print $2}')"
ctype="$(awk -F': ' 'tolower($1)=="content-type"{print $2}' <<<"$headers")"
disp="$(awk -F': ' 'tolower($1)=="content-disposition"{print $2}' <<<"$headers")"
if [[ "$status" == 200 && "${ctype,,}" == application/zip* && "$disp" == attachment* ]]; then
  echo "ok    /downloads/git.zip  $status $ctype; Content-Disposition: $disp"
else
  echo "FAIL  /downloads/git.zip  status=$status type='$ctype' disposition='$disp'"; exit 1
fi

# Unknown paths must 404 with the custom page.
page="$(mktemp)"
trap 'rm -f "$page"' EXIT
code="$(curl -sS --max-time 10 -o "$page" -w '%{http_code}' "$base/definitely-not-here/")"
[[ "$code" == 404 ]] && grep -q 'not been bottled' "$page" && echo "ok    /definitely-not-here/  404 custom page" || { echo "FAIL  404 page (status $code)"; exit 1; }
