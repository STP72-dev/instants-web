import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type FileRef, type Manifest } from '../src/lib/manifest.ts';
import { scanText } from '../src/lib/secrets.ts';

// Integrity of the committed content snapshot (what Docker and Vercel build from).
const CONTENT = join(import.meta.dirname, '..', 'content');
const manifest = JSON.parse(readFileSync(join(CONTENT, 'manifest.json'), 'utf8')) as Manifest;

const refs: FileRef[] = manifest.entries.flatMap((e) =>
  Object.values(e.formats).flatMap((f) => [f!.source, ...Object.values(f!.exports).map((x) => x!)]),
);

describe('committed content snapshot', () => {
  it('has the current schema and consistent counts', () => {
    expect(manifest.schemaVersion).toBe(SCHEMA_VERSION);
    expect(manifest.counts.entries).toBe(manifest.entries.length);
    expect(manifest.topics.flatMap((t) => t.entries).sort()).toEqual(manifest.entries.map((e) => e.slug).sort());
  });

  it('references only files that exist with matching size and sha256', () => {
    for (const ref of refs) {
      const buf = readFileSync(join(CONTENT, ref.path));
      expect({ path: ref.path, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') }).toEqual({
        path: ref.path,
        bytes: ref.bytes,
        sha256: ref.sha256,
      });
    }
  });

  it('contains no unreferenced files', () => {
    const referenced = new Set([...refs.map((r) => r.path), 'manifest.json']);
    const walk = (dir: string, prefix = ''): string[] =>
      readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n), `${prefix}${n}/`) : [`${prefix}${n}`]));
    expect(existsSync(CONTENT)).toBe(true);
    expect(walk(CONTENT).filter((p) => !referenced.has(p))).toEqual([]);
  });

  it('has no secret-scan hits in text files', () => {
    for (const ref of refs.filter((r) => !/\.(png|pdf)$/.test(r.path))) {
      expect({ path: ref.path, hits: scanText(readFileSync(join(CONTENT, ref.path), 'utf8')) }).toEqual({ path: ref.path, hits: [] });
    }
  });
});
