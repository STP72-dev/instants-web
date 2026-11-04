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
The image builds the site from the files in this repo only; it never needs the INSTANTS folder. It runs nginx as a non-root user with a
strict Content-Security-Policy and a healthcheck; Compose additionally runs it with a read-only root filesystem, dropped capabilities and
`no-new-privileges` (for plain `docker run`, add `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges`).

### With Node (for development)

Requires Node ≥ 22.22 (see `.nvmrc`, CI uses 24).

```bash
npm ci
npm run dev          # http://localhost:4321 with hot reload
npm run build        # static output in dist/
npm run preview      # serve dist/
```

## Refresh content from INSTANTS

INSTANTS (sibling checkout `../INSTANTS` by default; `INSTANTS_DIR` overrides it) is **read-only** for this project. The ingest script copies it into
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
- **secret-scans** every file, including text inside PNG/PDF exports (compressed PDF streams and PNG text chunks); a hit — or an export it
  cannot fully scan — leaves the file out and is printed so it can be reviewed by hand;
- refuses an output directory that is not a content snapshot (never the repo root or the working directory);
- writes `content/manifest.json`; the output is deterministic for the same input files.

## Verify

```bash
npm run ci                               # Node checks: lint + typecheck + unit tests + build
npm run scan:diff                        # secret scan of every commit on your branch vs origin/main
scripts/verify-site.sh http://localhost:8080
                                         # release smoke test: home, hubs, an entry per format, one download per file type,
                                         # search index, thumbnails, zip Content-Disposition and the 404 page
scripts/smoke.sh http://localhost:8080   # the underlying status + content-type checker (add "path|type" arguments)
npm run csp-check -- http://localhost:8080
                                         # browser check of every page type (incl. Excalidraw canvas, Mermaid, search):
                                         # fails on any CSP violation or any request leaving the site
npm run e2e:search -- http://localhost:8080
                                         # search: no-JS fallback, hostile URL values, ranking order, failed-index retry
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
4. CI (`.github/workflows/ci.yml`, check name `ci`) must pass: secret scan of the PR's commits, lint, typecheck, tests, build, then the
   shipped artifact itself — the Docker image is built and served, `npm run csp-check` drives every page type in Chromium (CSP, no requests
   leaving the site) and `scripts/verify-site.sh` checks every page and file type.
5. Review, then **squash merge**; the branch is deleted automatically.

The intended branch protection lives in `.github/ruleset-main.json`. GitHub Free does not enforce rulesets on private repositories, so the
rules are followed by discipline until the repo is public or on Pro (issue #18).

## Cut a release

1. Make sure `main` is green, every issue of the milestone is closed, and the local checks pass against the Docker image:
   `WEB_PORT=18080 docker compose up -d --build && scripts/verify-site.sh http://localhost:18080 && npm run csp-check -- http://localhost:18080`.
2. Create the release (this creates the tag and triggers `.github/workflows/release.yml`):
   ```bash
   gh release create v0.1.0 --target main --generate-notes
   ```
3. The release workflow refuses tags that are not on `main`, scans the full history for secrets, runs lint/typecheck/tests, builds the Docker
   image once, pushes it to `ghcr.io/stp72-dev/instants-web` (`0.1.0`, `0.1`, `sha-…`, `latest`), extracts the static site from that image
   and deploys it to Vercel with `vercel deploy --prebuilt` (CLI pinned in `tools/vercel/`). Re-running a release reuses the published image.
   Without the `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets the Vercel step is skipped with a warning (issue #17).

Details, re-runs and the nginx/Vercel parity notes: [`docs/release.md`](docs/release.md).

## Layout

```
content/            committed snapshot: manifest.json, files/<format>/…, exports/<format>/…   (generated by npm run ingest)
src/lib/            manifest types, ingest, content access, hub grouping, search, zip writer, secret scanner, Markdown rendering
src/pages/          home, topics/[topic], entries/[slug], search, styleguide, 404, static endpoints
                    (files/, exports/, thumbs/, downloads/<topic>.zip, search-index.json, excalidraw/fonts/)
src/components/     design-system primitives (EntryCard, TopicTile, TagChip, …) and entry/ (Mermaid, Excalidraw, downloads, TOC)
src/styles/         tokens.css (all colours, type, space, motion) and global.css
docker/, Dockerfile, docker-compose.yml   nginx image serving dist/ on :8080
.github/            CI, release workflow, issue/PR templates, intended ruleset
scripts/            ingest, scan-diff, smoke, verify-site, screenshots, csp-check, e2e-search, vercel-output
tools/vercel/       lockfile-pinned Vercel CLI used only by the release workflow
docs/               release.md (release internals, nginx/Vercel parity), screenshots/ from PRs
```
