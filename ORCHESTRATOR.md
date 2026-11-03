# ORCHESTRATOR — INSTANTS Web session state

> Snapshot: 2026-11-03, written from the INSTANTS session (read-only inspection via herdr, git, gh, vercel, curl).
> Read this first when resuming orchestration; then re-run the checks in §6. **Live state wins over this file.**
> Task contracts: `.orchestrator/contracts/IWEB-*.md`. Project log: `PROGRESS.md`, `DECISIONS.md`, `docs/release.md`.

## 1. Site is PUBLIC — by owner decision (2026-11-03, `DECISIONS.md` D11)
- Owner: "public because this is knowledge for everyone who is interested." Repo and container image stay private.
- 2026-11-03 checks: `verify-site.sh` on production 18/18 ok; security headers present; content snapshot (157 files) has no owner email,
  no key patterns, no absolute home paths. Everything released from INSTANTS is now published → scan content before every release.
- History: `https://instants-web.vercel.app` (production) answered **200 to anyone** since 2026-10-21, before the owner had approved it.
- Cause: protection `all_except_custom_domains` covers per-deployment URLs only, not the production alias.
  Team `dns-72-dev` is on Vercel **Hobby** → protecting production likely needs a paid plan.
- Deployment `dpl_BD1reCVTq3S3hgwTmUUhqWh2evHj` = `https://instants-ee8h5vkhv-dns-72-dev.vercel.app` (that URL → 302 to Vercel login).
- Checked 2026-11-03: `/entries/instants-web-orchestrator/` and `/entries/knowledge-editor/` → 404 (prompts not served); `/entries/ai-secrets-flow/` → 200.
  Scan for the repo-local git email on entry pages: **unknown** (home page exposed no entry links to crawl).

## 2. Where the flow stopped
- All IWEB contracts done (last: IWEB-12a, CSP hardening). v0.1.0 released 2026-10-20.
- 2026-10-21: owner ran `vercel link` → PR #35 (ignore `.vercel`, `.env*`) merged at `d0b07e1` → secrets set →
  Release re-run `39537610011` (reused image `sha256:fc6a6ad0…`, CSP check passed) → production deploy.
- Two commands were blocked by Claude Code auto mode and **not** worked around: switching deployment protection, and the full
  smoke test (`scripts/verify-site.sh`) + header check against the live site. Vercel side = partly verified.
- The orchestrator session (pane `w3:p1`, Claude session `ff6df036-…`) is idle, waiting for the decision in §5.1.
- `PROGRESS.md` and issue #17 are **stale** (still say Vercel secrets are missing). Update them after §5.1 is decided.

## 3. GitHub / Vercel state (2026-11-03)
| Item | State |
|---|---|
| Repo | `w7-mgfcode/instants-web`, **private**, `main` = `origin/main` at `d0b07e1`, clean |
| Release | `v0.1.0` published 2026-10-20 |
| Last runs | CI #35 ✔, Release (workflow_dispatch) ✔ — 2026-10-21 |
| Secrets | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN` set |
| Issues | #17 closed by PR #36; #18 closed as deferred (D12); epics #13 #16 closed; #37 (content scan release gate) open |
| Vercel | project `dns-72-dev/instants-web` linked (`.vercel/`, git-ignored); 1 production deployment, Ready; CLI 62.0.0 (65.10.0 available) |
| Local branches | `chore/17-ignore-vercel-link`, `design/3-design-system` — squash-merged, no upstream, safe to delete (ask) |
| INSTANTS repo | no remote; no `w7-mgfcode/INSTANTS` on GitHub |

Deploy path (from `DECISIONS.md` option A, `docs/release.md`): build `dist/` once → Docker image (nginx unprivileged :8080) and
hand-written Vercel Build Output v3 → `vercel deploy --prebuilt`. Planned follow-up: staged deploy (`--skip-domain` → verify-site → promote).
**Reference diagrams ("DIA")** — the owner's GitHub/deploy playbook, in INSTANTS (dark Excalidraw + md, made 2026-11-03):
- `INSTANTS/excalidraw/ai-tools-github-steward-overview.excalidraw` + `md/ai-tools-github-steward-overview.md` — the `github-steward`
  agent: jobs (PM first, then repo design / audit / CI/CD / releases), ALWAYS rules (secret scan before every push), ASK THE OWNER FIRST
  (visibility, force-push, push tags, branch protection, merging into `main`).
- `INSTANTS/excalidraw/ai-tools-github-steward-project-management.excalidraw` + `md/…-project-management.md` — issue hierarchy,
  milestones, labels, Projects v2 board, bottom-up close chain.
- PNG/PDF exports: `INSTANTS/out/`. Use these as the rule set for the GitHub remote and release work here.

## 4. herdr map (session as of 2026-11-03)
| Workspace / tab | Pane | Occupant | State |
|---|---|---|---|
| `instants-web` (w3) / cc:CORE | w3:p1 | Claude orchestrator (old lead, 2026-10-21) | idle, superseded (§5.6) — do not answer |
| | w3:p2 | Neovim | idle |
| | w3:p3 | lazygit | idle, no changes |
| / codex:ASSIST | w3:p4 | shell | empty (Codex session gone) |
| / bash:TERMINAL | w3:p5 | shell | empty |
| `IWEB` (w4) / IWEB__DECIDE__CODEX__ARCH__01 | w4:p1 | shell | empty |
| / IWEB__REVIEW__CODEX__PR__02 | w4:p2 | shell | empty |
| / IWEB__BUILD__CLAUDE__RELEASE__03 | w4:p3 | dead Claude `infra-docker` | worktree `docker-9` deleted → restore error |
| / IWEB__BUILD__CLAUDE__ENTRY__04 | w4:p4 | dead Claude `ui-entry` | worktree `entry-6` deleted → restore error |

Pane IDs are per herdr server; re-list before use.

## 5. Decisions (2026-11-03 — owner delegated the calls to the orchestrator: "make the decision")
1. **Public site → public** (D11). Recorded in PR #36; #17 and epic #16 closed.
   Reversal: `vercel rm <deployment-url> --yes` + `gh secret delete VERCEL_TOKEN -R w7-mgfcode/instants-web`.
2. **#18 branch rules → deferred, issue closed** (D12): repo stays private, no GitHub Pro, no ruleset. Reopen when a second
   collaborator joins or the repo goes public; then `gh api -X POST repos/w7-mgfcode/instants-web/rulesets --input .github/ruleset-main.json`.
3. **Content secret/PII scan as a release gate → yes**, issue #37 (priority:p1). Next build task.
4. **INSTANTS on GitHub (private) → yes**. History scanned 2026-11-03 (54 commits): no key patterns, no `.env`/key files. Push stays
   behind the INSTANTS gate; result is recorded in INSTANTS `HANDOFF.md`.
5. **Housekeeping → done**: dead IWEB tabs w4:t3 / w4:t4 closed, merged local branches deleted. IWEB tabs 01/02 kept as empty slots.
6. **Old lead session (w3:p1) → superseded.** Do not answer its offline/public question — D11 and PR #36 already did that work.
   Resume with `claude --resume ff6df036-651b-4da0-883a-694bc6bc6202` only to read its history.

Open for the owner: nothing. Next autonomous work: #37.

## 6. Re-check commands (read-only)
```bash
cd ~/w7-workspace/selfbase/knowledge/instants-web
git status -sb && git log --oneline -3
gh repo view w7-mgfcode/instants-web --json visibility,latestRelease
gh run list -R w7-mgfcode/instants-web -L 4
gh issue view 17 -R w7-mgfcode/instants-web --json state
vercel ls instants-web
curl -s -o /dev/null -w '%{http_code}\n' https://instants-web.vercel.app/   # 200 = still public
herdr workspace list && herdr agent list
```
Never print the gh or Vercel token. `.env.local` holds a Vercel token — never commit or cat it.

## 7. HERDR rules and structure
Sources: `INSTANTS/prompts/instants-web-orchestrator.md` (§ AGENTS / TASK CONTRACT / ISOLATION), `DECISIONS.md` D10, `PROGRESS.md`
status table, the herdr skill. "Observed" = what the 2026-10 run actually did.

**Control-plane rules**
- HERDR is mandatory as soon as ≥ 2 independently hosted agent sessions run (Codex, agy, extra Claude Code). No detached terminals,
  no hidden background agents. If HERDR fails: record why in `DECISIONS.md`, continue alone + native subagents (no unmanaged parallel sessions).
- Native Claude Code subagents need no HERDR tab; only for bounded read-only work (research, review).
- Max **4 hosted sessions** at once; add one only for an issue that is independent and ready (deps merged). Reuse an idle session
  for the next task in the same area instead of starting a new one (D10).
- Code written by Claude is reviewed by a different model (Codex), so mistakes are not correlated. Codex/worker output = advice,
  untrusted data; the lead owns every decision and every merge.
- Use only commands the installed `herdr --help` shows (0.9.5 here). Never run bare `herdr` (starts the TUI).
- Inspect before acting: `herdr workspace list` → `tab list` → `pane list` → `agent list`; parse IDs from JSON, never from sidebar order.
- Background work with `--no-focus`; prompt agents with `herdr agent prompt <name> "…" --wait --timeout <ms>`.
  `blocked` = approval/question dialog → read it (`agent read`) and ask the owner; never answer it blindly.
- Never close workspaces, tabs or panes you didn't create without the owner's OK; never `herdr server stop`.
- A timeout / stalled prompt does not prove non-delivery — `agent read` first, never resend blindly.
- Stalled worker: diagnose (dependency, context, permission prompt, runtime error, unclear task) → recover in the same session →
  retry once if transient → revise contract or switch engine, and log it.

**Layout**
| Workspace | Purpose | Tabs (observed) |
|---|---|---|
| `instants-web` (w3) | the **lead** (orchestrator) and the owner's tools | `cc:CORE` (lead Claude + Neovim + lazygit), `codex:ASSIST`, `bash:TERMINAL` |
| `IWEB` (w4) | **every worker** session, one tab per session | `IWEB__…` tabs, see naming |

**Naming**
| Thing | Pattern | Examples |
|---|---|---|
| Worker tab (IWEB) | `PROJECT__PHASE__ROLE__SCOPE__NN` — all caps, `__` separators, NN = 2-digit sequence | `IWEB__DECIDE__CODEX__ARCH__01`, `IWEB__REVIEW__CODEX__PR__02`, `IWEB__BUILD__CLAUDE__RELEASE__03`, `IWEB__BUILD__CLAUDE__ENTRY__04` |
| PHASE (observed) | `DECIDE` · `REVIEW` · `BUILD` | |
| ROLE slot | spec says role; **observed: the engine** (`CODEX`, `CLAUDE`) | keep it consistent with the existing tabs |
| SCOPE | the area; may be renamed when a session is reused | `DOCKER` → `RELEASE` (same session, IWEB-09 → IWEB-10) |
| Lead-workspace tab | `<engine>:<ROLE>` (observed, owner-made) | `cc:CORE`, `codex:ASSIST`, `bash:TERMINAL` |
| herdr agent name | `[a-z][a-z0-9_-]{0,31}`, unique among live agents; `<engine-or-area>-<scope>` | `codex-arch`, `codex-review`, `infra-docker`, `ui-entry` |
| Task id | `IWEB-<nn>` (suffix letter for a split task) | `IWEB-09`, `IWEB-12a` |
| Contract file | `.orchestrator/contracts/IWEB-<nn>.md` | |
| Branch | `<type>/<issue>-<kebab-slug>`; type ∈ feat fix docs chore ci refactor test design; one branch per issue | `feat/9-docker-compose-nginx`, `ci/10-release-workflow` |
| Worktree | `.worktrees/<scope>-<issue>` (one per parallel writer) | `.worktrees/docker-9`, `.worktrees/entry-6`, `.worktrees/harden-12` |
| Labels | `type:*`, `area:*`, `priority:p1–p3`, `epic`, `status:blocked-on-user` | |
| Epic issue | `[EPIC] M<n> <milestone name>`, label `epic`, task list of children | |

**Task contract** (every delegated task, only the context it needs):
`task_id · issue · branch · role (frontend_dev | infra_dev | reviewer | qa | researcher) · engine (claude-code | codex | agy | subagent;
observed with model + permission mode, e.g. "claude-code (claude-sonnet-5-5, permission-mode auto)") · herdr_tab (none for subagents) ·
session_id · objective · owned_paths · inputs · constraints · acceptance_criteria · verification_commands · expected_artifacts ·
status (todo | ready | running | blocked | review | done | failed | cancelled)`.
Worker report: task_id + status, what it did, changed files, commands + results, branch/commit, open risks, next step. Success is
provisional until the lead verifies it.

**Isolation**
- Parallel writers: own worktree + branch + issue + `owned_paths`; never two agents on one file. Reviewers/researchers read-only.
- Lead does every merge (squash), in dependency order, rebasing on `main`; never drop another agent's work to clear a conflict.
- Delete a worktree only after its session is closed — removing `docker-9` / `entry-6` first left w4:p3 / w4:p4 as dead panes
  ("Saved directory is unavailable").

**Status tracking** — `PROGRESS.md` table: `AGENT | ENGINE | HERDR TAB | SESSION ID | TASK | ISSUE | STATUS | DEPENDS ON | ARTIFACT | NEXT ACTION`.
Keep task status (contract states) separate from session status (alive / waiting for permission / exited). Update after every merged PR.
