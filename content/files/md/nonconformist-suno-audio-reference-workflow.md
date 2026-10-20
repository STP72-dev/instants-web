---
title: NONCONFORMIST — recreate your own track in Suno v6 from an audio snippet
tags: [nonconformist, music, techno, suno, workflow]
source: "Track DNA analysis 2026-10-20 + help.suno.com (Max Mode) + Suno v6 create guides"
created: 2026-10-20
---

# NONCONFORMIST — recreate your own track in Suno v6 from an audio snippet

## Problem
Get Suno to sound like an existing NONCONFORMIST recording. Text-only prompting drifts; start from the real audio.

## Instant solution
| Setting | Value |
|---|---|
| Model | v6 |
| Source | Upload Audio → the snippet (hell YEAH: 37.9 s) |
| Styles | Version A first (`nonconformist-hell-yeah-suno-version-a`) |
| Instrumental | on |
| Variety | 0 for the first tests |
| Max Mode | on — meant for covers that stay close to the original / style transfer |
| Audio Influence | high to stay close; lower it to let Styles steer (verify the name in the UI) |
| Exclude | see block below |

```
vocals, epic cinematic pads, trance leads, EDM risers, festival drops, acoustic guitars, supersaw synths
```

**Loop:**
1. Upload snippet → paste Styles A → paste Exclude → Instrumental on, Variety 0, Max Mode on.
2. Generate 2–4 takes; judge only the core: synth figure × tribal percussion × heavier bass.
3. Too far off → raise Audio Influence or shorten Styles. Too close / static → lower it.
4. Want structure → try the bracketed Lyrics arrangement in a **separate** run.
5. A sounds right → decide: stay faithful, or move to Version B.

## Why it works / gotchas
- The Instrumental toggle is the safest way to get no vocals; the "[Instrumental]" tag alone is weaker.
- Bracketed Lyrics instructions are **guidance, not a guarantee** — Suno may ignore some sections.
- Negatives belong in **Exclude**; writing "trance lead" in Styles can pull it in.
- Max Mode costs more credits; use it for the close-copy runs, not for quick sketches.
- Low Variety = higher fidelity to the Styles prompt.
- Same workflow fits other NONCONFORMIST tracks: swap the snippet and the Styles.

**Decision (2026-10-20):** faithful first — iterate Version A until it sounds like the original; Version B (modern 2026 reinterpretation) comes after.

## Diagram brief
- Type: flowchart, left → right.
- Upload snippet → Styles A + Exclude → Instrumental · Variety 0 · Max Mode → Generate → diamond "core identity there?".
- No → "adjust Audio Influence / trim Styles" → back to Generate; side path "try Lyrics brackets".
- Yes → diamond "faithful or 2026 reinterpretation?" → Faithful: extend with A arrangement · Reinterpret: switch to Version B.
