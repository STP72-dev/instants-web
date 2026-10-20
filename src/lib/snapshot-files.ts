/** Static endpoints that copy snapshot files (content/files, content/exports) into the build output unchanged. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';
import { manifest } from './content.ts';

const CONTENT_DIR = join(process.cwd(), 'content');

export function snapshotPaths(prefix: 'files' | 'exports'): ReturnType<GetStaticPaths> {
  const paths = manifest.entries.flatMap((e) =>
    Object.values(e.formats).flatMap((f) => [f!.source.path, ...Object.values(f!.exports).map((x) => x!.path)]),
  );
  return paths.filter((p) => p.startsWith(`${prefix}/`)).map((p) => ({ params: { path: p.slice(prefix.length + 1) } }));
}

export const serveSnapshot =
  (prefix: 'files' | 'exports'): APIRoute =>
  ({ params }) =>
    new Response(readFileSync(join(CONTENT_DIR, prefix, String(params.path))));
