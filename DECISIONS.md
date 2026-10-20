# Decisions

Every non-trivial technical or design choice goes through the decision protocol:
Codex brainstorm (3–5 options) → lead shortlists 2–3 → Codex prepare / research / critique / rank → lead adopts or overrides with a reason.
Codex output is advice; the lead engineer owns every decision.

Rubric (score 1–5 per criterion, weighted total /100):
fit to goal 25 · design/UX 20 · simplicity/maintainability 20 · docker compose + Vercel 15 · risk/reversibility 10 · effort 10.

Codex sessions: HERDR workspace `IWEB`, tab `IWEB__DECIDE__CODEX__ARCH__01` (codex-cli 0.163.0, model gpt-5.6-terra, read-only sandbox).

---

## D0 — Branch protection on a private GitHub Free repo (2026-10-20)

- **Question:** Protect `main` with a ruleset (PR required, `ci` check required, linear history, no force push / deletion, 0 approvals, squash only).
- **Result:** `POST /repos/w7-mgfcode/instants-web/rulesets` and `PUT .../branches/main/protection` both returned
  `HTTP 403 — Upgrade to GitHub Pro or make this repository public to enable this feature.`
- **Choice:** Follow the identical rules by discipline: nothing is pushed to `main` after the initial commit; every change lands via a squash-merged PR
  after the `ci` check passes. Repo settings that *are* available were applied: squash merge only, auto-delete head branches.
  The intended ruleset is stored in `.github/ruleset-main.json` for one-command enforcement later.
- **Blocked on owner:** #18 (make public or upgrade to Pro, then apply the ruleset). Not a protocol decision (no options to rank).

## D0b — PROGRESS.md under "no direct pushes to main" (2026-10-20)

- **Choice:** Each PR updates `PROGRESS.md` to the state *after* that PR merges, so `main` always carries a resumable status file without direct pushes.
  Lead decision, not protocol-worthy (process detail, trivially reversible).

## D1 — Site framework and rendering model (2026-10-20)

| Option | Fit 25 | UX 20 | Simplicity 20 | Docker+Vercel 15 | Risk 10 | Effort 10 | Total |
|---|---|---|---|---|---|---|---|
| **A Astro static + islands** | 5 static-first by default | 5 HTML-first, selective JS | 4 minor multi-framework edge | 5 plain `dist/` everywhere | 4 mature, reversible | 4 direct | **92** |
| B Eleventy + PE JS | 4 | 4 enhancements are manual | 3 more bespoke browser code | 5 | 5 minimal lock-in | 3 more plumbing | 79 |
| C Next.js `output: "export"` | 3 over-capable | 4 | 3 export constraints | 5 | 3 drifts into server features | 3 heavier | 70 |

- **Choice:** A — Astro 7 (`output: 'static'`). Islands are plain Astro `<script>` modules; React is used *only* for the lazy Excalidraw viewer
  (Preact dropped to keep one fewer UI model — within option A's scope).
- **Reason:** Highest score; one static `dist/` serves both targets. Versions verified on npm 2026-10-20: astro 7.4.1, node ≥ 22.22.
- **Note:** TypeScript pinned to 6.0.x because typescript-eslint 8.72 and @astrojs/check 0.9.11 do not accept TS 7.

## D2 — Diagram rendering (2026-10-20)

| Option | Fit 25 | UX 20 | Simplicity 20 | Docker+Vercel 15 | Risk 10 | Effort 10 | Total |
|---|---|---|---|---|---|---|---|
| A Excalidraw interactive by default, PNG fallback | 5 | 4 rich but heavy | 3 viewer everywhere | 5 | 3 large bundle/fonts | 3 | 80 |
| **B PNG-first; client `exportToSvg` when PNG missing; interactive on demand** | 4 every availability case | 4 quickest common path | 4 layered fallback | 5 browser-free build | 4 stale state disclosed | 4 bounded | **83** |
| C Always client SVG; interactive on demand | 5 | 4 slower first paint | 3 | 5 | 3 | 3 | 80 |

- **Choice:** B. Mermaid is always rendered live in the browser (mermaid 12, lazy, `startOnLoad: false`, `securityLevel: 'strict'`), with the source
  shown on error. Excalidraw shows the export PNG labelled "export preview" when one exists; otherwise renders SVG client-side with `exportToSvg`;
  an "Open interactive canvas" button lazy-loads the read-only `@excalidraw/excalidraw` 0.18.1 viewer.
- **Reason:** Highest score; no headless browser in any build; satisfies "Mermaid rendered live" and "Excalidraw interactive or PNG", and covers
  missing PNGs without running INSTANTS export scripts.
- **Critique accepted:** PNGs can be stale → always label them and keep the live canvas one click away.

## D3 — Search and tag filtering (2026-10-20)

| Option | Fit 25 | UX 20 | Simplicity 20 | Docker+Vercel 15 | Risk 10 | Effort 10 | Total |
|---|---|---|---|---|---|---|---|
| **A MiniSearch over a build-generated compact index** | 5 manifest + facets map exactly | 4 custom UI | 5 one small index | 5 pure static | 5 easy to replace | 5 small | **96** |
| B Pagefind with filters | 5 | 5 mature ranking | 4 extra build step | 5 | 4 binary dependency | 4 | 92 |

- **Choice:** A — MiniSearch 7.2; index of title, tags, topic, track, excerpt/body text emitted as a static JSON at build time; tag/topic filters
  are deterministic client facets, state in the URL (`?q=&tag=&topic=`).
- **Reason:** Small, structured, slowly growing corpus; full control. Revisit Pagefind if full-body search becomes the main discovery mode.

## D4 — Docker and Vercel deploy layout (2026-10-20)

| Option | Fit 25 | UX 20 | Simplicity 20 | Docker+Vercel 15 | Risk 10 | Effort 10 | Total |
|---|---|---|---|---|---|---|---|
| **A node build → nginx; hand-written Vercel Build Output v3 + `vercel deploy --prebuilt`** | 5 one artifact | 4 | 4 small script | 5 exact parity | 4 narrow v3 contract | 4 | **88** |
| B node build → nginx; `vercel pull` + `vercel build` + `--prebuilt` | 4 | 4 | 3 two build paths | 5 | 4 | 3 | 77 |
| C node build → Caddy; manual v3 output | 5 | 4 | 3 less familiar | 5 | 4 | 4 | 84 |

- **Choice:** A. Multi-stage Dockerfile (node:24-alpine build → nginx unprivileged on :8080). Release workflow builds `dist/` once, packages it into
  the GHCR image, copies it to `.vercel/output/static` with `config.json {"version":3}`, and runs `vercel deploy --prebuilt`, skipping with an
  explicit log line when any of `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` is missing. Topic zips are produced at build time.
- **Reason:** Single build artifact for both hosts; no server code.
- Sources (Codex research): https://vercel.com/docs/build-output-api , https://vercel.com/docs/build-output-api/configuration ,
  https://vercel.com/docs/cli/deploying-from-cli

## D5 — Styling and design system (2026-10-20)

| Option | Fit 25 | UX 20 | Simplicity 20 | Docker+Vercel 15 | Risk 10 | Effort 10 | Total |
|---|---|---|---|---|---|---|---|
| **A Token-led plain CSS custom properties + component-scoped Astro styles** | 5 editorial design first-class | 5 precise type/motion | 5 small, inspectable | 5 | 5 no lock-in | 4 needs discipline | **98** |
| B Tailwind v4 + semantic token layer | 4 utility-oriented | 4 | 4 | 5 | 4 | 4 | 83 |

- **Choice:** A. Near-black base, warm high-contrast text, one accent per topic family (music amber, technical cyan, AI violet, INSTANTS/forecast mint),
  accent never the only signal; self-hosted open-licensed variable fonts; motion = opacity/transform only, 120–180 ms, disabled under
  `prefers-reduced-motion`. Concrete font pairing is finalised in the design-system issue (#3) after screenshots.

## D6 — Content snapshot layout and manifest schema (2026-10-20)

| Option | Fit 25 | UX 20 | Simplicity 20 | Docker+Vercel 15 | Risk 10 | Effort 10 | Total |
|---|---|---|---|---|---|---|---|
| **A One canonical `manifest.json` + `files/` + `exports/`** | 5 matches a small static library | 4 no visible UX downside | 5 one contract, one validation boundary | 5 one directory everywhere | 5 easy rollback/inspection | 5 smallest surface | **96** |
| B Index + per-topic + per-entry manifests | 4 over-normalised | 4 | 3 cross-file consistency | 5 | 3 stale-reference failure modes | 3 | 75 |
| C Astro content collections with generated Zod records | 3 multi-format entries fit badly | 4 | 3 Astro-coupled layer | 4 | 3 framework coupling | 2 proxy-content modelling | 65 |

- **Choice:** A. Layout: `content/manifest.json`, `content/files/<md|mermaid|excalidraw>/<slug>.<ext>`, `content/exports/<format>/<slug>.<png|pdf>`.
  Schema: `src/lib/manifest.ts` (`schemaVersion: 1`). Public URL of a snapshot file = `/<path>`.
- **Derivation (no hand lists):** topic = longest name prefix that is also one of the entry's tags → else longest prefix learned from tagged entries →
  else first segment. Topic kind = `music` when any entry is tagged `music`/`track-dna`. Music tracks = tails ending in `-overview`/`-sound-dna`;
  roles overview → sound-dna → variant (`suno-*`) → workflow (`*-workflow`); tracks then topic-level entries. Technical guided path by name tokens:
  overview → concept → practice → reference → detail.
- **Determinism:** no wall-clock values; source identity = INSTANTS git commit + commit time + dirty flag; locale-independent sort; atomic temp-dir swap.
  Export freshness = export mtime ≥ source mtime.
- **Deviation from Codex sketch:** format keys mirror INSTANTS directory names (`md`, `mermaid`, `excalidraw`); no per-file git SHAs (exports in
  `out/` are git-ignored, so mtime comparison is the only signal); topic-level `tags` added for hub styling.

## URL contract (part of D6)
`/` · `/topics/<topic>/` · `/entries/<slug>/` · `/search/` + `/search-index.json` · `/files/<format>/<slug>.<ext>` · `/exports/<format>/<slug>.<png|pdf>` ·
`/downloads/<topic>.zip` · `/_astro/*`. Content types: `.md` text/markdown, `.mmd` text/plain, `.excalidraw` application/vnd.excalidraw+json,
`.png` image/png, `.pdf` application/pdf, `.zip` application/zip (all text types `charset=utf-8`).
