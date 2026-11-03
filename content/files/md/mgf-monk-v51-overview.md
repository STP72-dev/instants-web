---
title: mGF Monk v5.1 — mit tud valójában (verdikt, számok, működés)
tags: [mgf-monk, trading, nas100, backtesting, indicator]
source: "mGF Monk v5.1 Visual Learning Guide (HTML), az mGF Monk v5.1 audit alapján; olvasva 2026-11-03"
created: 2026-11-03
---

# mGF Monk v5.1 — mit tud valójában (verdikt, számok, működés)

> Tanulási célú összefoglaló. Nem befektetési tanács és nem kereskedési jelzés.

## Problem
Egy perc alatt felidézni, mire jó a Monk (NAS100 napi range-indikátor), és mire **nem** — számokkal.

## Instant solution
**VERDICT · PARTIALLY POSITIVE** — hasznos a napi mozgási tartomány és volatilitás becslésére, de **nem** igazolt megbízható LONG/SHORT irányelőrejelzést vagy önálló trading edge-et.

| Mérőszám | Érték | Mit jelent |
|---|---|---|
| Direction hit rate | **54,8%** | a „mindig emelkedést várunk” baseline **55,2%** → nincs irány-edge |
| HIGH coverage | **91,2%** | 135 napos NAS100 scorecard, 114 megfigyelés, 95%-os CI: 84,6–95,2% |
| LOW coverage | **94,2%** | 135 napos NAS100 scorecard, 86 megfigyelés |
| QQQ backtest | **5 219** nap | 2006–2026, QQQ-adat, nem NAS100 CFD |
| After-open | **≈45%** | HIGH átlagos hiba 0,80% → 0,40%, ha ismert a nyitóár |
| CLOSE sample | **n = 18** | CLOSE coverage 77,8%, de a minta túl kicsi |

**Működés (5 lépés):** korábbi sessionök (180 napos minta) → rövidebb modell (60 napos részhalmaz) → gyakoriságok (korábbi mozgások eloszlása) → ATR-skálázás (aktuális volatilitás) → range forecast (HIGH / LOW / CLOSE).

| Mit becsül | Mit nem bizonyít |
|---|---|
| a napi HIGH lehetséges tartományát | hogy LONG vagy SHORT lesz a nap |
| a napi LOW lehetséges tartományát | önmagában validált belépési pontot |
| a CLOSE várható eltérését / tartományát | hogy jobb az egyszerű ATR-szabálynál |
| az aktuális ATR-rel skálázott mozgásméretet | nem garantálja a stop vagy target sikerességét |

**Végső döntés: KEEP + IMPROVE + FORWARD TEST** — session-context és range-referencia eszköz; önálló LONG/SHORT jelként nem, amíg nincs költségek utáni, NAS100-specifikus és forward validáció.

## Why it works / gotchas
- **ATR ≠ irány.** Az ATR a mozgás nagyságát méri; a magas ATR nagyobb lehetséges mozgást jelez, nem bullish/bearish irányt.
- **Coverage ≠ jó tartomány.** Azt méri, milyen gyakran esik a tényleges érték a sávba — nem mondja meg, elég szűk-e, vagy jobb-e egy egyszerű baseline-nál.
- Bizonyítékok és baseline: `mgf-monk-v51-evidence`. Teendők: `mgf-monk-v51-next-steps`. Ábra: `excalidraw/mgf-monk-v51-overview.excalidraw`.
