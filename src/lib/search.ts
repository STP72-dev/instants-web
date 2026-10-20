/**
 * Search index (DECISIONS.md D3): MiniSearch over title, tags, topic, track, summary and body text.
 * Built once at build time and served as /search-index.json; the client loads it with the same options.
 */
import type { Options, SearchOptions } from 'minisearch';
import type { Entry, Manifest } from './manifest.ts';

export interface SearchDoc {
  id: string;
  title: string;
  tags: string;
  topic: string;
  track: string;
  summary: string;
  body: string;
}

export const SEARCH_OPTIONS: SearchOptions = {
  boost: { title: 4, tags: 3, topic: 2, track: 2, summary: 1.5 },
  prefix: true,
  fuzzy: 0.2,
  combineWith: 'AND',
};

export const INDEX_OPTIONS: Options<SearchDoc> = {
  fields: ['title', 'tags', 'topic', 'track', 'summary', 'body'],
  storeFields: [],
  searchOptions: SEARCH_OPTIONS,
  // Fold accents so "modellvalasztas" finds "modellválasztás".
  processTerm: (term) => term.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(),
};

// Generous cap (well above today's longest entry) so the whole body is searchable; it only guards the index size.
const BODY_LIMIT = 100_000;

/** Plain text from Markdown: drops frontmatter, code fences' markers, links' URLs and markup characters. */
export function markdownText(md: string): string {
  return md
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/```[a-z]*\n?/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/[#>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Visible labels from a Mermaid diagram: quoted strings and [..] / (..) / {..} node text. */
export function mermaidText(mmd: string): string {
  const labels = [...mmd.matchAll(/"([^"]+)"|\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\}/g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/^"|"$/g, ''));
  return labels.join(' ').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Text elements of an Excalidraw scene. */
export function excalidrawText(json: string): string {
  const scene = JSON.parse(json) as { elements?: Array<{ type?: string; text?: string; isDeleted?: boolean }> };
  return (scene.elements ?? [])
    .filter((el) => el.type === 'text' && !el.isDeleted && typeof el.text === 'string')
    .map((el) => el.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchDoc(entry: Entry, manifest: Manifest, readFile: (path: string) => string): SearchDoc {
  const topic = manifest.topics.find((t) => t.slug === entry.topic)!;
  const track = entry.track ? topic.tracks.find((t) => t.slug === entry.track)!.title : '';
  const parts: string[] = [];
  if (entry.formats.md) parts.push(markdownText(readFile(entry.formats.md.source.path)));
  if (entry.formats.mermaid) parts.push(mermaidText(readFile(entry.formats.mermaid.source.path)));
  if (entry.formats.excalidraw) parts.push(excalidrawText(readFile(entry.formats.excalidraw.source.path)));
  return {
    id: entry.slug,
    title: entry.title,
    tags: entry.tags.join(' '),
    topic: `${topic.title} ${topic.slug}`,
    track,
    summary: entry.summary ?? '',
    body: parts.join(' ').slice(0, BODY_LIMIT),
  };
}
