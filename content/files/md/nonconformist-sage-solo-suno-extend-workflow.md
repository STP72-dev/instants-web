---
title: NONCONFORMIST — continue a live-session recording with Suno Extend
tags: [nonconformist, music, techno, suno, workflow]
source: "Production analysis 2026-10-20 + help.suno.com articles 6141569, 2409601, 13924929, 9601601 (checked 2026-10-20)"
created: 2026-10-20
---

# NONCONFORMIST — continue a live-session recording with Suno Extend

## Problem
Turn the sage solo snippet into a full track by continuing the real audio, and compare takes instead of guessing.

## Instant solution
**Loop:**
1. **Trim** to just under 60 s and **keep the percussion ending**: cut from the start, e.g. `ffmpeg -ss 2.1 -i snippet.wav -c copy snippet-59s.wav` (61.02 → ~58.9 s).
2. suno.com/create → Upload Audio → the trimmed file.
3. Select it → **Remix/Edit → Extend**; set the start point near the end of the percussion passage.
4. Styles: SAGE-3A first (`nonconformist-sage-solo-suno-3a-faithful`). Instrumental on. Lyrics block if the UI accepts it.
5. Generate 2+ takes. Listen to the drums → kick + bass transition first.
6. Score every take (table below) against a target set before take 1 (e.g. 70; my default, not from the analysis). Below target → **change ONE parameter** → back to step 3.
7. At or above target → **Get Whole Song** to stitch original + continuation.
8. Then SAGE-3B as the second experiment.

**QA rubric** (score 1–5 after listening; weighted = Σ score × weight × 20, weight as a fraction, e.g. 0.30)

| Criterion | Weight |
|---|---|
| Original groove fidelity | 30 % |
| Seamless continuation | 25 % |
| Musical development | 20 % |
| Sound quality / low end | 15 % |
| DJ-ready ending | 10 % |

Example: all 4s → 80 / 100.

**Generation log** (one row per take)
```
| # | date | prompt | extend at | changed | groove | seam | dev | low | end | /100 | keep? | notes |
|---|------|--------|-----------|---------|--------|------|-----|-----|-----|------|-------|-------|
| 1 |      | 3A     |           | —       |        |      |     |     |     |      |       |       |
```

**Suno limits** (help.suno.com, checked 2026-10-20)
- Free: audio upload up to 60 s, then Extend or Cover (the article is old; re-check in the UI). Pro/Premier: 8 min.
- v6 / v6-wild / v6-mini: up to 8 min per generation.
- Free: 50 credits, renewed daily; results are **personal, non-commercial** only.
- "v6-mini is the Free model": unconfirmed.

## Why it works / gotchas
- Trimming the end instead of the start throws away the percussion ending that the continuation must pick up.
- Bracket Lyrics are guidance, not timeline control; the Extend start point is the real control.
- One change per take keeps the log comparable; change prompt, start point or variant, never two at once.
- **Licensing checkpoint:** before any release under Gabe Sage, check the plan's terms. Free-plan generations are non-commercial even when the uploaded audio is your own composition.

## Diagram brief
- Type: flowchart with a retry loop.
- Trim (keep ending) → Upload → Extend (3A) → Generate → Score ≥ target? → no: change ONE parameter → back to Extend; yes: Get Whole Song → 3B experiment.
- Side card: rubric weights as a 5-bar chart; licensing checkpoint as a gate before "release".
