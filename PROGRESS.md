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
| #7 | #30 | Deterministic per-topic zips (dependency-free ZIP writer, README.txt), hub download button, "Whole topic" in every entry's downloads panel |
| #12 (part) | #31 | CSP (hash-based script-src, no unsafe-eval) + Permissions-Policy in nginx (include generated at image build) and Vercel output; `npm run csp-check` → 0 violations / 0 external requests on 11 page types, enforced in CI against the Docker image and before the Vercel deploy — worker `infra-docker` + lead |
| #11 | #32 | README (run, refresh content, PR flow, release), `scripts/verify-site.sh` (every page + file type, zip disposition, 404) — also run in CI against the image |
| #12 | #31, #33, release | Pre-release Codex audit (fixes in #28), CSP, release guard fix; **v0.1.0 released**: https://github.com/w7-mgfcode/instants-web/releases/tag/v0.1.0 — run https://github.com/w7-mgfcode/instants-web/actions/runs/39445413408 (image `ghcr.io/w7-mgfcode/instants-web:0.1.0` = `sha256:fc6a6ad0…`, private; Vercel skipped pending #17) |

## In progress
- Nothing. Only blocked-on-user items remain.

## Dependency graph
```
#1 ✔ ─┬─> #2 ✔ ──> #3 ✔ ─┬─> #4 ✔
      │                  ├─> #5 ✔
      │                  └─> #6 ✔ ─┬─> #7 ✔ ─┐
      │                            └─> #8 ✔ ─┤
      └─> #9 ✔ ──> #10 ✔ ──> #27 ✔ ───────────┤
                              #11 ✔ <──────────┘ ──> #12 ✔ ──> v0.1.0 released ✔
```

## Status table (final)
| AGENT | ENGINE | HERDR TAB | SESSION ID | TASK | ISSUE | STATUS | DEPENDS ON | ARTIFACT | NEXT ACTION |
|---|---|---|---|---|---|---|---|---|---|
| lead | claude-code opus 5.5 | w3 (instants-web) | this session | orchestration, ingest, design system, home, hubs, search, zips, audit fixes, release | all | done | — | PRs #19 #21 #23–#25 #28–#30 #32 #33 | — |
| codex-arch | codex 0.163 gpt-5.6-terra | IWEB__DECIDE__CODEX__ARCH__01 (w4:t1) | pane w4:p1 | decisions D1–D6; reviews #24 #31; pre-release audit + follow-up | — | done / alive idle | — | DECISIONS.md, PR comments | none |
| codex-review | codex 0.163 gpt-5.6-terra | IWEB__REVIEW__CODEX__PR__02 (w4:t2) | pane w4:p2 | adversarial reviews #19–#23, #25, #26, #29, #30, #32, #33 | — | done / alive idle | — | PR comments | none |
| infra-docker | claude-code sonnet 5.5 (auto) | IWEB__BUILD__CLAUDE__RELEASE__03 (w4:t3) | pane w4:p3 | IWEB-09 Docker, IWEB-10 release, IWEB-12a CSP | #9 #10 #12 | done / alive idle | — | PRs #20 #22 #31 | none |
| ui-entry | claude-code opus 5.5 (auto) | IWEB__BUILD__CLAUDE__ENTRY__04 (w4:t4) | pane w4:p4 | IWEB-06 entry page | #6 | done / alive idle | — | PR #26 | none |

## Open issues
- #17 done in practice (2026-10-21: project linked, secrets set, release re-run deployed production; 2026-11-03: owner chose a public
  site, DECISIONS.md D11) — close it with this PR. #18 (blocked on user); epics #13 (M1, only #18 left) and #16 (M4, closes with #17).
  Epics #14 (M2) and #15 (M3) closed.

## Production
- `https://instants-web.vercel.app` — **public by decision** (D11). Deployment `dpl_BD1reCVTq3S3hgwTmUUhqWh2evHj`, team `dns-72-dev`, Hobby plan.
- Verified 2026-11-03: `scripts/verify-site.sh https://instants-web.vercel.app` 18/18 ok; security headers present.

## Blocked on me
1. #18 Branch rules: make the repo public or upgrade to GitHub Pro, then `gh api -X POST repos/w7-mgfcode/instants-web/rulesets --input .github/ruleset-main.json`.
   (The public site does not require a public repo.)

## Next step
Nothing autonomous remains. Owner: #18 (branch rules / repo visibility). Follow-ups worth an issue: set `org.opencontainers.image.revision`
to the tag commit on dispatch re-runs (it currently records the dispatching main commit); staged Vercel deploy (`--skip-domain` →
verify-site → promote); secret/PII scan of the content snapshot as a release gate (the site is public, D11).

## Verified facts vs assumptions
- Verified: gh account w7-mgfcode on plan `free` (rulesets 403); herdr 0.9.5; codex 0.163.0; agy 1.4.3; docker 29.9 + compose v5.6; node 24.19.
- Verified: host port 8080 is held by the owner's unrelated `clipcascade` container → local checks use `WEB_PORT=18080`; compose default stays 8080.
- Verified: Docker image builds with sharp on Alpine and serves md/mmd/excalidraw/png/pdf/webp with the D6 content types.
- Verified: one stat-cache refresh of INSTANTS/.git/index at 14:37:33 came from the lead's manual `git status` (no content change); ingest no longer can.
- Verified: Codex folder-trust prompt for instants-web was accepted by the lead (this repo only).
- Verified: v0.1.0 = commit 9acc67f; release run 39445413408 green; GHCR package `instants-web` is private with tags 0.1.0, 0.1, sha-9acc67f, latest.
- Verified: on main, Docker image → verify-site 18/18, csp-check 0 violations / 0 external requests, e2e:search 7/7, healthy, non-root.
- Not verified (needs owner): real Vercel deployment behaviour (routes, headers, CSP) — first deploy after #17.
- Assumption: Vercel project will use framework preset "Other" with prebuilt output.
