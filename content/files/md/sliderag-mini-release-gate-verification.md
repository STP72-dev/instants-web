---
title: SlideRAG-mini — Mit kell igazolni a kiadás előtt?
tags: [sliderag-mini, release-gate, testing, aws-ec2]
source: "SlideRAG-mini @aea4579 (docs/.prepare/execution-plan.md, decision-log.md) + GitHub issues #11–#15, olvasva 2026-11-04"
created: 2026-11-04
---

# SlideRAG-mini — Mit kell igazolni a kiadás előtt?

> Jóváhagyott terv (EXEC-01, 2026-11-03), nem igazolt működés. 2026-11-04-én **minden pont kipipálatlan**: nincs kód, teszt, CI-futás, tag vagy release.

## Problem
Mit kell bizonyítani a SlideRAG-mini v0.1.0 kiadása előtt, és mi számít bizonyítéknak: melyik teszt, élő futás vagy kézi EC2-megfigyelés?

## Instant solution
**Kiadási kapu ([EXEC-01 §7](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L97)), tervezett bizonyítékkal** ([#11](https://github.com/w7-mgfcode/SlideRAG-mini/issues/11)–[#14](https://github.com/w7-mgfcode/SlideRAG-mini/issues/14)):
```markdown
- [ ] QG-01/02 deck-szöveg, diaszám, metaadat → `uv run pytest tests/test_ingestion.py -m "not integration"` (#12)
- [ ] QG-03 duplikátum: nincs új chunk, nincs új embedding → `tests/test_ingestion.py` (#12); EC2-n a QG-09 része
- [ ] QG-04 friss processz megnyitja ugyanazt a könyvtárat → `uv run pytest tests/test_rag.py -m "not integration"` (#11)
- [ ] QG-05 öt fix kérdés a várt diákat hozza → `uv run pytest -m integration` (#13)
- [ ] QG-06 / C1 megjelenített ⊆ visszakeresett, érvénytelen/üres hivatkozás → fallback → `tests/test_rag.py` (#12)
- [ ] QG-07 öt fallback-ág determinisztikus, pontos fallback-szöveggel → QG-07 tesztek (#13); élő nem támogatott kérdés csak küszöb/model-insufficient úton
- [ ] QG-08 hibás/túlméretes/traversal/ZIP-expansion bemenet biztonságosan bukik, HTML escape-elve → QG-08 tesztek (#13), `tests/test_main.py` (#12), élő injection-próba
- [ ] Konzisztencia: nincs részleges ingest olvasás, retry, degradált cleanup → offline tesztek (#13)
- [ ] Helyreállítás: hibás manifest, config-eltérés, hiányzó chunk → adat megmarad, művelet blokkolva → startup tesztek (#13)
- [ ] Route-ok: 409 foglalt, 503 degradált, 502 szolgáltatóhiba → route tesztek (#13)
- [ ] Élő szemantikus ellenőrzés + külön kalibrációs próbák → kézi `calibration-and-semantic-review` (#13)
- [ ] QG-09 EC2 konténer-újralétrehozás után: dokumentum/számok, válasz, elutasítás, dedup → kézi `ec2-recreation` (#14)
- [ ] Üzemi állítások: mount/boot, memória/latencia → `ec2-private-access`, `mount-boot-safety`, mintavételezett memória-maximum (#14)
```

**Kapu-parancsok sorrendben** (L115; #11): `uv run ruff check .` → `uv run ruff format --check .` → `uv run pytest -m "not integration"` (< 30 s). Az élő tesztek `integration`-jelölésűek, kulcs nélkül skip-elnek; élő és kézi bizonyíték külön rögzítendő.

**Kiadás lépései** ([#15](https://github.com/w7-mgfcode/SlideRAG-mini/issues/15)):
1. QG-09 bizonyíték átnézése; minden §7 pontnak legyen bizonyítéka, futásidejű ellenőrzés nem számít kétszer.
2. Review-zott PR: `pyproject.toml` 0.1.0 + datált `CHANGELOG.md`; squash-cím `release(repo): cut 0.1.0 (#issue)`.
3. Explicit tulajdonosi jóváhagyás és merge.
4. Annotált `v0.1.0` tag → GitHub release. Nincs automatikus release workflow.

### Mi marad meg EC2-n? (terv)
- **Konténer** (nem root, `unless-stopped`) → **`DATA_DIR=/data`** → bind mount az **EBS gp3** kötetről: host `/var/lib/sliderag` ([L42](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L42), [DL P-07](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/decision-log.md#L62)).
- **Megmarad:** `uploads/`, `chroma/`, `manifest.json`. **Nem marad meg:** a konténer fájlrendszere és a parser temp-tárhelye.
- **Újranyitás:** az új konténer ugyanazt a host-útvonalat mountolja `/data`-ra; induláskor összeveti a teljes index-konfigurációt (séma, embedding-modell, endpoint, dimenzió, cosine, kinyerő/darabolás verzió). Egyezik → a meglévő Chroma collection nyílik meg; eltér → az adat megmarad, upload/ask **503** (L44–46).

## Why it works / gotchas
- **Specifikáció ≠ kész.** „No item below is complete merely because its specification exists” (L99).
- **Hivatkozás ≠ igazság.** A QG-06 tagságot bizonyít, a tartalmi alátámasztás kézi ellenőrzés (L72).
- **Az EBS nem backup**, és sikertelen mount nem írhat a root diskre (L91, L95).
- Folyamat: `sliderag-mini-upload-citation-flow`. Mérföldkövek: `sliderag-mini-milestones-reference`.

Ábra: `excalidraw/sliderag-mini-release-gate-verification.excalidraw` — EC2 host EBS-kötettel (`/var/lib/sliderag`), régi A és új B konténer ugyanazzal a `/data` mounttal, induláskori identitás-ellenőrzés (egyezés → újranyitás, eltérés → 503), mi marad meg és a QG-09 ellenőrzések. Forrás: [EXEC-01 §3, §6–7](https://github.com/w7-mgfcode/SlideRAG-mini/blob/aea4579754802b57cdfe20d42d0b169692bdef79/docs/.prepare/execution-plan.md#L91).
