# Task contract IWEB-09

```yaml
task_id: IWEB-09
issue: "#9"
branch: feat/9-docker-compose-nginx
worktree: /home/w7-loqker/w7-workspace/selfbase/knowledge/instants-web/.worktrees/docker-9
role: infra_dev
engine: claude-code (claude-sonnet-5-5, permission-mode auto)
herdr_tab: IWEB__BUILD__CLAUDE__DOCKER__03
session_id: herdr agent "infra-docker"
objective: "docker compose up" builds the static site from the committed repo and serves it on http://localhost:8080 with correct content types.
owned_paths:
  - Dockerfile
  - .dockerignore
  - docker-compose.yml
  - docker/nginx.conf
  - scripts/smoke.sh
inputs:
  - DECISIONS.md D4 (multi-stage node:24-alpine build -> nginxinc/nginx-unprivileged:1-alpine on :8080)
  - URL + content-type contract below
  - issue #9 acceptance criteria (gh issue view 9)
constraints:
  - Edit ONLY owned_paths. Do not touch package.json, src/, content/, PROGRESS.md, DECISIONS.md, workflows.
  - The image must not need the INSTANTS directory; it builds only from files committed in this repo (content/ snapshot may be empty today).
  - Non-root runtime, HEALTHCHECK, no secrets in image or build args.
  - Pin base images by tag (node:24-alpine, nginxinc/nginx-unprivileged:1-alpine).
  - Conventional Commits: "feat(docker): <imperative summary>"; end commit messages with
    "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".
  - Before every push run `npm run scan:diff` and never push if it fails.
  - Push the branch and open a PR to main (body: "Closes #9", what changed, verification commands + results). Do NOT merge. Do not change repo settings.
  - Never bypass permission prompts; if blocked, stop and report.
acceptance_criteria:
  - docker compose up -d --build serves http://localhost:8080 (200, text/html) with no other steps
  - nginx serves directory-style routes (/topics/x/ -> /topics/x/index.html), 404 page if dist/404.html exists
  - Content-Type map: .md text/markdown; charset=utf-8 | .mmd text/plain; charset=utf-8 | .excalidraw application/vnd.excalidraw+json
    | .json application/json | .png image/png | .pdf application/pdf | .zip application/zip | .svg image/svg+xml | .woff2 font/woff2
  - /downloads/*.zip respond with Content-Disposition: attachment; /files/** and /exports/** stay inline (the UI uses <a download>)
  - Long cache (immutable) for /_astro/*, no-cache for HTML
  - Security headers: X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options SAMEORIGIN. No CSP yet (added in #12 once Mermaid/Excalidraw needs are known).
  - HEALTHCHECK passes (docker inspect shows healthy)
  - scripts/smoke.sh <base-url> checks a list of paths for status 200 and expected content-type; today it checks "/" (text/html) and a fixture you place nowhere in git — instead accept extra "path|type" args so later issues add paths
verification_commands:
  - docker compose up -d --build && docker compose ps
  - scripts/smoke.sh http://localhost:8080
  - docker inspect --format '{{.State.Health.Status}}' $(docker compose ps -q web)
  - docker compose down
expected_artifacts: [Dockerfile, .dockerignore, docker-compose.yml, docker/nginx.conf, scripts/smoke.sh, PR URL]
status: ready
```

## URL contract (shared interface, D6)
- /                      home
- /topics/<topic>/        topic hub
- /entries/<slug>/        entry page
- /search/                search page; /search-index.json
- /files/md/<slug>.md, /files/mermaid/<slug>.mmd, /files/excalidraw/<slug>.excalidraw   raw sources
- /exports/<md|mermaid|excalidraw>/<slug>.<png|pdf>   exports
- /downloads/<topic>.zip   per-topic zip
- /_astro/*               hashed build assets

## Report back (final message)
task_id and status; what you actually did; changed files; commands run with results; branch/commit; PR URL; open problems/risks; recommended next step.
