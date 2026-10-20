/**
 * Writes a Vercel Build Output API v3 directory from a built static site (D4).
 * Usage: node scripts/vercel-output.ts <dist-dir> <out-dir>
 *   <out-dir>/config.json   version 3 + routes mirroring docker/nginx.conf
 *   <out-dir>/static/**     byte-identical copy of <dist-dir>
 * The release workflow runs it on the html dir extracted from the published image,
 * then `vercel deploy --prebuilt` uploads <out-dir> (= .vercel/output).
 */
import { cpSync, existsSync, lstatSync, mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Route {
  src?: string;
  dest?: string;
  status?: number;
  headers?: Record<string, string>;
  continue?: boolean;
  handle?: 'filesystem';
}

export interface OutputConfig {
  version: 3;
  routes: Route[];
}

// Same set as docker/nginx.conf (no CSP yet, see #12).
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

/**
 * Route order matters: header routes use `continue` and later ones override earlier ones,
 * so the generic no-cache comes before the immutable /_astro/ rule. The 404 fallback
 * must come after `handle: filesystem`.
 */
export function buildConfig(): OutputConfig {
  return {
    version: 3,
    routes: [
      { src: '/(.*)', headers: { ...SECURITY_HEADERS, 'Cache-Control': 'no-cache' }, continue: true },
      { src: '/_astro/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
      { src: '/.*\\.md$', headers: { 'Content-Type': 'text/markdown; charset=utf-8' }, continue: true },
      { src: '/.*\\.mmd$', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, continue: true },
      { src: '/.*\\.excalidraw$', headers: { 'Content-Type': 'application/vnd.excalidraw+json' }, continue: true },
      // Only per-topic zips download; /files/** and /exports/** stay inline (the UI uses <a download>).
      { src: '/downloads/[^/]+\\.zip$', headers: { 'Content-Disposition': 'attachment' }, continue: true },
      // nginx parity: /topics/x -> 301 /topics/x/ (only dot-less paths, so files are never redirected).
      { src: '^/(.*/)?([^/.]+)$', headers: { Location: '/$1$2/' }, status: 301 },
      { handle: 'filesystem' },
      { src: '/.*', status: 404, dest: '/404.html' },
    ],
  };
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep);
}

/** Physical path: realpath of the nearest existing ancestor plus the not-yet-existing tail. */
function physicalPath(p: string): string {
  let current = resolve(p);
  let tail = '';
  for (;;) {
    try {
      return join(realpathSync(current), tail);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      // realpath fails for a dangling symlink too; its target is unknowable, so refuse it.
      if (lstatSync(current, { throwIfNoEntry: false })) {
        throw new Error(`dangling symlink: ${current}`);
      }
      const parent = dirname(current);
      if (parent === current) throw err;
      tail = join(basename(current), tail);
      current = parent;
    }
  }
}

export function writeVercelOutput(distDir: string, outDir: string): void {
  const dist = resolve(distDir);
  if (!existsSync(dist) || !statSync(dist).isDirectory()) throw new Error(`dist dir not found: ${distDir}`);
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`no index.html in ${distDir}; refusing to package an empty site`);
  // Compare and act on physical paths so a symlink cannot alias out into dist (or the reverse).
  const realDist = physicalPath(dist);
  const out = physicalPath(outDir);
  if (realDist === out || isInside(realDist, out) || isInside(out, realDist)) {
    throw new Error('out dir and dist dir must not be the same or nested');
  }

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(realDist, join(out, 'static'), { recursive: true });
  writeFileSync(join(out, 'config.json'), JSON.stringify(buildConfig(), null, 2) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [distDir, outDir] = process.argv.slice(2);
  if (!distDir || !outDir) {
    console.error('usage: node scripts/vercel-output.ts <dist-dir> <out-dir>');
    process.exit(2);
  }
  try {
    writeVercelOutput(distDir, outDir);
    console.log(`vercel-output: wrote ${outDir}/config.json and ${outDir}/static/ from ${distDir}`);
  } catch (err) {
    console.error(`vercel-output: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
