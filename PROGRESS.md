# Progress — INSTANTS Web

Resumable status file. A fresh session reads this and `DECISIONS.md`, checks GitHub matches (`gh pr list`, `gh issue list`), and continues from **Next step**.
Updated in every lead PR to the state after that PR merges (DECISIONS.md D0b).

- Repo: https://github.com/w7-mgfcode/instants-web (private) · source content: `/home/w7-loqker/w7-workspace/selfbase/knowledge/INSTANTS` (read-only; git queries only with `--no-optional-locks`)
- HERDR workspace `IWEB` (w4) hosts every agent session; the lead runs in workspace `instants-web` (w3).
- Worktrees live in `instants-web/.worktrees/<scope>-<issue>` (ignored via `.git/info/exclude`). Task contracts: `.orchestrator/contracts/IWEB-<nn>.md`.

## Done
| Issue | PR | What |
|---|---|---|
| #1 | #19 | Astro 7 + TS 6 + ESLint 10 + Vitest 5 scaffold, CI job `ci` (per-commit secret scan), templates, `npm run scan:diff` |
| #9 | #20 | Dockerfile (node:24-alpine → nginx-unprivileged, digest-pinned), compose (`WEB_PORT`, default 8080), nginx MIME/headers, `scripts/smoke.sh` — by worker `infra-docker` |
| #2 | #21 | `npm run ingest` → `content/` (38 entries, 6 topics, 64 sources, 34 png + 58 pdf, 6 missing md PDFs); D6; 50 tests incl. semantic snapshot checks |
| #3 | this PR | Design system: tokens (contrast-tested), Fraunces/Geist/Geist Mono, layout shell, primitives, WebP thumbnails, snapshot file endpoints, `/styleguide/`, 404, `npm run screenshots` |

## In progress
- #10 release workflow — worker `infra-docker` (contract IWEB-10), worktree `.worktrees/release-10`.
- #4 home page — lead, branch `feat/4-home-page` (stacked on #3, ready).

## Dependency graph
```
#1 ✔ ─┬─> #2 ✔ ──> #3 ✔ ─┬─> #4 home (ready)
      │                  ├─> #5 topic hubs
      │                  └─> #6 entry page ─┬─> #7 downloads + zips ─┐
      │                                     └─> #8 search ───────────┤
      └─> #9 ✔ ──> #10 release (running) ───────────────────────────┤
                                       #11 docs/smoke <──────────────┘ ──> #12 pre-release review + v0.1.0
```
Parallel now: UI lane (#4 → #5 → #6) ‖ infra lane (#10). After #6: #7 ‖ #8.

## Status table
| AGENT | ENGINE | HERDR TAB | SESSION ID | TASK | ISSUE | STATUS | DEPENDS ON | ARTIFACT | NEXT ACTION |
|---|---|---|---|---|---|---|---|---|---|
| lead | claude-code opus 5.5 | w3 (instants-web) | this session | orchestration + UI | #3 #4 | running | — | PRs | merge #3, open #4 |
| codex-arch | codex 0.163 gpt-5.6-terra | IWEB__DECIDE__CODEX__ARCH__01 (w4:t1) | pane w4:p1 | decisions D1–D6 | — | done / alive idle | — | DECISIONS.md | next decision |
| codex-review | codex 0.163 gpt-5.6-terra | IWEB__REVIEW__CODEX__PR__02 (w4:t2) | pane w4:p2 | adversarial reviews | #1 #2 #9 #3 | review / alive | — | PR comments | review #3 |
| infra-docker | claude-code sonnet 5.5 (auto) | IWEB__BUILD__CLAUDE__RELEASE__03 (w4:t3) | pane w4:p3 | IWEB-10 release | #10 | running / alive | #9 ✔ | PR (pending) | report back |

## Open issues
- #4–#8, #10–#12; epics #13–#16; blocked-on-user #17, #18.

## Blocked on me
1. #17 Vercel: create/link the project and set secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
2. #18 Branch rules: make the repo public or upgrade to GitHub Pro, then `gh api -X POST repos/w7-mgfcode/instants-web/rulesets --input .github/ruleset-main.json`.

## Next step
Merge #3 → rebase + open #4 → implement #5 topic hubs and #6 entry page (consider a hosted UI worker for #6 once #3 is on main).

## Verified facts vs assumptions
- Verified: gh account w7-mgfcode on plan `free` (rulesets 403); herdr 0.9.5; codex 0.163.0; agy 1.4.3; docker 29.9 + compose v5.6; node 24.19.
- Verified: host port 8080 is held by the owner's unrelated `clipcascade` container → local checks use `WEB_PORT=18080`; compose default stays 8080.
- Verified: Docker image builds with sharp on Alpine and serves md/mmd/excalidraw/png/pdf/webp with the D6 content types.
- Verified: one stat-cache refresh of INSTANTS/.git/index at 14:37:33 came from the lead's manual `git status` (no content change); ingest no longer can.
- Verified: Codex folder-trust prompt for instants-web was accepted by the lead (this repo only).
- Assumption: Vercel project will use framework preset "Other" with prebuilt output.
