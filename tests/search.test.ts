import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import { manifest } from '../src/lib/content.ts';
import { excalidrawText, INDEX_OPTIONS, markdownText, mermaidText, searchDoc, type SearchDoc } from '../src/lib/search.ts';

const read = (path: string) => readFileSync(join(import.meta.dirname, '..', 'content', path), 'utf8');
const index = new MiniSearch<SearchDoc>(INDEX_OPTIONS);
index.addAll(manifest.entries.map((e) => searchDoc(e, manifest, read)));
// Round-trip through JSON exactly like the browser does.
const loaded = MiniSearch.loadJSON<SearchDoc>(JSON.stringify(index), INDEX_OPTIONS);
const top = (q: string) => loaded.search(q).slice(0, 3).map((r) => r.id);

describe('text extraction', () => {
  it('strips markdown, keeps words', () => {
    expect(markdownText('---\ntitle: x\n---\n# Head\nSee [docs](https://x.y) and `code` **bold**.')).toBe('Head See docs and code bold.');
  });
  it('reads mermaid labels and excalidraw text', () => {
    expect(mermaidText('flowchart TD\n A["Feladat"] --> B{"Milyen munka?"}\n C[pgvector store]')).toBe('Feladat Milyen munka? pgvector store');
    expect(excalidrawText(JSON.stringify({ elements: [{ type: 'text', text: 'Hello\nworld' }, { type: 'rect' }] }))).toBe('Hello world');
  });
});

describe('search over the committed snapshot', () => {
  it('indexes every entry', () => {
    expect(loaded.documentCount).toBe(manifest.entries.length);
  });

  it.each([
    ['pgvector', 'forecastlabai-rag-pipeline'],
    ['hell yeah sound', 'nonconformist-hell-yeah-sound-dna'],
    ['data leakage', 'forecastlabai-feature-leakage'],
    ['first commits', 'git-new-repo-first-commits'],
    ['modellvalasztas', 'ai-model-routing'],
    ['prime', 'instants-prime-flow'],
  ])('"%s" ranks %s in the top 3', (q, slug) => {
    expect(top(q)).toContain(slug);
  });

  it('typos and prefixes still match', () => {
    expect(top('forecastlab')).not.toEqual([]);
    expect(top('pgvectr')).toContain('forecastlabai-rag-pipeline');
  });
});
