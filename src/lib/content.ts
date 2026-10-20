/** Build-time access to the content snapshot (content/manifest.json). */
import rawManifest from '../../content/manifest.json';
import type { Entry, ExportKind, Format, Manifest, Role, Topic } from './manifest.ts';

export const manifest = rawManifest as unknown as Manifest;

const entryBySlug = new Map(manifest.entries.map((e) => [e.slug, e]));
const topicBySlug = new Map(manifest.topics.map((t) => [t.slug, t]));

export function getEntry(slug: string): Entry {
  const entry = entryBySlug.get(slug);
  if (!entry) throw new Error(`unknown entry: ${slug}`);
  return entry;
}

export function getTopic(slug: string): Topic {
  const topic = topicBySlug.get(slug);
  if (!topic) throw new Error(`unknown topic: ${slug}`);
  return topic;
}

export function topicEntries(topic: Topic): Entry[] {
  return topic.entries.map(getEntry);
}

/** Music topics first (they read as stories), then technical topics by size. */
export function orderedTopics(): Topic[] {
  return [...manifest.topics].sort(
    (a, b) =>
      Number(b.kind === 'music') - Number(a.kind === 'music') ||
      b.entries.length - a.entries.length ||
      (a.slug < b.slug ? -1 : 1),
  );
}

// ---------- Visual identity ----------

export type Accent = 'amber' | 'cyan' | 'violet' | 'mint' | 'rose' | 'lime';
const TECH_ACCENTS: Accent[] = ['cyan', 'violet', 'mint', 'rose', 'lime'];

/**
 * Music topics are always amber; technical topics take the next colour in a fixed palette,
 * in slug order, so the mapping is derived from the manifest rather than a hand list.
 */
export function topicAccent(slug: string): Accent {
  const topic = getTopic(slug);
  if (topic.kind === 'music') return 'amber';
  const technical = manifest.topics.filter((t) => t.kind === 'technical').map((t) => t.slug);
  return TECH_ACCENTS[technical.indexOf(slug) % TECH_ACCENTS.length];
}

export const accentVar = (accent: Accent) => `--accent: var(--accent-${accent});`;

// ---------- URLs ----------

export const topicUrl = (slug: string) => `/topics/${slug}/`;
export const entryUrl = (slug: string) => `/entries/${slug}/`;
export const fileUrl = (path: string) => `/${path}`;
export const topicZipUrl = (slug: string) => `/downloads/${slug}.zip`;
export const searchUrl = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return `/search/${qs ? `?${qs}` : ''}`;
};

// ---------- Labels ----------

export const FORMAT_LABEL: Record<Format, string> = { md: 'Markdown', mermaid: 'Mermaid', excalidraw: 'Excalidraw' };
export const FORMAT_SHORT: Record<Format, string> = { md: 'MD', mermaid: 'MMD', excalidraw: 'EXC' };
export const EXPORT_LABEL: Record<ExportKind, string> = { png: 'PNG', pdf: 'PDF' };

export const ROLE_LABEL: Record<Role, string> = {
  overview: 'Overview',
  'sound-dna': 'Sound DNA',
  variant: 'Variant',
  workflow: 'Workflow',
  concept: 'Concept',
  practice: 'Practice',
  reference: 'Reference',
  detail: 'Deep dive',
  supporting: 'Notes',
};

export function formatsOf(entry: Entry): Format[] {
  return (['md', 'mermaid', 'excalidraw'] as const).filter((f) => entry.formats[f]);
}

/** Diagram PNG used for the card thumbnail (Excalidraw exports are dark, Mermaid exports light). */
export function previewSource(entry: Entry): { path: string; format: 'mermaid' | 'excalidraw' } | null {
  const exc = entry.formats.excalidraw?.exports.png;
  if (exc) return { path: exc.path, format: 'excalidraw' };
  const mmd = entry.formats.mermaid?.exports.png;
  return mmd ? { path: mmd.path, format: 'mermaid' } : null;
}

export function thumbnail(entry: Entry): { src: string; light: boolean } | null {
  const source = previewSource(entry);
  return source ? { src: `/thumbs/${entry.slug}.webp`, light: source.format === 'mermaid' } : null;
}

export function totalFiles(): number {
  const { files, exports } = manifest.counts;
  return files.md + files.mermaid + files.excalidraw + exports.png + exports.pdf;
}
