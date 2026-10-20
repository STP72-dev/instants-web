/** Serialized MiniSearch index, built once at build time (D3). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { manifest } from '../lib/content.ts';
import { INDEX_OPTIONS, searchDoc, type SearchDoc } from '../lib/search.ts';

export function GET() {
  const read = (path: string) => readFileSync(join(process.cwd(), 'content', path), 'utf8');
  const index = new MiniSearch<SearchDoc>(INDEX_OPTIONS);
  index.addAll(manifest.entries.map((e) => searchDoc(e, manifest, read)));
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } });
}
