---
title: SlideRAG-mini — Mire való és hol tart?
tags: [sliderag-mini, rag, pptx]
source: "SlideRAG-mini @aea4579 (docs/.prepare/execution-plan.md, decision-log.md, brainstorm-plan.md) + GitHub issues #1–#15, PR #16, milestones, project 5, olvasva 2026-11-04"
created: 2026-11-04
---

# SlideRAG-mini — Mire való és hol tart?

> Jóváhagyott terv (EXEC-01, 2026-11-03), nem működő termék: 2026-11-04-én a `main` ágon csak dokumentáció van.

## Problem
Fél perc alatt elmondani, mi a SlideRAG-mini: tervezett egyfelhasználós PowerPoint-asszisztens, amely diahivatkozással válaszol, vagy kimondja, hogy nincs elég forrás — és hogy most hol tart.

## Instant solution
**Mit fog csinálni (terv, [EXEC-01 §2](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L21)):**
1. A böngészőben feltöltesz egy `.pptx`-et (egy fájl, legfeljebb 10 MiB).
2. Kérdezel a diák szövegéről.
3. Ha a visszakeresett diák alátámasztják: válasz + ellenőrzött forrás (fájlnév, diaszám).
4. Ha nem: a rögzített, angol fallback-szöveg ([EXEC-01 L73](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L73)):
   „I couldn't find sufficient information in the uploaded presentations to answer that question. Please upload a relevant document or ask about the indexed material.” — azaz: a feltöltött anyagban nincs elég információ; tölts fel releváns dokumentumot, vagy az indexelt tartalomról kérdezz.

Keret: privát, egyfelhasználós, csak szintetikus adat. Nincs OCR, auth, chat-előzmény, JS frontend, második modellszolgáltató ([EXEC-01 L28](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L28)).

**A demo pakli szerepe (terv).** `5G_RAN_Operations_Demo.pptx`: tíz diás, kitalált 5G-RAN üzemeltetési anyag, minden dián „szintetikus” jelöléssel ([eredeti terv §9](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/brainstorm-plan.md#L371-L394)). Erre épül a „kész” definíciója ([EXEC-01 L25](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L25)). **Még nem létezik:** a tervezett `demo/generate_pptx.py` fogja előállítani ([#12](https://github.com/w7-mgfcode/SlideRAG-mini/issues/12)), és ez sincs a `main`-en.

| # | Elfogadási kérdés (magyarul, illusztratív, a terv alapján) | Elvárt viselkedés |
|---|---|---|
| 1 | Mekkora volt a csúcs-latencia az INC-042 alatt? | 46 ms, 4. dia |
| 2 | Mekkora PRB-kihasználtságot mértek a torlódáskor? | 92%, 5. dia |
| 3 | Mi vezetett a latencia növekedéséhez? | szintézis a 4., 5. és 7. diából |
| 4 | Mit vizsgáljon először a mérnök csúcsidőben? | a 7–9. dia diagnosztikai lépései |
| 5 | Mi a hálózat *valódi, aktuális* üzemzavar-állapota? | elutasítás: a paklin nincs rá forrás |

### Állapot 2026-11-04 (ellenőrzött GitHub-állapot)
- `main` @`aea4579`: egyetlen commit, csak dokumentáció ([#1](https://github.com/w7-mgfcode/SlideRAG-mini/issues/1) lezárva commit-bizonyítékkal). Nincs app-kód, teszt, Dockerfile, `pyproject.toml`.
- 0 CI-futás, 0 tag, 0 release.
- 6 [mérföldkő](https://github.com/w7-mgfcode/SlideRAG-mini/milestones), mind nyitott, határidő nélkül.
- 15 issue-ból 14 nyitott (1 umbrella + 6 epic + 8 sub-issue; csak #1 zárt).
- [PR #16](https://github.com/w7-mgfcode/SlideRAG-mini/pull/16) (GitHub-scaffolding, „Closes #10”) nyitott, nincs merge-ölve.
- Következő: M0 lezárása (#9 hitelesítés/toolchain/host, #10 → PR #16), utána M1 — Stack Proof.

## Why it works / gotchas
- **Terv ≠ működés.** Az owner 2026-11-03-án az irányt hagyta jóvá ([D-16…D-21](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/decision-log.md#L70)); a terv szerint a jóváhagyás nem bizonyíték arra, hogy bármi átment ([EXEC-01 L19](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L19)). M1 után frissítendő.
- **Hivatkozás ≠ igazság.** A diahivatkozás azt igazolja, honnan jön a szöveg, nem azt, hogy a válasz helyes ([EXEC-01 L72](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L72)).
- Az öt kérdés demonstráció, nem mért elutasítási arány ([EXEC-01 L68](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L68)).
- Guided Path tovább: `sliderag-mini-architecture-stack` → `sliderag-mini-upload-citation-flow` → `sliderag-mini-milestones-reference` → `sliderag-mini-release-gate-verification`.
