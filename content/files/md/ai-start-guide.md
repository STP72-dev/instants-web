---
title: AI-indulási útmutató — modellválasztás, effort, dokumentáció, secrets
tags: [ai, onboarding, model-routing, workflow, determinism]
source: heti mentorálós chat, 2026-10-08 (bulk export, feldolgozva; titkok eltávolítva)
---

# AI-indulási útmutató — modellválasztás, effort, dokumentáció, secrets

> Forrás: egyetlen chat-export. Minden állítás **a beszélő állítása** (tapasztalt mentor → kezdő barát), nem ellenőrzött tény.
> `verify:` = bizonytalan vagy leegyszerűsített állítás, az eredeti megfogalmazás megtartva.
> `editor note` = a szerkesztő megjegyzése, nem a beszélőé.
> Modellnevek és linkek **as given, unverified**.

## 1. Összefoglaló

- Napi és heti **token limitek** vannak; nem kell nézegetni vagy számolgatni őket.
- Ha a limit betelik, de még van munka, a mentor ad **másik kulcsot**.
- Három modellszint van (olcsó/default → közepes/tervező → nehéz/long-run), mindegyikhez más **effort**.
- Az **effort** = a modell reasoningje; magasabb effort → jobb, de drágább.
- Ahol lehet, **determinisztikus** workflow a cél: a futás közben keletkező `plan.md` / `state.md` / JSON / log már megbízható igazolás, így elég egy default modell.
- A dokumentáció rövid (**300–450 sor**), szétosztva és indexelve; csak **valós, hiteles** információ kerülhet bele.
- **Titkot (kulcs, jelszó) soha nem adunk meg modellnek** vagy ilyen chat-sessionben.

## 2. Indulási sorrend (lépésről lépésre)

1. Kulcs átvétele a mentortól (lásd 7. fejezet), a modell **nélkül**.
2. Opcionálisan a harness telepítése: `https://github.com/deepseek-ai/deepseek-harness` (as given, unverified).
3. Provider: **"google"** alapú — **nem** Google Vertex.
4. Alapértelmezett modell a legolcsóbb szint (lásd 3. fejezet).
5. **Vadonatúj projekt**: először a **minimál repo → rules → workflow** sorrend.
6. A projekt összerakásához a beszélő a `latest-model` oldalt ajánlja **effort max**-szal (`https://aistudio.google.com/docs/latest-model`, as given, unverified) — utána modellt cserélni kell, mert nagyon gyorsan fogyasztja a keretet.
7. A harness néhány eszközt nem ismer csak a harnessből; **1–2 piros warning** normális.

## 3. Modell-routing (a beszélő szavai szerint)

Provider: `"google"`.

| Szint | Modell (as given, unverified) | Mire | Effort |
|---|---|---|---|
| a) default | `gemini-3.1-flash-lite` | mindenre / default; már összerakott, egyszerűbb futások; research és előkészítő összegyűjtés | mid vagy high |
| b) tervező | `gemini-3.8-flash` | előre preparált dolgok, artifactok; **PLAN + DECOMPOSE** complexity szerint → taskok vagy workflow-k | mid vagy high; alap feladatnál medium, összetettebbnél high; **tervezésnél/architectnél mindig high** |
| c) nehéz | `gemini-3.1-pro-preview` | nagyon nagy komplexitás, long-run feladat, refaktor-terv előkészítés, sok aktív blokkoló az issue-ban vagy fejlesztési ötletben | **mindig high** |

- A `gemini-3.1-flash-lite` "kényelmesen belefér", sokáig kell hajszolni, hogy kilimitálja magát.
- A `gemini-3.1-pro-preview` **nagyon token-heavy**: 1–1 futás után **le kell cserélni**.
- Más szóhasználat a chatben: "mid" és "medium" — valószínűleg ugyanaz. `editor note:` a chat nem definiálja.

Lásd a diagramot: `mermaid/ai-model-routing.mmd`.

## 4. Az effort értelmezése

A beszélő magyarázata (eredeti szándék szerint): az effort a modell **reasoningje**. Minél magasabb a szint, annál többször futtatja le ugyanazt a scope-ot a modell; ettől lesz jobb az eredmény, mert egy LLM ritkán ad kétszer pontosan ugyanazt a választ, és több változatból pontosabbat tud adni, illetve ki tud zárni lehetőségeket.

`verify:` ez egyszerűsített mentális modell. A gyakorlatban az effort általában a reasoning/gondolkodási keret mértékét állítja, nem szó szerinti többszöri lefuttatást — ellenőrizd a használt provider dokumentációjában.

Gyakorlati szabály a beszélőtől: gyengébb modellnél, hosszú dokumentumnál **magas effort** kell (lásd 5. fejezet).

## 5. Dokumentáció és determinizmus

**Példa a beszélőtől** — egy fejlesztési session több workflow-körön át sikeresen lefutott, az eredmény jó:

1. Folyamatos, könnyű továbbhaladáshoz és a növekvő repo miatt a **dokumentálás kiemelten fontos**.
2. Egy előre lefektetett **GLOBAL-RULE** szerint vagy pl. CI-jal kikényszerítve sok dokumentumot kell frissíteni.
3. A frissített információnak **valid, hiteles, jó** kell lennie. Ha a modell kitalálta vagy "odagondolta", akkor a következő futásoknál **minden deployolt agentic session erre alapoz**, amíg ki nem szűrjük.
4. **Meglepő tanulság:** logikusnak tűnik ide erős modell + magas effort — **de nem erre van szükség**.

**Elv:** törekedni kell a **determinisztikus** megoldásokra és folyamatokra.
- A workflow úgy van megtervezve, hogy a közben készülő `plan.md`, `state.md`, JSON vagy log már **releváns, tisztított, core szintű igazolás**.
- Így elég egy **default modell**; az effort attól függ, mekkora a dokumentum.
- A beszélő a dokumentációt lehetőleg **300–450 sornál nem hosszabbra** hagyja; inkább **szétosztja és indexeli**, körbehivatkozva. Az LLM ezt jobban érti, az ember pedig szükség esetén ki tudja bogozni.
- Egy hosszú doksinál (a példában 1300 sor) gyengébb modellnél **magas effort** kell, különben elfelejti vagy szabadon kezeli a tartalmat már az első ~350 sor után.

**Determinisztikus (IT-releváns definíció, a beszélőtől):** ugyanabból a bemenetből és kezdőállapotból a rendszer mindig pontosan ugyanazt a kimenetet vagy eredményt hozza létre, teljesen kizárva a véletlenszerűséget → algoritmusok, alapvetések.

Lásd a diagramot: `mermaid/ai-doc-update-loop.mmd`.

## 6. Providerek és routing szolgáltatások

**OpenRouter** — `https://openrouter.ai/` (as given, unverified)
- Gyakran lehet itt **ingyenes jó modelleket** "mazsolázni" adott időszakokban, vagy új bevezetéseket kipróbálni.
- A beszélő szerint a deepseek desktop harness **natívan támogatja** az OpenRouter modell-routingot.
- Itt kell API kulcsot csinálni; a Google-nél küldött model card mintájára itt is minden modellhez van oldal, ami alapján specifikusan beköthető.
- A beszélő szerint talán itt a legolcsóbb, ha fizetős modelleket akarsz próbálni — **kivéve a frontier modelleket**.

**DeepSeek natív modellek**
- A beszélő szerint jókat mondanak róluk; ő csak egyet használ belőlük, régóta, főleg **fordításra**.
- Token alapon (cost) nagyon olcsók, ha ki akarod próbálni.

## 7. Titkok kezelése (secrets hygiene)

- A kulcs átadása **egyszer használatos titkos linken** történik; a hozzá tartozó jelszót a mentor **külön** küldte: [REDACTED].
- **Soha ne add meg és ne írd be** a kulcsot, jelszót modellnek vagy ilyen chat-sessionbe — gyorsan kiszivárog, és "behappolják" (a beszélő szavai).
- Ha véletlenül mégis megtörtént: **szólj** a mentornak, aki gyorsan törli a kulcsot és csinál egy újat.

Lásd a diagramot: `mermaid/ai-secrets-flow.mmd`.

## 8. Általános onboarding-checklist (másik barát segítéséhez)

Csak a chatben elhangzottakból:

1. Kulcs átadása egyszer használatos linken, a jelszó külön csatornán.
2. Mondd el: titkot soha nem írunk modellnek; ha mégis, azonnal szólni.
3. (Opcionális) harness telepítése; előre jelezd, hogy 1–2 piros warning normális.
4. Provider kiválasztása: `"google"` (nem Vertex) vagy OpenRouter.
5. Alapértelmezett modell: a legolcsóbb szint; effort mid vagy high.
6. Új projekt sorrend: minimál repo → rules → workflow.
7. Tervezéshez/architekturához a középső szint, effort mindig high.
8. Nehéz, long-run feladathoz a pro szint, effort high, és 1–1 futás után csere.
9. Dokumentáció: max 300–450 sor/fájl, szétosztva és indexelve; csak ellenőrzött információ.
10. Ha betelik a limit, de van még munka: kérj másik kulcsot.

## 9. Nyitott kérdések és hiányok

- Mit jelent a chatben a `+r`? `[UNCLEAR]`
- A `latest-model` oldal ugyanaz-e, mint a `gemini-3.1-pro-preview`? `[UNCLEAR]` (a chat nem mondja ki).
- Mely eszközöket nem ismeri a harness, és melyik warning ártalmatlan? `[UNCLEAR]`
- Nincs telepítési/konfigurációs lépéssor a harnesshez.
- Hogyan mérik a napi/heti limitet pontosan, és mennyi egy kulcs kerete? `[UNCLEAR]`
- Mi az a CI-kikényszerítés konkrétan (milyen szabály, milyen eszköz)? `[UNCLEAR]`
- Melyik DeepSeek natív modellt használja a beszélő fordításra? `[UNCLEAR]`
- A "mid" és a "medium" ugyanaz-e? `[UNCLEAR]`
