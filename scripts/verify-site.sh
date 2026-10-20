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

# The topic zip must be offered as a download, and unknown paths must 404 with the custom page.
disp="$(curl -sS -o /dev/null -D - "$base/downloads/git.zip" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-disposition"{print $2}')"
[[ "$disp" == attachment* ]] && echo "ok    /downloads/git.zip  Content-Disposition: $disp" || { echo "FAIL  /downloads/git.zip  Content-Disposition: '$disp'"; exit 1; }
page="$(mktemp)"
trap 'rm -f "$page"' EXIT
code="$(curl -sS -o "$page" -w '%{http_code}' "$base/definitely-not-here/")"
[[ "$code" == 404 ]] && grep -q 'not been bottled' "$page" && echo "ok    /definitely-not-here/  404 custom page" || { echo "FAIL  404 page (status $code)"; exit 1; }
