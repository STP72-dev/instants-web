/** Card thumbnails: 720×405 WebP crops of each entry's diagram PNG, generated at build time. */
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { manifest, previewSource } from '../../lib/content.ts';

export function getStaticPaths() {
  return manifest.entries.filter((e) => previewSource(e)).map((e) => ({ params: { slug: e.slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const entry = manifest.entries.find((e) => e.slug === params.slug);
  const source = entry ? previewSource(entry) : null;
  if (!source) return new Response('Not found', { status: 404 });
  const webp = await sharp(join(process.cwd(), 'content', source.path))
    .resize({ width: 720, height: 405, fit: 'cover', position: 'top' })
    .webp({ quality: 80 })
    .toBuffer();
  return new Response(new Uint8Array(webp), { headers: { 'Content-Type': 'image/webp' } });
};
