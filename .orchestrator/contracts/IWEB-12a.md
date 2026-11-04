# Task contract IWEB-12a

```yaml
task_id: IWEB-12a
issue: "#12"
branch: chore/12-prerelease-hardening   # stacked on feat/6-entry-page (PR #26); lead rebases after #26 merges
worktree: .worktrees/harden-12
role: infra_dev
engine: claude-code (claude-sonnet-5-5, permission-mode auto)
herdr_tab: IWEB__BUILD__CLAUDE__RELEASE__03 (same session)
objective: Add a strict, working Content-Security-Policy (+ Permissions-Policy) to BOTH nginx and the Vercel Build Output, proven by a browser test with zero CSP violations across every page type.
owned_paths:
  - docker/nginx.conf
  - scripts/vercel-output.ts
  - tests/vercel-output.test.ts
  - scripts/csp-check.ts          # new: Playwright check that visits pages, exercises interactions, fails on any CSP violation or external request
  - docs/release.md               # only the nginx/Vercel parity section
inputs:
  - The built site (npm run build) — pages: /, /topics/nonconformist/, /topics/forecastlabai/, /entries/forecastlabai-architecture/ (md+mmd+excalidraw),
    /entries/instants-prime-flow/ (excalidraw only: click "Open interactive canvas", wait, Escape), /entries/ai-model-routing/ (mermaid: scroll into view, toggle Source),
    /entries/ai-start-guide/ (md only), /search/?q=pgvector, /styleguide/, /404.html
  - Astro emits module scripts as files under /_astro/; components may also emit small inline scripts/styles — find out exactly what the build emits
    (grep dist for <script without src, style= attributes, <style>) before choosing directives.
constraints:
  - Edit ONLY owned_paths. If the policy needs a code change elsewhere (e.g. removing an inline script), report it instead.
  - Start from: default-src 'self'; script-src 'self' (+ hashes for unavoidable inline scripts — compute them from dist at build time in
    vercel-output.ts AND document how nginx gets the same list; prefer a single generated include file for nginx, e.g. docker/csp.conf written by a
    script run in the Docker build — if that needs a Dockerfile change, report it and I will make it); style-src 'self' 'unsafe-inline' is acceptable
    (Mermaid/Excalidraw inject styles) — say so in docs; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:;
    object-src 'self' (PDF preview uses <object>/<iframe>) — or frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'.
    Do not add 'unsafe-eval' unless the browser test proves a library needs it; if so, explain which and why.
  - Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=().
  - The csp-check script must run against a local server (both `astro preview` and the Docker image on WEB_PORT=18080), listen for
    `securitypolicyviolation` events and console CSP errors, and exit 1 on any violation or any request to a non-localhost origin.
  - Conventional Commits "fix(docker): ..." / "fix(deploy): ..."; end with "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".
  - Run `npm run scan:diff` before pushing. Push the branch; do NOT open a PR (the lead bundles #12) and do NOT merge.
acceptance_criteria:
  - docker compose (WEB_PORT=18080) serves the CSP + Permissions-Policy headers on HTML responses
  - node scripts/csp-check.ts http://localhost:18080 → 0 violations, 0 external requests, exit 0
  - the same check against `astro preview` is not required to pass (preview has no headers) — run it against the Docker image
  - vercel-output.ts emits identical header values; tests updated
verification_commands:
  - npm run build && WEB_PORT=18080 docker compose up -d --build && node scripts/csp-check.ts http://localhost:18080 && docker compose down
  - npx vitest run tests/vercel-output.test.ts
  - docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -no-color
status: ready
```

## Report back
task_id and status; what you did; changed files; commands + results; commit; open problems; any change needed outside owned paths.
