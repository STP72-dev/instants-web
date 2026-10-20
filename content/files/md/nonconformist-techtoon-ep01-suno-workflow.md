---
title: NONCONFORMIST — Techtoon ep.01/24, continue with Suno Extend (3 directions)
tags: [nonconformist, music, track-dna, suno, workflow]
source: "Track analysis 2026-10-20 (incl. its flowchart) + help.suno.com articles 6141569, 2409601, 9601601, 2425729, 2871105 (checked 2026-10-20) + scoring method from nonconformist-sage-solo-suno-extend-workflow"
created: 2026-10-20
---

# NONCONFORMIST — Techtoon ep.01/24, continue with Suno Extend (3 directions)

## Problem
Turn the snippet into full tracks by continuing the real audio in three directions from one upload, and compare takes instead of guessing.

## Instant solution
**Loop (continue with Extend):**
1. Trim to 59 s, **0:22 → 1:21** (est.), so the upload ends on the main groove: `ffmpeg -ss 22 -to 81 -i snippet.wav -c copy snippet-59s.wav`; nudge both points to bar lines.
2. Upload → Extend from the **end** of the upload (the groove). Instrumental on.
3. One direction per run, same upload: **5B** (`nonconformist-techtoon-ep01-suno-b`) → **5A** (`…-suno-a`) → **5C** (`…-suno-c`); the analysis ranks them in that order, running them in that order is my choice. Lyrics if the UI takes them; otherwise use the blocks as your plan.
4. Validate the source motif and the transition first → quality passes? → no: refine ONE creative variable → back to 2 (the analysis's flowchart).
5. Yes → **Get Whole Song**, then review the full arrangement and outro.

**Which direction for what** (analysis's comparison)
| | 5A Techno | 5B Minimal | 5C Dark Industrial |
|---|---|---|---|
| Bass | driving | elastic, sparse | heavier, gritty |
| Percussion | energetic | intricate, reduced | metallic, aggressive |
| Sonic change | moderate | low–moderate | high |
| Identity risk | low | low | higher |
| Best use | extended club mix | afterhours minimal mix | experimental warehouse version |

**QA rubric** (criteria + weights from the analysis; the 1–5 scale, the formula Σ score × weight × 20 and the log below are the house method from `nonconformist-sage-solo-suno-extend-workflow`)
| Criterion | Weight |
|---|---|
| Source fidelity | 30 % |
| Continuation | 25 % |
| Arrangement | 20 % |
| Production quality | 15 % |
| DJ usability | 10 % |

**Generation log** (one row per take)
```
| # | date | dir | changed | fidelity | contin. | arrang. | prod. | DJ | /100 | keep? | notes |
|---|------|-----|---------|----------|---------|---------|-------|----|------|-------|-------|
| 1 |      | 5B  | —       |          |         |         |       |    |      |       |       |
```

**Suno limits** (help.suno.com, checked 2026-10-20; article last edited in brackets)
- Free plan: upload up to 60 s, then Extend / Cover; Pro/Premier up to 8 min (6141569, 2025-05-30).
- Extend: drag the white arrow to choose how much of the original to keep; Get Whole Song stitches the extension to the original (2409601, 2025-12-19).
- Whether Instrumental mode hides the Lyrics field: unconfirmed, verify in the UI.

## Why it works / gotchas
- The test question: does Suno keep the bass-and-percussion interaction while going in three genuinely different directions? Louder, darker or more polished is not the goal.
- One change per take keeps the log comparable; never score a take you have not heard.
- **Licensing checkpoint:** Free-plan songs are personal, non-commercial and cannot be monetized (9601601, 2025-12-17); subscribing later does not grant commercial rights to them by default, exceptions are not guaranteed (2425729, 2025-12-17); on Basic, Suno owns what it generates, and for an extension started on Basic it advises against assuming ownership (2871105, 2026-01-07). Decide before generating a release take under Gabe Sage.

## Diagram brief
- Type: flowchart with a retry loop and a 3-way fork.
- 81.4 s snippet → trim 0:22–1:21 → upload → Extend + Instrumental → fork 5B / 5A / 5C → generate → validate motif + transition → score ≥ target? → no: change ONE variable → back; yes: Get Whole Song → review.
- Side card: rubric weights; licensing as a gate before "release".
