/**
 * Writes a Vercel Build Output API v3 directory from a built static site (D4).
 * Usage: node scripts/vercel-output.ts <dist-dir> <out-dir>
 *        node scripts/vercel-output.ts --nginx-csp <dist-dir> <conf-file>
 *   <out-dir>/config.json   version 3 + routes mirroring docker/nginx.conf
 *   <out-dir>/static/**     byte-identical copy of <dist-dir>
 * The second form writes the nginx include with the same Content-Security-Policy (Docker build stage), so
 * both hosts serve identical CSP values: inline scripts are allowed by hash, computed from the built HTML.
 * The release workflow runs it on the html dir extracted from the published image,
 * then `vercel deploy --prebuilt` uploads <out-dir> (= .vercel/output).
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

// Same set as docker/nginx.conf.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

// Keep in sync with docker/nginx.conf.
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

/** Recursively list *.html files under dir. */
function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    return e.isDirectory() ? htmlFiles(path) : e.name.endsWith('.html') ? [path] : [];
  });
}

/**
 * CSP hash sources ('sha256-...') for every inline <script> (no src attribute) in the built HTML.
 * Astro inlines small module scripts, and their text changes with every build, so the hashes are
 * computed from the output rather than written down.
 */
export function inlineScriptHashes(dir: string): string[] {
  const hashes = new Set<string>();
  for (const file of htmlFiles(dir)) {
    for (const m of readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\ssrc\s*=/i.test(m[1] ?? '') || !m[2]) continue;
      hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

/**
 * Content-Security-Policy value. style-src keeps 'unsafe-inline' because Mermaid and Excalidraw inject
 * <style>/style attributes at runtime (and Astro emits scoped <style> blocks); scripts stay hash/self only.
 */
export function buildCsp(scriptHashes: string[] = []): string {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    // PDF previews use <iframe> (frame-src); nothing needs <object>/<embed>.
    "object-src 'none'",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Route order matters: header routes use `continue` and later ones override earlier ones,
 * so the generic no-cache comes before the immutable /_astro/ rule. The 404 fallback
 * must come after `handle: filesystem`.
 */
export function buildConfig(scriptHashes: string[] = []): OutputConfig {
  return {
    version: 3,
    routes: [
      {
        src: '/(.*)',
        headers: {
          ...SECURITY_HEADERS,
          'Permissions-Policy': PERMISSIONS_POLICY,
          'Content-Security-Policy': buildCsp(scriptHashes),
          'Cache-Control': 'no-cache',
        },
        continue: true,
      },
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
  writeFileSync(join(out, 'config.json'), JSON.stringify(buildConfig(inlineScriptHashes(realDist)), null, 2) + '\n');
}

/** nginx include (docker build stage): the same CSP value as the Vercel output, hashes from `dir`. */
export function nginxCspInclude(dir: string): string {
  const csp = buildCsp(inlineScriptHashes(dir));
  return [
    '# Generated by scripts/vercel-output.ts --nginx-csp from the built site; do not edit.',
    `add_header Content-Security-Policy "${csp}" always;`,
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const nginx = args[0] === '--nginx-csp';
  const [distDir, outDir] = nginx ? args.slice(1) : args;
  if (!distDir || !outDir) {
    console.error('usage: node scripts/vercel-output.ts <dist-dir> <out-dir>\n       node scripts/vercel-output.ts --nginx-csp <dist-dir> <conf-file>');
    process.exit(2);
  }
  try {
    if (nginx) {
      writeFileSync(outDir, nginxCspInclude(distDir));
      console.log(`vercel-output: wrote nginx CSP include ${outDir} from ${distDir}`);
    } else {
      writeVercelOutput(distDir, outDir);
      console.log(`vercel-output: wrote ${outDir}/config.json and ${outDir}/static/ from ${distDir}`);
    }
  } catch (err) {
    console.error(`vercel-output: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
