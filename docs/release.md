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

Release tags are immutable: the workflow asks the GitHub Packages API whether `ghcr.io/stp72-dev/instants-web:<version>` exists. If it does
(a re-run), that digest is reused — no rebuild, no re-tag — and only the extraction and the Vercel step repeat. HTTP 404 (package not
published yet) means build; any other API error stops the release instead of guessing.

The site is built **once**, inside the Docker image build (`npm run build` in the Dockerfile build stage).

1. Build the image and push it to `ghcr.io/stp72-dev/instants-web` using `GITHUB_TOKEN`
   (job permissions: `contents: read`, `packages: write`). Tags: `{{version}}`, `{{major}}.{{minor}}`, `sha-<7>`, and `latest` (stable tags only).
2. `docker create` the pushed image **by digest**, `docker cp /usr/share/nginx/html`, and run
   `node scripts/vercel-output.ts <html-dir> .vercel/output`. That writes a [Build Output API v3](https://vercel.com/docs/build-output-api)
   directory: `config.json` (version 3 + routes) and `static/` (byte-identical copy of the html dir).
   The base image's own `50x.html` rides along; it is harmless.
3. Deploy that directory with `vercel deploy --prebuilt --prod`, using the CLI pinned in `tools/vercel/package-lock.json`
   (installed with `npm ci --ignore-scripts`, so integrity hashes are checked and no install scripts run).
   The deploy runs from a copy in `$RUNNER_TEMP/vercel-deploy`, outside any git checkout, so the CLI sends no
   `gitMetadata`. The Vercel team is on Hobby, which blocks deployments whose commit author does not match the
   owner's linked GitHub account ("commit email could not be matched", #43). The step fails if that directory is
   inside a git repository.

The Vercel project is also connected to this GitHub repo (Git integration). `vercel.json` sets
`git.deploymentEnabled: false`, so pushes and PRs never deploy on their own: production only changes through a
release tag and this workflow. The release deploys from a folder without `vercel.json`, so it is not affected.

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
for `/downloads/<topic>.zip` only, `immutable` caching for `/_astro/*` and `no-cache` otherwise, the same security headers,
`/topics/x` → `/topics/x/` redirects, and a 404 fallback to `/404.html` after `handle: filesystem`.
When you change one side, change the other (the unit tests in `tests/vercel-output.test.ts` pin the Vercel side and the parity).

### Content-Security-Policy and Permissions-Policy

Both hosts send, on every response, the policy built by `buildCsp()` in `scripts/vercel-output.ts` (one source of truth):

```
default-src 'self'; script-src 'self' <hashes>; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-src 'self';
frame-ancestors 'self'; base-uri 'self'; form-action 'self'
```

plus `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`.

- **Scripts** are `'self'` plus `sha256-` hashes of the inline `<script>`s Astro emits (it inlines small module scripts, and their text changes
  with every build), so the hashes are computed from the built HTML, never written down. No `'unsafe-inline'`, no `'unsafe-eval'`
  (the browser check shows Mermaid and Excalidraw run without it).
- **Styles** keep `'unsafe-inline'`: Astro emits scoped `<style>` blocks and `style=` attributes, and Mermaid and Excalidraw inject styles at runtime.
- `blob:`/`data:` are limited to images, fonts and workers, which the diagram libraries may use; `frame-src 'self'` serves the PDF preview iframe.
- **No CDN:** Excalidraw appends an `https://esm.sh/...` fallback to every font source. The policy blocks it (and `csp-check` reports it), so the
  build must point that fallback at our own origin; see the `excalidraw-fonts-no-cdn` Vite plugin in `astro.config.mjs`.
- **Vercel:** `writeVercelOutput` hashes the HTML it copies and puts the policy in the first (catch-all) route's headers.
- **nginx:** the hashes depend on the built site, so the Docker build stage runs `node scripts/vercel-output.ts --nginx-csp dist /tmp/csp.conf`
  and the runtime stage copies it to `/etc/nginx/csp.conf`, which `docker/nginx.conf` includes. The include is deliberately not optional:
  an image without it fails to start instead of serving without a CSP. `Permissions-Policy` is a constant in `nginx.conf` (a test keeps it equal
  to `PERMISSIONS_POLICY`).
- **Proof:** `node scripts/csp-check.ts http://localhost:18080` (Docker image, `WEB_PORT=18080`) loads every page type, opens the Excalidraw
  canvas, renders and toggles Mermaid, opens the PDF preview, and fails on any `securitypolicyviolation`, CSP console error, blocked request, or
  request to a non-localhost origin. `--allow-missing-csp` is for `astro preview`, which sends no headers.

Known differences: nginx redirects any dot-less path without a trailing slash only when the directory exists, while Vercel redirects before the
filesystem check, so an unknown `/nope` goes `/nope` → `/nope/` → 404.
