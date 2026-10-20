import type { APIRoute } from 'astro';
import { topicZip } from '../../lib/downloads.ts';
import { manifest } from '../../lib/content.ts';

export function getStaticPaths() {
  return manifest.topics.map((t) => ({ params: { topic: t.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  if (!manifest.topics.some((t) => t.slug === params.topic)) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(topicZip(params.topic!)), { headers: { 'Content-Type': 'application/zip' } });
};
