# INSTANTS Web

A dark, browsable library for the **INSTANTS** knowledge bank: topics, entries, live diagrams and downloads in every format an entry exists in
(Markdown, Mermaid, Excalidraw, PNG, PDF), plus a zip per topic and full-text search with tag filters.

- Static site ([Astro](https://astro.build) 7) built from a **committed content snapshot** in `content/`.
- One build output serves both targets: **Docker** (nginx on `:8080`) and **Vercel** (prebuilt Build Output API v3).
- Architecture decisions and their scoring: [`DECISIONS.md`](DECISIONS.md). Live status and the resume point: [`PROGRESS.md`](PROGRESS.md).

## Run it locally

### With Docker (no Node needed)

```bash
docker compose up --build
# → http://localhost:8080
```

Port 8080 busy? `WEB_PORT=18080 docker compose up --build` publishes on another host port (the container still listens on 8080).
The image builds the site from the files in this repo only; it never needs the INSTANTS folder.

### With Node (for development)

Requires Node ≥ 22.22 (see `.nvmrc`, CI uses 24).

```bash
npm ci
npm run dev          # http://localhost:4321 with hot reload
npm run build        # static output in dist/
npm run preview      # serve dist/
```

## Refresh content from INSTANTS

INSTANTS (`/home/w7-loqker/w7-workspace/selfbase/knowledge/INSTANTS`) is **read-only** for this project. The ingest script copies it into
`content/` and nothing ever writes back.

```bash
git switch -c chore/<issue>-content-refresh
npm run ingest                                   # or: INSTANTS_DIR=/path/to/INSTANTS npm run ingest
git diff --stat content/                         # review what changed
npm test && npm run build
git add content && git commit -m "chore(content): refresh snapshot from INSTANTS <short-sha>"
```

What ingest does (details in DECISIONS.md D6):

- validates metadata (`.md` frontmatter `title`/`tags`/`source`, `.mmd` `%% title:`/`%% tags:`/`%% source:` header, `.excalidraw` JSON) and
  **fails loudly**, listing every malformed entry;
- groups formats by base name and derives topics, music tracks, roles and reading order from names and tags (no hand-maintained lists);
- copies sources and any PNG/PDF exports found in `INSTANTS/out/`, and lists the exports that are missing (it never runs the INSTANTS export
  scripts — export there, then re-ingest);
- **secret-scans** every file; a hit leaves the file (and its exports) out and is printed so it can be reviewed by hand;
- writes `content/manifest.json`; the output is deterministic for the same input files.

## Verify

```bash
npm run ci                               # lint + typecheck + unit tests + build (what CI runs)
npm run scan:diff                        # secret scan of every commit on your branch vs origin/main
scripts/verify-site.sh http://localhost:8080
                                         # release smoke test: home, hubs, an entry per format, one download per file type,
                                         # search index, thumbnails, zip Content-Disposition and the 404 page
scripts/smoke.sh http://localhost:8080   # the underlying status + content-type checker (add "path|type" arguments)
npm run screenshots -- http://localhost:4321 docs/screenshots/<name> / /topics/nonconformist/
                                         # 1440 / 390 / 360 px full-page shots; exits 1 on horizontal overflow
```

## Branches, commits and pull requests

`main` is always deployable. Nothing is pushed to `main` directly; every change lands through a squash-merged PR.

1. Open (or pick) an issue. One branch per issue: `<type>/<issue>-<short-slug>` with type `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`,
   `test` or `design` — e.g. `feat/12-topic-hub-page`.
2. Commit with Conventional Commits: `<type>(<scope>): <imperative summary>`, scope one of `ingest`, `ui`, `content`, `docker`, `ci`,
   `deploy`, `docs`.
3. Run `npm run ci` and `npm run scan:diff`, push, and open a PR. The template asks for `Closes #<n>`, what changed, how it was verified,
   and screenshots for UI changes.
4. CI (`.github/workflows/ci.yml`, check name `ci`) must pass: secret scan of the PR's commits, lint, typecheck, tests, build.
5. Review, then **squash merge**; the branch is deleted automatically.

The intended branch protection lives in `.github/ruleset-main.json`. GitHub Free does not enforce rulesets on private repositories, so the
rules are followed by discipline until the repo is public or on Pro (issue #18).

## Cut a release

1. Make sure `main` is green and every issue of the milestone is closed.
2. Create the release (this creates the tag and triggers `.github/workflows/release.yml`):
   ```bash
   gh release create v0.1.0 --target main --generate-notes
   ```
3. The release workflow builds the Docker image once, pushes it to `ghcr.io/w7-mgfcode/instants-web`
   (`0.1.0`, `0.1`, `sha-…`, `latest`), extracts the static site from that image and deploys it to Vercel with `vercel deploy --prebuilt`.
   Without the `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets the Vercel step is skipped with a log line (issue #17).

Details, re-runs and the nginx/Vercel parity notes: [`docs/release.md`](docs/release.md).

## Layout

```
content/            committed snapshot: manifest.json, files/<format>/…, exports/<format>/…   (generated by npm run ingest)
src/lib/            manifest types, ingest, content access, search, zip, secret scanner
src/pages/          home, topics/[topic], entries/[slug], search, static endpoints (files/, exports/, thumbs/, downloads/, search-index.json)
src/components/     design-system primitives (EntryCard, TopicTile, TagChip, …)
src/styles/         tokens.css (all colours, type, space, motion) and global.css
docker/, Dockerfile, docker-compose.yml   nginx image serving dist/ on :8080
.github/            CI, release workflow, issue/PR templates, intended ruleset
scripts/            ingest, scan-diff, smoke, screenshots, vercel-output
```
