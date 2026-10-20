/**
 * Content snapshot manifest (DECISIONS.md D6). Written by `npm run ingest` to `content/manifest.json`,
 * read by the Astro build. Paths are POSIX, relative to `content/`; the public URL of a file is `/${path}`.
 */

export const SCHEMA_VERSION = 1;

export const FORMATS = ['md', 'mermaid', 'excalidraw'] as const;
export type Format = (typeof FORMATS)[number];

export const EXPORT_KINDS = ['png', 'pdf'] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

/** Source file extension per format (also the INSTANTS directory name). */
export const FORMAT_EXT: Record<Format, string> = { md: '.md', mermaid: '.mmd', excalidraw: '.excalidraw' };

/** Exports INSTANTS can produce per format; anything absent from `out/` is listed as missing. */
export const EXPECTED_EXPORTS: Record<Format, readonly ExportKind[]> = {
  md: ['pdf'],
  mermaid: ['png', 'pdf'],
  excalidraw: ['png', 'pdf'],
};

export type TopicKind = 'music' | 'technical';

/** Music track-DNA roles and technical guided-path roles. */
export type Role =
  | 'overview'
  | 'sound-dna'
  | 'variant'
  | 'workflow'
  | 'concept'
  | 'practice'
  | 'reference'
  | 'detail'
  | 'supporting';

export interface FileRef {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ExportRef extends FileRef {
  /** `stale` when the export is older than its source file. */
  freshness: 'fresh' | 'stale';
}

export interface FormatAsset {
  source: FileRef;
  exports: Partial<Record<ExportKind, ExportRef>>;
}

export interface MissingExport {
  slug: string;
  format: Format;
  kind: ExportKind;
}

export interface Entry {
  slug: string;
  title: string;
  tags: string[];
  source: string | null;
  created: string | null;
  summary: string | null;
  topic: string;
  track: string | null;
  role: Role;
  /** 0-based reading order inside the topic. */
  order: number;
  /** Which file supplied title/tags/source. */
  metadataFrom: Format | 'derived';
  formats: Partial<Record<Format, FormatAsset>>;
}

export interface Track {
  slug: string;
  title: string;
  entries: string[];
}

export interface Topic {
  slug: string;
  title: string;
  kind: TopicKind;
  /** All entry slugs in reading order (tracks first for music topics). */
  entries: string[];
  tracks: Track[];
  tags: string[];
}

export interface SecretExclusion {
  path: string;
  rules: string[];
}

export interface Manifest {
  schemaVersion: typeof SCHEMA_VERSION;
  source: { commit: string; committedAt: string; dirty: boolean } | null;
  counts: { entries: number; topics: number; files: Record<Format, number>; exports: Record<ExportKind, number> };
  topics: Topic[];
  entries: Entry[];
  missingExports: MissingExport[];
  secretScan: { scannedFiles: number; excluded: SecretExclusion[] };
}
