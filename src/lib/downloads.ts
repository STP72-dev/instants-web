/** Per-topic zip archives (issue #7), built at build time from the committed snapshot. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPORT_LABEL, FORMAT_LABEL, getTopic, manifest, topicEntries } from './content.ts';
import { createZip, type ZipFile } from './zip.ts';

const CONTENT_DIR = join(process.cwd(), 'content');

function readme(slug: string): string {
  const topic = getTopic(slug);
  const lines = [
    `${topic.title} — INSTANTS topic archive`,
    '',
    `${topic.entries.length} entries, in reading order. Sources are under files/, PNG/PDF exports under exports/.`,
    manifest.source ? `Snapshot of INSTANTS commit ${manifest.source.commit.slice(0, 12)} (${manifest.source.committedAt}).` : '',
    '',
  ];
  topicEntries(topic).forEach((e, i) => {
    lines.push(`${String(i + 1).padStart(2, '0')}. ${e.title}`);
    for (const [format, asset] of Object.entries(e.formats)) {
      const kinds = Object.keys(asset!.exports).map((k) => EXPORT_LABEL[k as 'png' | 'pdf']);
      lines.push(`    ${FORMAT_LABEL[format as 'md']}: ${asset!.source.path}${kinds.length ? ` (+ ${kinds.join(', ')})` : ''}`);
    }
  });
  const missing = manifest.missingExports.filter((m) => getTopic(slug).entries.includes(m.slug));
  if (missing.length > 0) {
    lines.push('', 'Not exported yet:');
    for (const m of missing) lines.push(`    ${m.format}/${m.slug}.${m.kind}`);
  }
  return `${lines.filter((l, i, all) => l !== '' || all[i - 1] !== '').join('\n')}\n`;
}

/** Archive layout: <topic>/README.txt, <topic>/files/<format>/<slug>.<ext>, <topic>/exports/<format>/<slug>.<png|pdf>. */
export function topicZipFiles(slug: string): ZipFile[] {
  const topic = getTopic(slug);
  const files: ZipFile[] = [{ name: `${slug}/README.txt`, data: new TextEncoder().encode(readme(slug)) }];
  for (const e of topicEntries(topic)) {
    for (const asset of Object.values(e.formats)) {
      for (const ref of [asset!.source, ...Object.values(asset!.exports).map((x) => x!)]) {
        files.push({ name: `${slug}/${ref.path}`, data: readFileSync(join(CONTENT_DIR, ref.path)) });
      }
    }
  }
  return files;
}

const cache = new Map<string, Uint8Array>();

/** Deterministic archive bytes (timestamp = snapshot commit time); memoized so pages can show the size. */
export function topicZip(slug: string): Uint8Array {
  let zip = cache.get(slug);
  if (!zip) {
    zip = createZip(topicZipFiles(slug), manifest.source?.committedAt);
    cache.set(slug, zip);
  }
  return zip;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
