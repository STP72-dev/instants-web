import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Builds a throwaway INSTANTS-like tree. Keys are paths relative to the root. */
export function makeTree(files: Record<string, string>): { root: string; source: string; out: string } {
  const root = mkdtempSync(join(tmpdir(), 'iweb-ingest-'));
  const source = join(root, 'INSTANTS');
  for (const [rel, body] of Object.entries(files)) {
    const p = join(source, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return { root, source, out: join(root, 'content') };
}

export function setMtime(path: string, seconds: number): void {
  utimesSync(path, seconds, seconds);
}

export const md = (title: string, tags: string[], extra = '') =>
  `---\ntitle: ${title}\ntags: [${tags.join(', ')}]\nsource: "unit test"\n${extra}---\n\n# ${title}\n\n## Problem\nA short **summary** with a [link](https://example.com).\n`;

export const mmd = (title: string, tags: string[]) =>
  `%% title: ${title}\n%% tags: ${tags.join(', ')}\n%% source: unit test\nflowchart TD\n  A --> B\n`;

export const excalidraw = (title?: string) =>
  JSON.stringify({
    type: 'excalidraw',
    version: 2,
    elements: title ? [{ id: 'title', type: 'text', text: title }] : [],
    appState: {},
    files: {},
  });
