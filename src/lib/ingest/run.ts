import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {
  EXPECTED_EXPORTS,
  FORMATS,
  FORMAT_EXT,
  SCHEMA_VERSION,
  type Entry,
  type ExportKind,
  type ExportRef,
  type FileRef,
  type Format,
  type Manifest,
  type MissingExport,
  type SecretExclusion,
} from '../manifest.ts';
import { scanBinary, scanText } from '../secrets.ts';
import { humanize, isKebab, MetaError, parseExcalidraw, parseMarkdown, parseMermaid, summarize, type EntryMeta } from './parse.ts';
import { buildTopic, byCodePoint, deriveTopics } from './topics.ts';

export class IngestError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`ingest failed with ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.problems = problems;
  }
}

export interface IngestOptions {
  sourceDir: string;
  outDir: string;
}

export interface IngestResult {
  manifest: Manifest;
  excluded: SecretExclusion[];
  missingExports: MissingExport[];
}

interface Candidate {
  format: Format;
  srcPath: string;
  text: string;
  mtimeMs: number;
}

const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');
const posix = (p: string) => p.split(sep).join('/');

/** Physical path: realpath of the nearest existing ancestor plus the not-yet-existing tail (defeats symlinked components). */
function physicalPath(p: string): string {
  let existing = resolve(p);
  const tail: string[] = [];
  while (!existsSync(existing)) {
    tail.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync(existing), ...tail);
}

/**
 * The output dir is replaced wholesale, so refuse anything that is not clearly a snapshot location:
 * the working dir or any of its ancestors, the filesystem root, or an existing non-empty dir without a manifest.
 */
function assertSafeOutput(outDir: string): void {
  const out = physicalPath(outDir);
  const cwd = physicalPath(process.cwd());
  const rel = relative(out, cwd);
  if (out === dirname(out) || rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep))) {
    throw new IngestError([`refusing output dir ${outDir}: it is the working directory, one of its ancestors, or the filesystem root`]);
  }
  if (existsSync(out)) {
    if (!statSync(out).isDirectory()) throw new IngestError([`refusing output dir ${outDir}: it exists and is not a directory`]);
    if (readdirSync(out).length > 0 && !existsSync(join(out, 'manifest.json'))) {
      throw new IngestError([`refusing output dir ${outDir}: it is not empty and holds no manifest.json (not a content snapshot)`]);
    }
  }
}

function assertSeparate(sourceDir: string, outDir: string): void {
  const inside = (child: string, parent: string) => {
    const rel = relative(parent, child);
    return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && rel !== '..');
  };
  const src = physicalPath(sourceDir);
  // Every path ingest writes: the output, its staging dir and its backup dir.
  for (const target of [outDir, `${outDir}.tmp-ingest`, `${outDir}.bak-ingest`].map(physicalPath)) {
    if (inside(target, src) || inside(src, target)) {
      throw new IngestError([`output dir ${outDir} must not overlap the read-only source dir ${sourceDir}`]);
    }
  }
}

/** Only regular files are read; symlinks and special files are rejected so nothing outside INSTANTS is pulled in. */
function isRegularFile(p: string): boolean {
  return lstatSync(p).isFile();
}

function sourceInfo(sourceDir: string): Manifest['source'] {
  // Read-only git queries. --no-optional-locks stops `git status` from refreshing (writing) INSTANTS/.git/index.
  const git = (...args: string[]) =>
    execFileSync('git', ['--no-optional-locks', '-C', sourceDir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    }).trim();
  try {
    const [commit, committedAt] = git('log', '-1', '--format=%H %cI').split(' ');
    const dirty = git('status', '--porcelain', '--', ...FORMATS) !== '';
    return { commit, committedAt, dirty };
  } catch {
    return null;
  }
}

/** Reads INSTANTS read-only and writes a validated snapshot + manifest to `outDir` (replacing it). */
export function runIngest({ sourceDir: rawSource, outDir: rawOut }: IngestOptions): IngestResult {
  const sourceDir = resolve(rawSource);
  const outDir = resolve(rawOut);
  assertSeparate(sourceDir, outDir);
  assertSafeOutput(outDir);
  if (!existsSync(sourceDir)) throw new IngestError([`source dir not found: ${sourceDir}`]);

  const problems: string[] = [];
  const excluded: SecretExclusion[] = [];
  const groups = new Map<string, Partial<Record<Format, Candidate>>>();
  let scannedFiles = 0;

  // 1. Discover and secret-scan source files.
  for (const format of FORMATS) {
    const dir = join(sourceDir, format);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort(byCodePoint)) {
      if (name.startsWith('.')) continue;
      const rel = `${format}/${name}`;
      if (!name.endsWith(FORMAT_EXT[format])) {
        problems.push(`${rel}: unexpected file in ${format}/ (expected *${FORMAT_EXT[format]})`);
        continue;
      }
      const slug = name.slice(0, -FORMAT_EXT[format].length);
      if (!isKebab(slug)) {
        problems.push(`${rel}: name is not kebab-case`);
        continue;
      }
      const srcPath = join(dir, name);
      if (!isRegularFile(srcPath)) {
        problems.push(`${rel}: not a regular file (symlinks are not followed)`);
        continue;
      }
      const text = readFileSync(srcPath, 'utf8');
      scannedFiles += 1;
      const hits = scanText(text);
      if (hits.length > 0) {
        // Leave the file and its exports out; never record the matched value.
        excluded.push({ path: rel, rules: [...new Set(hits.map((h) => h.rule))].sort(byCodePoint) });
        continue;
      }
      const group = groups.get(slug) ?? {};
      group[format] = { format, srcPath, text, mtimeMs: statSync(srcPath).mtimeMs };
      groups.set(slug, group);
    }
  }

  // 2. Parse metadata (md → mermaid → excalidraw precedence; tags are the union).
  interface Parsed {
    slug: string;
    meta: EntryMeta;
    metadataFrom: Entry['metadataFrom'];
    summary: string | null;
    group: Partial<Record<Format, Candidate>>;
  }
  const parsed: Parsed[] = [];
  for (const [slug, group] of [...groups.entries()].sort((a, b) => byCodePoint(a[0], b[0]))) {
    try {
      const md = group.md ? parseMarkdown(group.md.text, `md/${slug}.md`) : null;
      const mmd = group.mermaid ? parseMermaid(group.mermaid.text, `mermaid/${slug}.mmd`) : null;
      const exc = group.excalidraw ? parseExcalidraw(group.excalidraw.text, `excalidraw/${slug}.excalidraw`) : null;
      const primary = md?.meta ?? mmd;
      const tags = [...new Set([...(md?.meta.tags ?? []), ...(mmd?.tags ?? [])])].sort(byCodePoint);
      parsed.push({
        slug,
        meta: {
          title: primary?.title ?? exc?.title ?? humanize(slug),
          tags,
          source: primary?.source ?? null,
          created: md?.meta.created ?? mmd?.created ?? null,
        },
        metadataFrom: md ? 'md' : mmd ? 'mermaid' : 'derived',
        summary: md ? summarize(md.body) : null,
        group,
      });
    } catch (err) {
      if (err instanceof MetaError) problems.push(err.message);
      else throw err;
    }
  }

  if (problems.length > 0) throw new IngestError(problems);

  // 3. Topics, tracks, roles and order — derived from names and tags only.
  const topicOf = deriveTopics(parsed.map((p) => ({ slug: p.slug, tags: p.meta.tags })));
  const topicSlugs = [...new Set(topicOf.values())].sort(byCodePoint);

  // 4. Build the snapshot in a temp dir, then swap it in.
  const tmpDir = `${outDir}.tmp-ingest`;
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  const copy = (from: string, rel: string): FileRef => {
    const buf = readFileSync(from);
    const dest = join(tmpDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    return { path: posix(rel), bytes: buf.length, sha256: sha256(buf) };
  };

  const missingExports: MissingExport[] = [];
  const exportProblems: string[] = [];
  const exportCounts: Record<ExportKind, number> = { png: 0, pdf: 0 };
  const fileCounts: Record<Format, number> = { md: 0, mermaid: 0, excalidraw: 0 };
  const entries: Entry[] = [];
  const topics = topicSlugs.map((topicSlug) => {
    const members = parsed.filter((p) => topicOf.get(p.slug) === topicSlug);
    const { topic, placements } = buildTopic(
      topicSlug,
      members.map((m) => ({ slug: m.slug, title: m.meta.title, tags: m.meta.tags })),
    );
    for (const m of members) {
      const place = placements.get(m.slug)!;
      const formats: Entry['formats'] = {};
      for (const format of FORMATS) {
        const cand = m.group[format];
        if (!cand) continue;
        fileCounts[format] += 1;
        const source = copy(cand.srcPath, join('files', format, `${m.slug}${FORMAT_EXT[format]}`));
        const exports: Partial<Record<ExportKind, ExportRef>> = {};
        for (const kind of EXPECTED_EXPORTS[format]) {
          const exp = join(sourceDir, 'out', format, `${m.slug}.${kind}`);
          if (!existsSync(exp)) {
            missingExports.push({ slug: m.slug, format, kind });
            continue;
          }
          const expRel = `out/${format}/${m.slug}.${kind}`;
          if (!isRegularFile(exp)) {
            exportProblems.push(`${expRel}: not a regular file (symlinks are not followed)`);
            continue;
          }
          // Exports are binary: raw bytes, inflated PDF streams and PNG text chunks are scanned.
          scannedFiles += 1;
          const expHits = scanBinary(readFileSync(exp));
          if (expHits.length > 0) {
            excluded.push({ path: expRel, rules: [...new Set(expHits.map((h) => h.rule))].sort(byCodePoint) });
            continue;
          }
          exportCounts[kind] += 1;
          exports[kind] = {
            ...copy(exp, join('exports', format, `${m.slug}.${kind}`)),
            freshness: statSync(exp).mtimeMs >= cand.mtimeMs ? 'fresh' : 'stale',
          };
        }
        formats[format] = { source, exports };
      }
      entries.push({
        slug: m.slug,
        title: m.meta.title,
        tags: m.meta.tags,
        source: m.meta.source,
        created: m.meta.created,
        summary: m.summary,
        topic: topicSlug,
        track: place.track,
        role: place.role,
        order: place.order,
        metadataFrom: m.metadataFrom,
        formats,
      });
    }
    return topic;
  });

  if (exportProblems.length > 0) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw new IngestError(exportProblems);
  }

  entries.sort((a, b) => byCodePoint(a.slug, b.slug));
  excluded.sort((a, b) => byCodePoint(a.path, b.path));
  missingExports.sort((a, b) => byCodePoint(`${a.slug}/${a.format}/${a.kind}`, `${b.slug}/${b.format}/${b.kind}`));

  const manifest: Manifest = {
    schemaVersion: SCHEMA_VERSION,
    source: sourceInfo(sourceDir),
    counts: { entries: entries.length, topics: topics.length, files: fileCounts, exports: exportCounts },
    topics,
    entries,
    missingExports,
    secretScan: { scannedFiles, excluded },
  };
  writeFileSync(join(tmpDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  // Swap: keep the previous snapshot as a backup until the new one is in place; restore it if promotion fails.
  const backup = `${outDir}.bak-ingest`;
  rmSync(backup, { recursive: true, force: true });
  if (existsSync(outDir)) renameSync(outDir, backup);
  try {
    renameSync(tmpDir, outDir);
  } catch (err) {
    if (existsSync(backup)) renameSync(backup, outDir);
    throw err;
  }
  rmSync(backup, { recursive: true, force: true });
  return { manifest, excluded, missingExports };
}
