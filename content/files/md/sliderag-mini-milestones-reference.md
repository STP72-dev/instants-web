---
title: SlideRAG-mini — Mérföldkövek és GitHub-projekt
tags: [sliderag-mini, github-projects, milestones]
source: "SlideRAG-mini @aea4579 (docs/.prepare/execution-plan.md, decision-log.md) + GitHub issues #1–#15, milestones, project 5, olvasva 2026-11-04"
created: 2026-11-04
---

# SlideRAG-mini — Mérföldkövek és GitHub-projekt

> A kimenetek tervek (EXEC-01 §8). Ellenőrzött csak a GitHub-állapot: mérföldkövek, issue-hierarchia, board, 2026-11-04-i olvasás szerint.

## Problem
Egy táblából látni a SlideRAG-mini hat mérföldkövét, mindegyik ellenőrizhető kimenetét és időkeretét, és azt, hogyan kapcsolódik az umbrella, az epicek és a board.

## Instant solution
Mind a 6 [mérföldkő](https://github.com/w7-mgfcode/SlideRAG-mini/milestones) nyitott, határidő nélkül. Kimenet = a mérföldkő leírásának „Exit” része ([EXEC-01 §8](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L121-L129)).

| GitHub-mérföldkő (pontos cím) | Ellenőrizhető kimenet (exit, terv) | Időkeret | Epic / sub-issue | Issue-k nyitott / zárt |
|---|---|---|---|---|
| `M0 - Preparation` | publikus provenance átnézve, GitHub bootstrap, hitelesítés/toolchain ellenőrzés, biztonságos host; tényleges idő külön rögzítve | órán kívül | [#3](https://github.com/w7-mgfcode/SlideRAG-mini/issues/3) / #1, #9, #10 | 3 / 1 |
| `M1 - Stack Proof` | lockolt Python 3.12 függőségek, valódi embedding + natív strukturált kimenet, fresh-process Chroma perzisztencia, alap lokális konténer, minimális offline CI | 60 perc | [#4](https://github.com/w7-mgfcode/SlideRAG-mini/issues/4) / #11 | 2 / 0 |
| `M2 - Complete Local Path` | böngészős feltöltés, kinyerés/indexelés, támogatott válasz ellenőrzött forrással, duplikált feltöltés index-növekedés nélkül | 150 perc | [#5](https://github.com/w7-mgfcode/SlideRAG-mini/issues/5) / #12 | 2 / 0 |
| `M3 - Failure & Evidence Checks` | konzisztencia-, helyreállítási és hibaesetek, független kalibrációs próbák, öt élő kérdés + szemantikai review | 105 perc | [#6](https://github.com/w7-mgfcode/SlideRAG-mini/issues/6) / #13 | 2 / 0 |
| `M4 - Deployment & Demo` | EC2-újralétrehozás bizonyítéka, mount/boot ellenőrzés, memória/latencia megfigyelés, README, begyakorolt 3–5 perces demo | 75 perc | [#7](https://github.com/w7-mgfcode/SlideRAG-mini/issues/7) / #14 | 2 / 0 |
| `v0.1.0 - Release Gate` | review-zott verzió/CHANGELOG PR, owner által engedélyezett kézi tag és release az EC2-elfogadás után (a QG-09 bizonyíték az M4-ben számít) | 10 perc (a 30 perces workflow-keretből) | [#8](https://github.com/w7-mgfcode/SlideRAG-mini/issues/8) / #15; + umbrella #2 | 3 / 0 |

### Hogyan függ össze?
- **Umbrella [#2](https://github.com/w7-mgfcode/SlideRAG-mini/issues/2)** (milestone `v0.1.0 - Release Gate`) → 6 epic natív sub-issue-ként: #3 (E0) … #8 (E5).
- **Epicek → sub-issue-k:** #3 alatt három (#1, #9, #10), a #4–#8 alatt egy-egy (#11–#15). Mérföldkövenként egy kimenet-méretű sub-issue/PR ([EXEC-01 L135](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L135)).
- **Lezárás alulról felfelé:** gyerek (merge + bizonyíték) → epic → umbrella (#2 „Tracking”).
- **[Board #5](https://github.com/users/w7-mgfcode/projects/5)** („SlideRAG Mini Delivery”): mind a 15 issue kártya, saját Status mezővel. A [PR #16](https://github.com/w7-mgfcode/SlideRAG-mini/pull/16) nem kártya és nincs mérföldköve.

### Számok, 2026-11-04 (ellenőrzött)
| Hierarchia-szint | Issue | Nyitott | Zárt |
|---|---:|---:|---:|
| 1. umbrella | 1 | 1 | 0 |
| 2. epic | 6 | 6 | 0 |
| 3. sub-issue | 8 | 7 | 1 (#1) |
| **Összesen** | **15** | **14** | **1** |

**Board-kártyák (külön az issue-állapottól):** Backlog 11, Ready 2 (#3, #9), In Review 1 (#10), Done 1 (#1); In Progress 0, Blocked 0.

### Időkeret
- **480 perc = tervezett implementációs keret:** 60 (M1) + 150 (M2) + 105 (M3) + 75 (M4) + 30 (workflow) + 60 (tartalék). „Planning allocation, not a validated forecast” ([EXEC-01 L129](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L129); [DL D-20](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/decision-log.md#L82)).
- **Az előkészítés külön van:** kb. 120 perc ideiglenes becslés (#1 45 + #9 55 + #10 20). A tényleges idő ismeretlen, mert még nincs rögzítve ([EXEC-01 L119](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L119)).

## Why it works / gotchas
- **Issue-állapot ≠ kártya-státusz.** A „Ready” vagy „In Review” kártya mögött nyitott issue van; Done = bizonyítékkal lezárt munka.
- **Ne add össze a szülők rollupjait.** A board Estimate mezőjében a levelek 400 percet adnak (390 + 10 release-adminisztráció), ehhez jön 20 workflow és 60 tartalék, egyszer = 480 ([#2](https://github.com/w7-mgfcode/SlideRAG-mini/issues/2) „Risks”).
- **Csúszásnál** a terv szerint a mért eltérést kell jelenteni és újrabecsülni, a kapukat nem szabad lazítani ([EXEC-01 L131](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L131)).
- Furcsaság: a #2 umbrella Gate mezője a boardon „None (preparation)”. Ez megfigyelt érték, nem kell értelmezni.
- Mit kell igazolni a release előtt: `sliderag-mini-release-gate-verification`. Kiindulópont: `sliderag-mini-overview`.
