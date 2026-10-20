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
| #9 | #20 | Dockerfile (node:24-alpine → nginx-unprivileged, digest-pinned), compose (`WEB_PORT`, default 8080), nginx MIME/headers, `scripts/smoke.sh` — worker `infra-docker` |
| #2 | #21 | `npm run ingest` → `content/` (38 entries, 6 topics, 64 sources, 34 png + 58 pdf, 6 missing md PDFs); D6; semantic snapshot tests |
| #3 | #23 | Design system: tokens (contrast-tested), Fraunces/Geist/Geist Mono, layout shell, primitives, WebP thumbnails, snapshot endpoints, `/styleguide/`, 404, `npm run screenshots` |
| #4 | #24 | Home: hero + collage, stats, open/copy/done, manifest-driven topic grid |
| #10 | #22 | Release workflow: image built once → GHCR → static files extracted by digest → Vercel Build Output v3 → `vercel deploy --prebuilt --prod`; clean skip + warning without secrets — worker `infra-docker` |
| #5 | #25 | Topic hubs: music chapters per track; technical guided path |
| #6 | #26 | Entry page (worker `ui-entry`): Markdown, live Mermaid, Excalidraw PNG-first/SVG/canvas, previews, downloads panel; self-hosted Excalidraw fonts + esm.sh fallback rewrite (lead) |
| #27 | #28 | Pre-release audit fixes: ingest output guard, bounded fail-closed binary scan, release guards (tag on main, full-history scan, tests before build, immutable re-runs via Packages API, lockfile-pinned Vercel CLI) |
| #8 | #29 | Search: MiniSearch index, server-rendered cards filtered client-side, URL state, honest no-JS fallback, `npm run e2e:search` |
| #7 | this PR | Deterministic per-topic zips (dependency-free ZIP writer, README.txt), hub download button, "Whole topic" in every entry's downloads panel |

## In progress
- #12 CSP + Permissions-Policy — worker `infra-docker` (contract IWEB-12a) on `chore/12-prerelease-hardening`; needs the Dockerfile CSP include (lead) and a rebase.
- #11 docs — `docs/11-readme-smoke`: README + `scripts/verify-site.sh` committed locally; PR after #7.

## Dependency graph
```
#1 ✔ ─┬─> #2 ✔ ──> #3 ✔ ─┬─> #4 ✔
      │                  ├─> #5 ✔
      │                  └─> #6 ✔ ─┬─> #7 ✔ ─┐
      │                            └─> #8 ✔ ─┤
      └─> #9 ✔ ──> #10 ✔ ──> #27 ✔ ───────────┤
                              #11 docs <──────┘ ──> #12 CSP + final verification ──> release v0.1.0
```

## Status table
| AGENT | ENGINE | HERDR TAB | SESSION ID | TASK | ISSUE | STATUS | DEPENDS ON | ARTIFACT | NEXT ACTION |
|---|---|---|---|---|---|---|---|---|---|
| lead | claude-code opus 5.5 | w3 (instants-web) | this session | orchestration, UI, ingest, audit fixes | #7 #11 #12 | running | — | PRs | #11, then #12 + release |
| codex-arch | codex 0.163 gpt-5.6-terra | IWEB__DECIDE__CODEX__ARCH__01 (w4:t1) | pane w4:p1 | decisions D1–D6; 2nd reviewer (#24) | — | done / alive idle | — | DECISIONS.md, PR comments | next review |
| codex-review | codex 0.163 gpt-5.6-terra | IWEB__REVIEW__CODEX__PR__02 (w4:t2) | pane w4:p2 | adversarial reviews | #19–#23, #5 | done / alive idle | — | PR comments | review #6 |
| infra-docker | claude-code sonnet 5.5 (auto) | IWEB__BUILD__CLAUDE__RELEASE__03 (w4:t3) | pane w4:p3 | IWEB-09, IWEB-10 | #9 #10 | done / alive idle | — | PR #20, #22 | CSP hardening in #12 |
| ui-entry | claude-code opus 5.5 (auto) | IWEB__BUILD__CLAUDE__ENTRY__04 (w4:t4) | pane w4:p4 | IWEB-06 entry page | #6 | running / alive | #3 ✔ | PR (pending) | report back |

## Open issues
- #7 (this PR), #11, #12; epics #13 (M1: only blocked #18 left), #15 (M3), #16 (M4); blocked-on-user #17, #18. Epic #14 (M2) closed.

## Blocked on me
1. #17 Vercel: create/link the project and set secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; then switch to a staged deploy (see #17 comment).
2. #18 Branch rules: make the repo public or upgrade to GitHub Pro, then `gh api -X POST repos/w7-mgfcode/instants-web/rulesets --input .github/ruleset-main.json`.

## Next step
Merge #7 → open #11 (README, verify-site) → finish #12: Dockerfile CSP include, rebase IWEB-12a onto main, csp-check against the Docker image,
full verification (docker compose up, verify-site, screenshots of home / music hub / technical hub / entry at desktop + phone) → `gh release create v0.1.0 --generate-notes`.

## Verified facts vs assumptions
- Verified: gh account w7-mgfcode on plan `free` (rulesets 403); herdr 0.9.5; codex 0.163.0; agy 1.4.3; docker 29.9 + compose v5.6; node 24.19.
- Verified: host port 8080 is held by the owner's unrelated `clipcascade` container → local checks use `WEB_PORT=18080`; compose default stays 8080.
- Verified: Docker image builds with sharp on Alpine and serves md/mmd/excalidraw/png/pdf/webp with the D6 content types.
- Verified: one stat-cache refresh of INSTANTS/.git/index at 14:37:33 came from the lead's manual `git status` (no content change); ingest no longer can.
- Verified: Codex folder-trust prompt for instants-web was accepted by the lead (this repo only).
- Assumption: Vercel project will use framework preset "Other" with prebuilt output.
