# Progress — INSTANTS Web

Resumable status file. A fresh session reads this and `DECISIONS.md`, checks GitHub matches, and continues from **Next step**.
Updated in every PR to the state after that PR merges (see DECISIONS.md D0b).

- Repo: https://github.com/w7-mgfcode/instants-web (private) · source content: `/home/w7-loqker/w7-workspace/selfbase/knowledge/INSTANTS` (read-only)
- HERDR workspace: `IWEB` (w4). Orchestrator runs in workspace `instants-web` (w3).

## Done
- Repo created, private, squash-only, auto-delete branches; labels; milestones M1–M4; epics #13–#16 with sub-issues; issues #1–#12; blocked-on-user #17, #18.
- Ruleset refused (HTTP 403, GitHub Free) → rules followed by discipline (DECISIONS.md D0).
- Decisions D1–D5 adopted (Astro static, PNG-first Excalidraw + live Mermaid, MiniSearch, nginx + Vercel prebuilt v3, plain CSS tokens).
- #1 scaffold: Astro 7 + TS 6 + ESLint 10 + Vitest 5, CI workflow (job `ci`), issue/PR templates, secret scanner + `npm run scan:diff`.

## In progress
- D6 manifest schema / snapshot layout (Codex, tab IWEB__DECIDE__CODEX__ARCH__01) → then #2 ingest.

## Dependency graph
```
#1 scaffold ─┬─> #2 ingest ──> #3 design system ─┬─> #4 home
             │                                   ├─> #5 topic hubs
             │                                   └─> #6 entry page ─┬─> #7 downloads + zips ─┐
             │                                                      └─> #8 search ───────────┤
             └─> #9 docker ──> #10 release workflow ────────────────────────────────────────┤
                                                                     #11 docs/smoke <───────┘ ──> #12 pre-release review + v0.1.0
```
Parallel lanes once #2 is merged: UI lane (#3 → #4/#5/#6 → #7/#8) ‖ infra lane (#9 → #10).

## Status table
| AGENT | ENGINE | HERDR TAB | SESSION ID | TASK | ISSUE | STATUS | DEPENDS ON | ARTIFACT | NEXT ACTION |
|---|---|---|---|---|---|---|---|---|---|
| lead | claude-code (opus 5.5) | w3 (instants-web) | this session | orchestration + implementation | all | running | — | — | — |
| codex-arch | codex 0.163 gpt-5.6-terra | IWEB__DECIDE__CODEX__ARCH__01 (w4:t1) | pane w4:p1 | decisions D1–D6 | — | alive / idle | — | DECISIONS.md | D6 rank |

## Open issues / PRs
- Open: #2–#12, epics #13–#16, blocked #17, #18.

## Blocked on me
1. #17 Vercel: create/link project and set secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
2. #18 Branch rules: make the repo public or upgrade to GitHub Pro, then `gh api -X POST repos/w7-mgfcode/instants-web/rulesets --input .github/ruleset-main.json`.

## Next step
Finish D6 → implement #2 ingest on `feat/2-ingest-snapshot`.

## Verified facts vs assumptions
- Verified: gh logged in as w7-mgfcode, plan `free`; herdr 0.9.5; codex 0.163.0; agy 1.4.3 (`-p` print mode); docker 29.9 + compose v5.6; node 24.19; vercel CLI 62.0.0.
- Verified: INSTANTS has 30 md, 13 mmd, 21 excalidraw, 92 exports in `out/` (some md PDFs missing).
- Assumption: Vercel project will use framework preset "Other" with prebuilt output.
