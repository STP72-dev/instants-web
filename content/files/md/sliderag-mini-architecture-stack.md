---
title: SlideRAG-mini — Architektúra és technológiai stack
tags: [sliderag-mini, architecture, fastapi, langgraph, chroma]
source: "SlideRAG-mini @aea4579 (docs/.prepare/execution-plan.md, decision-log.md) + GitHub issues #2, #11, olvasva 2026-11-04"
created: 2026-11-04
---

# SlideRAG-mini — Architektúra és technológiai stack

> Jóváhagyott terv (EXEC-01, 2026-11-03) — nem igazolt működés. A `main` ágon még nincs alkalmazáskód.

## Problem
Egy pillantással látni, mi fut majd a SlideRAG-mini egyetlen Python-folyamatában, mi megy ki külső hívásként az OpenAI felé, és hol él a tartós index.

## Instant solution
**Alak (terv):** egy non-root Docker-konténer, benne egy Python 3.12 folyamat / worker, amely egyetlen adatgyökeret birtokol. Négy lapos modul: `app/main.py`, `app/ingestion.py`, `app/rag.py`, `app/config.py`; nincs repository-réteg, provider factory vagy event bus ([EXEC-01 §3](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L31)).

| Komponens | Szerep (terv) | Hol fut | Forrás |
|---|---|---|---|
| Python 3.12 | nyelv; egy folyamat = egy adatgyökér | folyamaton belül | [EXEC-01 L26](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L26), [L42](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L42); DL D-19 |
| FastAPI + Uvicorn, Jinja2 / plain CSS | route-ok, health, szerveroldali HTML, hibakódok (409/502/503) | folyamaton belül | [EXEC-01 L35](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L35), L75 |
| python-pptx | diánkénti szövegkinyerés: szövegdobozok, táblacellák, csoportok; jegyzet nem | folyamaton belül | [EXEC-01 L26](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L26), [L52](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L52) |
| LangChain | splitter (~1 000 karakter / 150 átfedés), Documents, Chroma-integráció | folyamaton belül | [EXEC-01 L54](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L54); DL P-03 |
| LangGraph (minimális) | egyszer fordított gráf, injektált függőségekkel (lásd lent) | folyamaton belül | [EXEC-01 L65](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L65) |
| OpenAI `text-embedding-3-small` | beágyazás indexeléskor és kérdéskor | külső hívás | [EXEC-01 L27](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L27); DL P-04 |
| OpenAI `gpt-4.1-mini` | válasz natív strukturált kimenettel `{answer, cited, insufficient}` | külső hívás | [EXEC-01 L27](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L27), [L69](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L69) |
| Chroma (perzisztens, cosine) | beágyazott vektortár; egy aktív kollekció indexkonfigurációnként | folyamaton belül → tartós tár (`chroma/`) | [EXEC-01 L44](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L44) |
| `DATA_DIR` | az egyetlen tárolási beállítás: `/data` → `uploads/`, `chroma/`, `manifest.json`; nincs külön `CHROMA_PATH` | tartós tár | [EXEC-01 L42](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L42) |
| Docker on EC2 | egy non-root konténer, `unless-stopped`; t3.small, eu-central-1; EBS gp3 `/var/lib/sliderag` → `/data`; port csak `127.0.0.1:8000`, elérés SSH tunnelen | host + tartós tár (EBS) | [EXEC-01 L91](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L91); [DL P-07](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/decision-log.md#L62) |

**A LangGraph-gráf (terv):** a `retrieve` csomópont írja az evidence-állapotot, a feltételes él csak irányít.
```text
retrieve → evidence? → generate_answer | no_evidence
```

**Verziók: még egy sincs rögzítve.** A lockolt Python 3.12 függőségek az M1 kimenete ([EXEC-01 L123](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L123)); a [#11](https://github.com/w7-mgfcode/SlideRAG-mini/issues/11) kéri a tényleges könyvtárverziók rögzítését.

## Why it works / gotchas
- **Az index identitása a teljes konfiguráció**, nem egy név: sémaverzió, embedding-modell, nem titkos endpoint-azonosító, dimenzió, cosine, extractor/chunking-verzió. Eltérésnél az adat megmarad, upload/ask 503 ([EXEC-01 L44–46](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L44-L46)).
- **Titok csak env-ben:** `OPENAI_API_KEY` a checkouton és az image-en kívül, és soha nem kerül az indexkonfigurációba (EXEC-01 L44, L91).
- **Szándékosan szűk:** nincs reranking, második modellszolgáltató vagy JS frontend (EXEC-01 L28). A modellek elérhetősége a projektfiókban az M1-ben igazolandó (L27).
- Folyamat lépésenként: `sliderag-mini-upload-citation-flow`. Perzisztencia-ellenőrzés: `sliderag-mini-release-gate-verification`.

Ábra: `excalidraw/sliderag-mini-architecture-stack.excalidraw` — operátor böngésző → SSH tunnel (`127.0.0.1:8000`) → EC2 t3.small → egy non-root konténer egyetlen Python 3.12 folyamattal; külső hívás csak az OpenAI API felé, tár: `DATA_DIR` → `/data` az EBS-ről. Forrás: [EXEC-01 §3](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L31).
