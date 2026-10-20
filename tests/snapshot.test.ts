import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTopic, deriveTopics } from '../src/lib/ingest/topics.ts';
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

  it('has no secret-scan hits in any file, including binaries and the manifest itself', () => {
    for (const path of [...refs.map((r) => r.path), 'manifest.json']) {
      const text = readFileSync(join(CONTENT, path)).toString(/\.(png|pdf)$/.test(path) ? 'latin1' : 'utf8');
      expect({ path, hits: scanText(text) }).toEqual({ path, hits: [] });
    }
  });

  it('has file and export counts that match the entries', () => {
    const files = { md: 0, mermaid: 0, excalidraw: 0 };
    const exports = { png: 0, pdf: 0 };
    for (const e of manifest.entries) {
      for (const [format, asset] of Object.entries(e.formats)) {
        files[format as keyof typeof files] += 1;
        for (const kind of Object.keys(asset!.exports)) exports[kind as keyof typeof exports] += 1;
      }
    }
    expect(manifest.counts).toEqual({ entries: manifest.entries.length, topics: manifest.topics.length, files, exports });
  });

  it('places every entry consistently with its topic and track', () => {
    for (const topic of manifest.topics) {
      topic.entries.forEach((slug, order) => {
        const e = manifest.entries.find((x) => x.slug === slug)!;
        expect({ slug, topic: e.topic, order: e.order }).toEqual({ slug, topic: topic.slug, order });
      });
      for (const track of topic.tracks) {
        for (const slug of track.entries) expect(manifest.entries.find((x) => x.slug === slug)!.track).toBe(track.slug);
      }
    }
  });

  it('matches a fresh derivation of topics, tracks, roles and order from names and tags', () => {
    const topicOf = deriveTopics(manifest.entries.map((e) => ({ slug: e.slug, tags: e.tags })));
    for (const e of manifest.entries) expect({ slug: e.slug, topic: e.topic }).toEqual({ slug: e.slug, topic: topicOf.get(e.slug) });
    for (const stored of manifest.topics) {
      const members = manifest.entries.filter((e) => e.topic === stored.slug);
      const { topic, placements } = buildTopic(
        stored.slug,
        members.map((m) => ({ slug: m.slug, title: m.title, tags: m.tags })),
      );
      expect(topic).toEqual(stored);
      for (const m of members) expect({ slug: m.slug, ...placements.get(m.slug) }).toEqual({ slug: m.slug, track: m.track, role: m.role, order: m.order });
    }
  });
});
