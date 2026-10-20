import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IngestError, runIngest } from '../../src/lib/ingest/run.ts';
import { excalidraw, makeTree, md, mmd, setMtime } from './fixture.ts';

function snapshotFiles(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[p.slice(dir.length)] = readFileSync(p).toString('base64');
    }
  };
  walk(dir);
  return out;
}

const baseTree = () =>
  makeTree({
    'md/git-new-repo.md': md('Git new repo', ['git', 'repo-setup']),
    'mermaid/git-new-repo.mmd': mmd('Git new repo (diagram)', ['git', 'secrets']),
    'excalidraw/git-new-repo.excalidraw': excalidraw(),
    'excalidraw/instants-prime-flow.excalidraw': excalidraw('/prime — session flow'),
    'out/mermaid/git-new-repo.png': 'PNG',
    'out/mermaid/git-new-repo.pdf': 'PDF',
    'out/md/git-new-repo.pdf': 'PDF',
  });

describe('runIngest', () => {
  it('groups formats by base name with md-first metadata and unioned tags', () => {
    const t = baseTree();
    const { manifest } = runIngest({ sourceDir: t.source, outDir: t.out });
    const git = manifest.entries.find((e) => e.slug === 'git-new-repo')!;
    expect(git.title).toBe('Git new repo');
    expect(git.metadataFrom).toBe('md');
    expect(git.tags).toEqual(['git', 'repo-setup', 'secrets']);
    expect(Object.keys(git.formats)).toEqual(['md', 'mermaid', 'excalidraw']);
    expect(git.formats.md!.source.path).toBe('files/md/git-new-repo.md');
    expect(readFileSync(join(t.out, 'files/mermaid/git-new-repo.mmd'), 'utf8')).toContain('flowchart TD');
    expect(manifest.topics.map((x) => x.slug)).toEqual(['git', 'instants']);
  });

  it('derives title and topic for metadata-less excalidraw entries', () => {
    const t = baseTree();
    const { manifest } = runIngest({ sourceDir: t.source, outDir: t.out });
    const e = manifest.entries.find((x) => x.slug === 'instants-prime-flow')!;
    expect(e).toMatchObject({ title: '/prime — session flow', topic: 'instants', metadataFrom: 'derived', tags: [], source: null });
  });

  it('copies available exports and lists missing ones', () => {
    const t = baseTree();
    const { manifest } = runIngest({ sourceDir: t.source, outDir: t.out });
    const git = manifest.entries.find((e) => e.slug === 'git-new-repo')!;
    expect(Object.keys(git.formats.mermaid!.exports)).toEqual(['png', 'pdf']);
    expect(existsSync(join(t.out, 'exports/md/git-new-repo.pdf'))).toBe(true);
    expect(manifest.missingExports).toEqual([
      { slug: 'git-new-repo', format: 'excalidraw', kind: 'pdf' },
      { slug: 'git-new-repo', format: 'excalidraw', kind: 'png' },
      { slug: 'instants-prime-flow', format: 'excalidraw', kind: 'pdf' },
      { slug: 'instants-prime-flow', format: 'excalidraw', kind: 'png' },
    ]);
  });

  it('marks exports older than their source as stale', () => {
    const t = baseTree();
    setMtime(join(t.source, 'mermaid/git-new-repo.mmd'), 2_000_000_000);
    setMtime(join(t.source, 'out/mermaid/git-new-repo.png'), 1_000_000_000);
    const { manifest } = runIngest({ sourceDir: t.source, outDir: t.out });
    const exp = manifest.entries.find((e) => e.slug === 'git-new-repo')!.formats.mermaid!.exports;
    expect(exp.png!.freshness).toBe('stale');
  });

  it('leaves out a file with a secret, and its exports, without recording the value', () => {
    const fake = 'ghp_' + 'Z'.repeat(36);
    const t = makeTree({
      'md/ai-leak.md': md('Leak', ['ai'], '') + `\nkey: ${fake}\n`,
      'mermaid/ai-leak.mmd': mmd('Leak flow', ['ai']),
      'out/md/ai-leak.pdf': 'PDF',
    });
    const { manifest, excluded } = runIngest({ sourceDir: t.source, outDir: t.out });
    expect(excluded).toEqual([{ path: 'md/ai-leak.md', rules: ['github-token'] }]);
    const entry = manifest.entries.find((e) => e.slug === 'ai-leak')!;
    expect(Object.keys(entry.formats)).toEqual(['mermaid']);
    expect(existsSync(join(t.out, 'files/md/ai-leak.md'))).toBe(false);
    expect(existsSync(join(t.out, 'exports/md/ai-leak.pdf'))).toBe(false);
    expect(readFileSync(join(t.out, 'manifest.json'), 'utf8')).not.toContain(fake);
  });

  it('fails loudly, listing every malformed entry, and writes nothing', () => {
    const t = makeTree({
      'md/ok-entry.md': md('OK', ['ok']),
      'md/bad-entry.md': '# no frontmatter\n',
      'mermaid/Bad_Name.mmd': mmd('x', ['x']),
      'excalidraw/broken.excalidraw': '{',
      'md/notes.txt': 'stray',
    });
    let error: unknown;
    try {
      runIngest({ sourceDir: t.source, outDir: t.out });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(IngestError);
    const problems = (error as IngestError).problems.join('\n');
    expect(problems).toMatch(/md\/notes\.txt: unexpected file/);
    expect(problems).toMatch(/mermaid\/Bad_Name\.mmd: name is not kebab-case/);
    expect(problems).toMatch(/md\/bad-entry\.md: missing YAML frontmatter/);
    expect(problems).toMatch(/excalidraw\/broken\.excalidraw: invalid JSON/);
    expect(existsSync(t.out)).toBe(false);
  });

  it('is deterministic: a second run produces a byte-identical snapshot', () => {
    const t = baseTree();
    runIngest({ sourceDir: t.source, outDir: t.out });
    const first = snapshotFiles(t.out);
    runIngest({ sourceDir: t.source, outDir: t.out });
    expect(snapshotFiles(t.out)).toEqual(first);
  });

  it('never writes into the source tree and refuses overlapping dirs', () => {
    const t = baseTree();
    const before = snapshotFiles(t.source);
    runIngest({ sourceDir: t.source, outDir: t.out });
    expect(snapshotFiles(t.source)).toEqual(before);
    expect(() => runIngest({ sourceDir: t.source, outDir: join(t.source, 'content') })).toThrow(/must not overlap/);
  });
});
