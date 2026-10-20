/**
 * Self-hosted Excalidraw fonts (EXCALIDRAW_ASSET_PATH = '/excalidraw/'), copied from the pinned package at build time
 * so the canvas and exportToSvg never fetch from a CDN. Xiaolai (CJK, ~13 MB) is left out: no entry uses CJK text,
 * and a missing glyph font only falls back to a system font.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { APIRoute } from 'astro';

// The package's exports map hides package.json, so resolve from the project root (builds always run there, incl. Docker).
const FONTS_DIR = join(process.cwd(), 'node_modules', '@excalidraw', 'excalidraw', 'dist', 'prod', 'fonts');
const EXCLUDED = new Set(['Xiaolai']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const FILES = new Set(
  walk(FONTS_DIR)
    .map((p) => relative(FONTS_DIR, p).split(sep).join('/'))
    .filter((p) => !EXCLUDED.has(p.split('/')[0]) && /\.(woff2|ttf)$/.test(p)),
);

export function getStaticPaths() {
  return [...FILES].map((path) => ({ params: { path } }));
}

export const GET: APIRoute = ({ params }) => {
  const path = String(params.path ?? '');
  if (!FILES.has(path)) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(readFileSync(join(FONTS_DIR, path))), { headers: { 'Content-Type': 'font/woff2' } });
};
