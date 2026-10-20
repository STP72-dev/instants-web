# Releasing

## How to release

1. Make sure `main` is green (CI) and contains what you want to ship.
2. Tag the commit and push the tag:
   ```bash
   git tag v1.2.3 && git push origin v1.2.3
   ```
   Tags must look like `vMAJOR.MINOR.PATCH` (a `-rc.1` style suffix is a prerelease and does not get the `latest` tag).
3. The **Release** workflow (`.github/workflows/release.yml`) runs. To re-run for an existing tag, use
   *Actions → Release → Run workflow* and enter the tag (e.g. `v1.2.3`).

## What the workflow does

Before anything is built it refuses tags whose commit is not on `main`, scans the full history for secrets (before installing
dependencies), and runs lint, typecheck and the unit tests — including the committed-snapshot audit that sha256-checks and secret-scans every
file in `content/` (PNG/PDF exports incl. inflated PDF streams and PNG text chunks).

Release tags are immutable: if `ghcr.io/w7-mgfcode/instants-web:<version>` already exists (a re-run), the workflow reuses that image digest
instead of rebuilding and re-tagging, and only repeats the extraction and the Vercel step.

The site is built **once**, inside the Docker image build (`npm run build` in the Dockerfile build stage).

1. Build the image and push it to `ghcr.io/w7-mgfcode/instants-web` using `GITHUB_TOKEN`
   (job permissions: `contents: read`, `packages: write`). Tags: `{{version}}`, `{{major}}.{{minor}}`, `sha-<7>`, and `latest` (stable tags only).
2. `docker create` the pushed image **by digest**, `docker cp /usr/share/nginx/html`, and run
   `node scripts/vercel-output.ts <html-dir> .vercel/output`. That writes a [Build Output API v3](https://vercel.com/docs/build-output-api)
   directory: `config.json` (version 3 + routes) and `static/` (byte-identical copy of the html dir).
   The base image's own `50x.html` rides along; it is harmless.
3. Deploy that directory with `vercel deploy --prebuilt --prod`, using the CLI pinned in `tools/vercel/package-lock.json`
   (installed with `npm ci --ignore-scripts`, so integrity hashes are checked and no install scripts run).

Docker and Vercel therefore serve the same files.

## The Vercel step

It needs three repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (set up in issue #17).
If any of them is empty the step logs

```
Vercel deploy skipped: VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID must all be set (see issue #17).
```

and succeeds, so the image is still published. The skip is made visible as a warning annotation (`::warning title=Vercel deploy skipped::`)
and in the job summary. A skipped run publishes the image only; Vercel stays on its previous deployment. The secrets are only exposed to that step's environment, never passed to third-party actions.
To change the CLI version: `cd tools/vercel && npm install --save-exact --package-lock-only --ignore-scripts vercel@<version>` and open a PR.

## Vercel config vs nginx

`scripts/vercel-output.ts` mirrors `docker/nginx.conf`: the content types for `.md`/`.mmd`/`.excalidraw`, `Content-Disposition: attachment`
for `/downloads/<topic>.zip` only, `immutable` caching for `/_astro/*` and `no-cache` otherwise, the same security headers (no CSP until #12),
`/topics/x` → `/topics/x/` redirects, and a 404 fallback to `/404.html` after `handle: filesystem`.
When you change one side, change the other (the unit tests in `tests/vercel-output.test.ts` pin the Vercel side).

Known differences: nginx redirects any dot-less path without a trailing slash only when the directory exists, while Vercel redirects before the
filesystem check, so an unknown `/nope` goes `/nope` → `/nope/` → 404. The `/404.html` route has no effect until the site ships a 404 page.
