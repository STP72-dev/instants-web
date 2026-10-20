# Task contract IWEB-10

```yaml
task_id: IWEB-10
issue: "#10"
branch: ci/10-release-workflow
worktree: /home/w7-loqker/w7-workspace/selfbase/knowledge/instants-web/.worktrees/release-10
role: infra_dev
engine: claude-code (claude-sonnet-5-5, permission-mode auto)
herdr_tab: IWEB__BUILD__CLAUDE__DOCKER__03 (same session as IWEB-09, renamed scope RELEASE)
objective: On tags v*.*.*, build the static site ONCE, publish the Docker image to GHCR, and deploy the identical output to Vercel (skip cleanly without secrets).
owned_paths:
  - .github/workflows/release.yml
  - scripts/vercel-output.ts        # writes .vercel/output (Build Output API v3) from a dist/ dir
  - tests/vercel-output.test.ts
  - docs/release.md                 # short how-to-release + how the Vercel step works
inputs:
  - DECISIONS.md D4 and the URL/content-type contract in D6
  - docker/nginx.conf (headers/content types to mirror on Vercel)
  - existing .github/workflows/ci.yml (pin actions by SHA the same way; reuse its pins)
constraints:
  - Edit ONLY owned_paths. Do not touch package.json scripts (tell me if you need one added; I add it), Dockerfile, src/, content/.
  - Build once: build the image with docker/build-push-action (push to ghcr.io/w7-mgfcode/instants-web), then extract the static files from that
    exact image (docker create + docker cp /usr/share/nginx/html) and feed them to scripts/vercel-output.ts. No second `npm run build`.
  - GHCR auth with GITHUB_TOKEN; permissions: contents read, packages write (job-level, least privilege). Tags via docker/metadata-action:
    semver {{version}}, {{major}}.{{minor}}, sha, latest on tags.
  - Vercel: config.json version 3 with routes that set Content-Type for .md (text/markdown; charset=utf-8), .mmd (text/plain; charset=utf-8),
    .excalidraw (application/vnd.excalidraw+json), Content-Disposition attachment for /downloads/*.zip, immutable cache for /_astro/*, the same
    security headers as nginx, and 404 handling via /404.html ({"handle":"filesystem"} then {"src":"/.*","status":404,"dest":"/404.html"}).
  - Vercel step: if ANY of VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID is empty, print exactly
    "Vercel deploy skipped: VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID must all be set (see issue #17)." and exit 0 (job stays green).
    Otherwise run a version-pinned `npx --yes vercel@<exact version> deploy --prebuilt --prod --token "$VERCEL_TOKEN"` with VERCEL_ORG_ID/VERCEL_PROJECT_ID in env.
    Never echo secrets. Secrets must not be passed via `with:` to third-party actions.
  - Also allow workflow_dispatch (input: ref/tag) for re-runs.
  - Pin every action by commit SHA with a version comment. Resolve SHAs with `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` (dereference annotated tags).
  - Conventional Commits "ci(deploy): ..."; end commit messages with "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>".
  - Before every push run `npm run scan:diff`; push branch, open PR to main ("Closes #10", what changed, verification). Do NOT merge. Never set secrets, never create/link a Vercel project, never run a real deploy.
acceptance_criteria:
  - actionlint passes on all workflows (docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -no-color)
  - `node scripts/vercel-output.ts <dist-dir> <out-dir>` writes <out-dir>/config.json (version 3) + <out-dir>/static/** byte-identical to dist
  - unit tests for vercel-output (config shape, routes order, copy fidelity) pass with `npx vitest run tests/vercel-output.test.ts`
  - Local dry run: build the image locally, extract html dir, run vercel-output on it, show the tree + config.json
  - Skip path demonstrated (e.g. run the step's script with empty env) printing the exact skip line and exit 0
verification_commands:
  - docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12 -no-color
  - npx vitest run tests/vercel-output.test.ts
  - docker build -t iweb-release-test . && cid=$(docker create iweb-release-test) && docker cp $cid:/usr/share/nginx/html /tmp/iweb-html && docker rm $cid && node scripts/vercel-output.ts /tmp/iweb-html /tmp/iweb-vercel
expected_artifacts: [.github/workflows/release.yml, scripts/vercel-output.ts, tests/vercel-output.test.ts, docs/release.md, PR URL]
status: ready
```

## Report back (final message)
task_id and status; what you actually did; changed files; commands run with results; branch/commit; PR URL; open problems/risks; recommended next step.
