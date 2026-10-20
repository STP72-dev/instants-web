---
title: AI-indulás — egyoldalas puska
tags: [ai, cheatsheet, model-routing, onboarding]
source: "heti mentorálós chat, 2026-10-08 (teljes útmutató: md/ai-start-guide.md)"
---

# AI-indulás — egyoldalas puska

Minden adat a beszélő állítása, nem ellenőrzött. Modellnevek: as given, unverified.

## Modellek

| Mire | Modell | Effort |
|---|---|---|
| Default, egyszerű/kész futások, research, előkészítés | `gemini-3.1-flash-lite` | mid vagy high |
| Preparált artifactok, plan + decompose | `gemini-3.8-flash` | mid vagy high |
| Tervezés / architect | `gemini-3.8-flash` | mindig high |
| Nagyon komplex, long-run, refaktor-terv, sok blokkoló | `gemini-3.1-pro-preview` | mindig high |
| Új projekt összerakása | `latest-model` | max |

Provider: `"google"` (nem Vertex). Nehéz modell után **1–1 futás után csere** (token-heavy).

## Szabályok

| Téma | Szabály |
|---|---|
| Limit | Napi/heti token limit van; nem kell számolni. Betelik és van munka → új kulcsot kérni. |
| Új projekt | minimál repo → rules → workflow |
| Dokumentáció | max 300–450 sor/fájl; szétosztva, indexelve, körbehivatkozva |
| Információ | Csak valid, hiteles; a kitalált info minden következő futást megmérgez |
| Determinizmus | `plan.md` / `state.md` / JSON / log legyen igazolás → elég egy default modell |
| Hosszú doksi + gyenge modell | magas effort kell |
| Titkok | Soha ne írd modellnek / chatbe. Kiszivárgás → azonnal szólni, kulcscsere |
| Harness | 1–2 piros warning normális; néhány eszközt csak a harnessből ismer |

## Providerek

| Hely | Mire |
|---|---|
| OpenRouter | ingyenes jó modellek időszakosan; modellenként beköthető; fizetősnél talán a legolcsóbb (kivéve frontier) |
| DeepSeek natív | olcsó tokenár; a beszélő fordításra használja |

## Definíció

**Determinisztikus:** ugyanabból a bemenetből és kezdőállapotból mindig pontosan ugyanaz a kimenet, véletlenszerűség nélkül.
