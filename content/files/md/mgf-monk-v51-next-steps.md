---
title: mGF Monk v5.1 — továbblépés (freeze, forward log, NAS100 validáció)
tags: [mgf-monk, trading, nas100, forward-testing, research-process]
source: "mGF Monk v5.1 Visual Learning Guide (HTML), az mGF Monk v5.1 audit alapján; olvasva 2026-11-03"
created: 2026-11-03
---

# mGF Monk v5.1 — továbblépés (freeze, forward log, NAS100 validáció)

> Tanulási célú összefoglaló. Nem befektetési tanács és nem kereskedési jelzés.

## Problem
Mit csináljunk most a Monkkal, és mit érdemes megjegyezni bármely indikátor-kutatáshoz?

## Instant solution
**FREEZE v5.1 → FORWARD LOG → NAS100 VALIDATION**

| Prioritás | Teendő |
|---|---|
| **P1 · Befagyasztás és naplózás** | Rögzítsd minden nap a forecastot, időbélyeget, nyitóárat, HIGH/LOW/CLOSE értéket és a verziót. Ne módosítsd menet közben a szabályokat. |
| **P1 · NAS100 30 perces adatok** | Futtasd újra a vizsgálatot a tényleges CFD-feed historikus adataival, a QQQ-tól elkülönítve. |
| P2 · Jelölések és vizuális logika | Nevezd át a félreérthető bullish/bearish címkéket, távolítsd el az információt nem adó AVOID zónát. |
| P2 · Baseline a scorecardon | Mutasd egymás mellett a Monk és az `open + k×ATR` eredményét, azonos adatokon és azonos mérőszámokkal. |
| P3 · Új hipotézisek | Csak előre rögzített hipotézissel tesztelj új bemeneteket, pl. overnight gapet vagy az első 30 perc range-ét. |

**Végső döntés: KEEP + IMPROVE + FORWARD TEST** — tartsd meg session-context és range-referencia eszköznek; önálló LONG/SHORT jelként ne használd, amíg nincs költségek utáni, NAS100-specifikus és forward validáció.

**Forward log sor — saját javaslat, nem a forrásból** (a P1 mezői + a tényleges értékek az értékeléshez; napi egy sor):
```
datum;ido;verzio;nyitoar;high_forecast;low_forecast;close_forecast;high_tenyleges;low_tenyleges;close_tenyleges
```

## Why it works / gotchas — 5 dolog, amit érdemes megjegyezni
1. **Range nem irány** — a várható mozgásméret nem mondja meg, LONG vagy SHORT legyen a pozíció.
2. **Baseline nélkül nincs többletérték** — mindig hasonlítsd az összetett modellt egyszerű ATR-szabályhoz.
3. **Backtest ≠ forward** — a múltbeli eredmény nem bizonyít jövőbeli teljesítményt.
4. **Költségek számítanak** — a spread és slippage eltüntetheti a kicsi statisztikai előnyt.
5. **Ne optimalizálj a tesztmintára** — fagyaszd be a verziót, naplózz előre, majd értékelj.

Áttekintés: `mgf-monk-v51-overview`. Bizonyítékok: `mgf-monk-v51-evidence`. Ábra: `excalidraw/mgf-monk-v51-next-steps.excalidraw`.
