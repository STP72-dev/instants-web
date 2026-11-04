# Progress — INSTANTS Web

Resumable status file. A fresh session reads this and `DECISIONS.md`, checks GitHub matches (`gh pr list`, `gh issue list`), and continues from **Next step**.
Updated in every lead PR to the state after that PR merges (DECISIONS.md D0b).

- Repo: https://github.com/STP72-dev/instants-web (**public**; moved from `w7-mgfcode` 2026-11-04, D13) · source content: sibling `../INSTANTS` (read-only; git queries only with `--no-optional-locks`)
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
| #39 | #40 | Content snapshot refreshed from INSTANTS `f2a791e`: 43 entries / 8 topics (+ `ai-tools-`, `mgf-monk-`); `v0.1.1` tagged — Vercel **blocked** it (commit author check) |
| #41 | #42 | Follow-up to the transfer to `STP72-dev`: image `ghcr.io/stp72-dev/instants-web`, packages lookup via `orgs/`; no absolute home paths in tracked files (`ingest.ts` defaults to `../INSTANTS` next to the main checkout) |
| #43 | #44 | Vercel deploy from a non-git dir (no `gitMetadata` → Hobby author check passes); `vercel.json` disables Git auto-deploys; **v0.1.2 released and live** (D13) |
| #37 | this PR | Publish scan: secrets + personal data (emails, home paths) over `content/`, `dist/` and the site extracted in Release, incl. ZIP/PDF/PNG contents; fails closed; reviewed allowlist `publish-scan.allow.json` |

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
  site, DECISIONS.md D11) — closed by PR #36. #18 closed as deferred (D12). All epics #13–#16 closed.
- #39, #41, #43 closed by their PRs; #37 closed by this PR. No open issues.

## Production
- `https://instants-web.vercel.app` — **public by decision** (D11), team `dns-72-dev`, Hobby plan. **v0.1.2** (2026-11-04, run 41791036992): deployment `instants-zh3aedwfn-dns-72-dev.vercel.app` Ready; "43 entries · 8 topics"; `/topics/mgf-monk/` 200.
- Verified 2026-11-03 (v0.1.0 content): `scripts/verify-site.sh https://instants-web.vercel.app` 18/18 ok; security headers present.

## Blocked on me
- Nothing. Branch rules applied after the repo went public (D13).

## Next step
No build task open. Next content refresh: `npm run ingest` → PR (update the snapshot-pinned tests) → release tag; the publish scan gates it
(docs/release.md). Follow-ups worth an issue:
set `org.opencontainers.image.revision` to the tag commit on dispatch re-runs (it currently records the dispatching main commit);
staged Vercel deploy (`--skip-domain` → verify-site → promote). Orchestration state and HERDR rules: `ORCHESTRATOR.md`.

## Verified facts vs assumptions
- Verified: repo public under org `STP72-dev` (free); ruleset `protect-main` active (2026-11-04). Earlier: gh account w7-mgfcode on plan `free` (rulesets 403 while private); herdr 0.9.5; codex 0.163.0; agy 1.4.3; docker 29.9 + compose v5.6; node 24.19.
- Verified: host port 8080 is held by the owner's unrelated `clipcascade` container → local checks use `WEB_PORT=18080`; compose default stays 8080.
- Verified: Docker image builds with sharp on Alpine and serves md/mmd/excalidraw/png/pdf/webp with the D6 content types.
- Verified: one stat-cache refresh of INSTANTS/.git/index at 14:37:33 came from the lead's manual `git status` (no content change); ingest no longer can.
- Verified: Codex folder-trust prompt for instants-web was accepted by the lead (this repo only).
- Verified: v0.1.0 = commit 9acc67f; release run 39445413408 green; GHCR package `instants-web` is private with tags 0.1.0, 0.1, sha-9acc67f, latest.
- Verified: on main, Docker image → verify-site 18/18, csp-check 0 violations / 0 external requests, e2e:search 7/7, healthy, non-root.
- Verified: Vercel Hobby blocks a deploy whose commit author is not the owner's linked GitHub user; deploying from a non-git dir avoids it (v0.1.2).
- Verified 2026-11-04 on v0.1.2: `scripts/verify-site.sh https://instants-web.vercel.app` exit 0; CSP, Permissions-Policy, Referrer-Policy, HSTS, nosniff, X-Frame-Options present.
- Assumption: Vercel project will use framework preset "Other" with prebuilt output.
