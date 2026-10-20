/** Static endpoints that copy snapshot files (content/files, content/exports) into the build output unchanged. */
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { manifest } from './content.ts';

const CONTENT_DIR = resolve(process.cwd(), 'content');

/** Every snapshot path the manifest references — the only files these endpoints will ever read. */
const ALLOWED = new Set(
  manifest.entries.flatMap((e) =>
    Object.values(e.formats).flatMap((f) => [f!.source.path, ...Object.values(f!.exports).map((x) => x!.path)]),
  ),
);

export function snapshotPaths(prefix: 'files' | 'exports'): ReturnType<GetStaticPaths> {
  return [...ALLOWED].filter((p) => p.startsWith(`${prefix}/`)).map((p) => ({ params: { path: p.slice(prefix.length + 1) } }));
}

export const serveSnapshot =
  (prefix: 'files' | 'exports'): APIRoute =>
  ({ params }) => {
    const rel = `${prefix}/${String(params.path ?? '')}`;
    const abs = resolve(CONTENT_DIR, rel);
    // Allowlist + containment: params can be arbitrary when a route is rendered on demand.
    if (!ALLOWED.has(rel) || !abs.startsWith(CONTENT_DIR + sep)) return new Response('Not found', { status: 404 });
    return new Response(readFileSync(join(CONTENT_DIR, rel)));
  };
