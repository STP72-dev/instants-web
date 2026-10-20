import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { serveSnapshot, snapshotPaths } from '../src/lib/snapshot-files.ts';

const call = (prefix: 'files' | 'exports', path: string) => serveSnapshot(prefix)({ params: { path } } as unknown as APIContext) as Response;

describe('snapshot file endpoints', () => {
  it('serve manifest files byte-for-byte', async () => {
    const res = call('files', 'md/ai-start-guide.md');
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/^---\ntitle:/);
  });

  it.each(['../../package.json', 'md/../../manifest.json', '../exports/md/ai-start-guide.pdf', 'md/not-there.md'])('404 for %s', (p) => {
    expect(call('files', p).status).toBe(404);
  });

  it('only list manifest paths', () => {
    const paths = (snapshotPaths('exports') as Array<{ params: { path: string } }>).map((p) => p.params.path);
    expect(paths.length).toBe(92);
    expect(paths.every((p) => /^(md|mermaid|excalidraw)\/[a-z0-9-]+\.(png|pdf)$/.test(p))).toBe(true);
  });
});
