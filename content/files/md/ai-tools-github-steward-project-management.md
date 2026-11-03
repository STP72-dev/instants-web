---
title: AI tools — github-steward agent, project management model
tags: [ai-tools, claude-code, agent, github, project-management]
source: "SlideRAG-mini .claude/agents/github-steward.md § 1 (my own Claude Code subagent, read 2026-11-03)"
created: 2026-11-03
---

# AI tools — github-steward agent, project management model

## Problem
Turn a plan into a navigable, truthful GitHub issue tree — and keep it truthful as work lands.

## Instant solution
**Hierarchy:**
```
Milestone (time box = plan milestone)
└─ Umbrella   type:umbrella   one per deliverable outcome
   └─ Epic    type:epic       one per delivery surface; carries a milestone
      └─ Sub-issue  type:sub-issue   one branch + one PR; same milestone
```

**Link as native sub-issue** (the API takes the child's `id`, not its number):
```bash
CHILD_ID=$(gh api repos/w7-mgfcode/SlideRAG-mini/issues/<child_no> --jq .id)
gh api -X POST repos/w7-mgfcode/SlideRAG-mini/issues/<parent_no>/sub_issues -F sub_issue_id="$CHILD_ID"
```

**Milestones (mirror the plan):** `M0 - Readiness` (outside the 8 h clock) · `M1 - Skeleton` 60 min · `M2 - PPTX Ingestion` 120 · `M3 - Grounded RAG` 120 · `M4 - Deploy & Polish` 120 / 85 · `v0.1.0 - Release Gate` (inside buffer).

**Labels (taxonomy):** `type:` exactly one · `area:` one or two (`api`, `ingest`, `rag`, `config`, `ui`, `demo`, `tests`, `docs`, `deploy`, `ci`, `repo`, `release`) · `gate:` `qg-01` … `qg-09` · `priority:` `p0` / `p1` / `p2` · `tier:` `must-have` / `later` · `status:blocked`.
Create idempotently: `gh label create <name> --color <hex> --description <d> --force`.

**Projects v2 board `SlideRAG Mini Delivery`:** Status (`Backlog`, `Ready`, `In Progress`, `In Review`, `Blocked`, `Done`) · Type · Area · Priority · Gate (text) · Estimate (min) · Score. The default Status options are replaced with the GraphQL `updateProjectV2Field` mutation.

**Every new issue:**
1. **Vision gate** — `product-vision.md` litmus test; `LATER` / `EXCLUDED` → umbrella's `Out of scope`, not an issue.
2. **Body template** — umbrella / epic / sub-issue sections as on cvforge #129 / #130 / #135; every claim cites `file:line` or `plan § x`. Every epic and sub-issue carries `Estimate (min)`.

**After any decomposition — budget arithmetic:** sum `Estimate (min)` per milestone and in total vs. 480 min from M1; overrun goes into the umbrella's **Risks** and the report. Never trim scope yourself — the owner decides.

**Close discipline (lifecycle):** tick a checkbox only with `*(proof: PR #n / commit abc1234 / command → output)*`; sub-issue closes on PR merge (`Closes #n`); epic only when all children are closed and its criteria ticked; umbrella last. Closed parent with open children → reopen and comment why.

## Why it works / gotchas
- Titles use the commit grammar without the issue suffix: `type(scope): description`.
- A sub-issue needing two branches is two sub-issues; per-issue branch/PR overhead counts (R-15) — propose bundling when it adds up.
- `issue-to-subtasks` skill yields exactly 5 subtasks; trim when 5 would be padding and record why.
- Never close an issue because work "looks done".
- Related: `ai-tools-github-steward-overview`.

## Diagram brief
- Type: tree (hierarchy) + assembly line (issue pipeline) + loop (close discipline, bottom-up).
- Left: Milestone → Umbrella → Epic → Sub-issue tree with label chips, native-link API snippet.
- Right: vision gate diamond → body template → budget bar vs. 480 min → board columns.
- Bottom: close order arrows Sub-issue → Epic → Umbrella, proof required.
