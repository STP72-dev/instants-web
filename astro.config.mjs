// @ts-check
import { defineConfig } from 'astro/config';

// Excalidraw 0.18 appends an https://esm.sh/... fallback source to every @font-face. Point it at our own origin
// (fonts are served from /excalidraw/fonts by src/pages/excalidraw/fonts). The pattern matches the pinned 0.18.1 build;
// if an upgrade changes it, the build fails instead of silently fetching fonts from a CDN.
const ESM_SH_FALLBACK =
  /`https:\/\/esm\.sh\/\$\{\w+\.PKG_NAME\?`\$\{\w+\.PKG_NAME\}@\$\{\w+\.PKG_VERSION\}`:"@excalidraw\/excalidraw"\}\/dist\/prod\/`/g;
const excalidrawNoCdn = {
  name: 'excalidraw-fonts-no-cdn',
  transform(code, id) {
    if (!id.includes('@excalidraw/excalidraw') || !code.includes('esm.sh')) return null;
    const next = code.replace(ESM_SH_FALLBACK, '(location.origin+"/excalidraw/")');
    if (next.includes('https://esm.sh/')) {
      throw new Error(`excalidraw-fonts-no-cdn: unhandled esm.sh reference in ${id} (Excalidraw upgraded? update ESM_SH_FALLBACK)`);
    }
    return next === code ? null : { code: next, map: null };
  },
};

// Static-first: one `dist/` output shared by Docker (nginx) and Vercel (Build Output API v3).
export default defineConfig({
  vite: { plugins: [excalidrawNoCdn] },
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  site: process.env.SITE_URL ?? 'http://localhost:8080',
});
