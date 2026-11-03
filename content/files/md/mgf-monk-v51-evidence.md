---
title: mGF Monk v5.1 — bizonyítékok, baseline és trading teszt
tags: [mgf-monk, trading, nas100, backtesting, baseline]
source: "mGF Monk v5.1 Visual Learning Guide (HTML), az mGF Monk v5.1 audit alapján; olvasva 2026-11-03"
created: 2026-11-03
---

# mGF Monk v5.1 — bizonyítékok, baseline és trading teszt

> Tanulási célú összefoglaló. Nem befektetési tanács és nem kereskedési jelzés.

## Problem
Melyik Monk-állítást mennyire támasztják alá az adatok, és van-e kereskedési edge?

## Instant solution
**Baseline-kihívás**
- HIGH átlagos előrejelzési hiba: **0,80%** (korábbi forecast) → **0,40%** (nyitás után), ≈45% csökkenés — főként a nyitóár ismeretéből.
- Monk vs. `open + k×ATR`: a baseline-t 2006–2015-ön illesztették, 2022–2025-ön hasonlították → a módusz eltérése **0,003 pp**. Jelenleg nem mutat egyértelmű többletértéket.

**Trading teszt** — QQQ · belépés nyitáskor · kilépés záráskor · költségek előtt

| Forgatókönyv | Kötések | Átlag / kötés | Értelmezés |
|---|---|---|---|
| Mindig LONG | 5 219 | +2,2 bp | baseline |
| LONG, ha HIGH bullish | 4 232 | +2,1 bp | nem jobb a baseline-nál |
| LONG, ha mindkét modell felfelé hajlik | 3 837 | +0,7 bp | gyengébb |
| LONG, ha a modellek eltérnek | 932 | +7,9 bp | hipotézis, nem bizonyított edge |

- **p = 0,049** — nominálisan éppen szignifikáns; ≈10 teszt után a többszörös tesztelési korrekció miatt nem meggyőző.
- **≈2 bp** round-trip költségnél minden kimutatott edge eltűnik (becsült érzékenység, nem mért CAPITALCOM spread/slippage).
- 1 bp = 0,01 százalékpont; a +7,9 bp nem automatikusan realizálható profit.

**Állítás → bizonyíték → értékelés**

| Állítás | Bizonyíték | Értékelés |
|---|---|---|
| Nincs directional edge | 54,8% vs. 55,2%; korreláció 0,006 | erősen alátámasztott a QQQ-mintán |
| Range coverage használható | HIGH 91,2%; LOW 94,2% | részben; szélesség és baseline is kell |
| Monk jobb az ATR-nél | ATR-baseline közel azonos | nincs igazolva |
| Eltérő modellek = lehetőség | +7,9 bp; p=0,049; 2022–25: +1,1 bp | nem bizonyított |
| CAPITALCOM feeden is működik | 135 napos NAS100 scorecard, de a fő backtest QQQ | instrumentumspecifikus validáció kell |

## Why it works / gotchas
- **QQQ ≠ NAS100 CFD.** Szorosan kapcsolódnak, de más a session, árazás, spread és végrehajtás → a QQQ-teszt nem helyettesíti a CFD-adatos validációt.
- **Coverage önmagában kevés.** Egy nagyon széles sáv is magas coverage-et ér el; szélesség + átlagos hiba + baseline-hoz mért többlet együtt számít.
- Áttekintés: `mgf-monk-v51-overview`. Teendők: `mgf-monk-v51-next-steps`.
