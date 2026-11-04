---
title: SlideRAG-mini — Feltöltéstől a diahivatkozásig
tags: [sliderag-mini, rag, citations, python-pptx]
source: "SlideRAG-mini @aea4579 (docs/.prepare/execution-plan.md, brainstorm-plan.md) + GitHub issues #12, #13, olvasva 2026-11-04"
created: 2026-11-04
---

# SlideRAG-mini — Feltöltéstől a diahivatkozásig

> Jóváhagyott terv (EXEC-01, 2026-11-03), nem igazolt működés: 2026-11-04-én a `main` (`aea4579`) csak dokumentációt tartalmaz.

## Problem
Hogyan jut el a tervezett SlideRAG-mini egy feltöltött `.pptx`-től az ellenőrzött diahivatkozásos válaszig, és mikor ad inkább rögzített „nincs elég forrás” választ?

## Instant solution
**Tervezett lépések** ([EXEC-01 §4–5](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L48)):
1. **Feltöltés:** egy fájl, ≤ 10 MiB (10 485 760 byte), a kérés legfeljebb fájl + 64 KiB; ZIP ≤ 100 MiB kicsomagolva, ≤ 2 000 tag, ≤ 200 dia. A fájl SHA-256 hash-t kap egy ideiglenes fájlban (L51, L81–84).
2. **Diánkénti szövegkinyerés** `python-pptx`-szel: szövegdobozok, táblázatcellák, támogatott csoportok, megőrzött diaszám. Jegyzet és csak vizuális tartalom nincs; üres szöveg → elutasítás (L52).
3. **Darabolás:** diahatáron belül kb. 1 000 karakter, 150 átfedés; metaadat `source_file`, `slide_number`, `file_sha256`, `chunk_index`, determinisztikus chunk ID (L54).
4. **Indexelés:** embedding + Chroma upsert → az ideiglenes upload átnevezése → atomikus `manifest.json`-csere (temp fájl, fsync, replace). Csak kész dokumentum kerül be (L55).
5. **Retrieval:** legfeljebb k = 5 chunk távolsággal. Üres találat → fallback; opcionális T küszöb: `best_distance > T` → fallback, egyenlőség átmegy, `T=None` kikapcsolja (L65–66).
6. **Strukturált generálás:** natív séma `{answer, cited, insufficient}`; a dokumentum szövege nem megbízható adat (L69–70).
7. **Hivatkozás-ellenőrzés (C1):** kérésenkénti `S1…Sk` címkék; csak validált, idézett forrás jelenik meg, megjelenített ⊆ visszakeresett (QG-06). Nincs érvényes hivatkozás → fallback (L71).

**Duplikált feltöltés:** ha ugyanaz a hash már kész egy egészséges indexben, a meglévő rekord jön vissza: nincs új embedding, nem nő a chunk-szám (L53; QG-03, L102). Nem csere és nem hiba.

### Illusztratív példa, a tervezett demó alapján (a)
Kérdés: „Mekkora volt a csúcs-latencia az INC-042 alatt?” → várt válasz: **46 ms**, forrás: `5G_RAN_Operations_Demo.pptx`, **4. dia** (a demó 4. diája: baseline 18 ms, csúcs 46 ms; [brainstorm-plan L379, L390](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/brainstorm-plan.md#L379)).

### Illusztratív példa, a tervezett demó alapján (b)
Kérdés a hálózat valódi, aktuális üzemzavar-állapotáról → a szintetikus deckben nincs ilyen bizonyíték, ezért a rögzített fallback jön ([L73](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L73)):

> I couldn't find sufficient information in the uploaded presentations to answer that question. Please upload a relevant document or ask about the indexed material.

Magyarul: a feltöltött prezentációkban nincs elég információ a válaszhoz; tölts fel releváns dokumentumot, vagy az indexelt anyagról kérdezz. A szöveg szó szerint rögzített, angolul marad.

**Hibák ≠ fallback** (L50, L75): **409** foglalt (fut egy feltöltés), **502** szolgáltató időtúllépés/hiba, **503** degradált állapot (hiányzó kulcs vagy inkonzisztens adat).

## Why it works / gotchas
- **Hivatkozás = eredet, nem igazság.** A C1 csak azt bizonyítja, hogy a forrás a visszakeresettek közül való; a tartalmi alátámasztást kézzel kell nézni (L72).
- **T-t nem az elfogadási kérdésekre kalibrálják**, hanem külön támogatott és közeli, nem támogatott próbákra; átfedés esetén T kikapcsolva marad (L67–68).
- **Öt fallback-ág:** üres retrieval, küszöb fölött, modell szerint kevés, hibás kimenet, nincs érvényes hivatkozás. A hibás kimenet zárva bukik, de nem számít sikeres elutasításnak (L74).
- Előzmény: `sliderag-mini-architecture-stack`. Ellenőrzés: `sliderag-mini-release-gate-verification`.

Ábra: `excalidraw/sliderag-mini-upload-citation-flow.excalidraw` — a feltöltési sáv (limitek, SHA-256, duplikátum, kinyerés, darabolás, embedding, manifest) és a kérdés-sáv két kimenettel: zöld = válasz validált diaforrással, piros = rögzített fallback; mellette a 409/502/503 jegyzet. Forrás: [EXEC-01 §4–5](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L48).
