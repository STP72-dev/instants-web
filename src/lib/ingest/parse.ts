import { parse as parseYaml } from 'yaml';

export interface EntryMeta {
  title: string;
  tags: string[];
  source: string | null;
  created: string | null;
}

export class MetaError extends Error {}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isKebab(name: string): boolean {
  return KEBAB.test(name);
}

function normTags(raw: unknown, where: string): string[] {
  const list = typeof raw === 'string' ? raw.split(',') : raw;
  if (!Array.isArray(list) || list.some((t) => typeof t !== 'string' && typeof t !== 'number')) {
    throw new MetaError(`${where}: "tags" must be a list of strings`);
  }
  const tags = list.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (tags.length === 0) throw new MetaError(`${where}: "tags" is empty`);
  return [...new Set(tags)].sort();
}

function requireString(value: unknown, key: string, where: string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string' || value.trim() === '') throw new MetaError(`${where}: missing "${key}"`);
  return value.trim();
}

function optionalDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return null;
}

/** Splits `---` YAML frontmatter from a Markdown file. */
export function parseMarkdown(text: string, where: string): { meta: EntryMeta; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) throw new MetaError(`${where}: missing YAML frontmatter`);
  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch (err) {
    throw new MetaError(`${where}: invalid frontmatter YAML (${(err as Error).message.split('\n')[0]})`);
  }
  if (!data || typeof data !== 'object') throw new MetaError(`${where}: frontmatter is not a mapping`);
  const fm = data as Record<string, unknown>;
  return {
    meta: {
      title: requireString(fm.title, 'title', where),
      tags: normTags(fm.tags, where),
      source: requireString(fm.source, 'source', where),
      created: optionalDate(fm.created),
    },
    body: text.slice(match[0].length),
  };
}

/** Reads `%% title:` / `%% tags:` / `%% source:` header comments from a Mermaid file. */
export function parseMermaid(text: string, where: string): EntryMeta {
  const fields: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^\s*%%\s*(title|tags|source|created)\s*:\s*(.*?)\s*$/i.exec(line);
    if (m && !(m[1].toLowerCase() in fields)) fields[m[1].toLowerCase()] = m[2];
  }
  return {
    title: requireString(fields.title, 'title', where),
    tags: normTags(requireString(fields.tags, 'tags', where), where),
    source: requireString(fields.source, 'source', where),
    created: optionalDate(fields.created),
  };
}

interface ExcalidrawElement {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  isDeleted?: unknown;
}

/** Validates an Excalidraw scene; returns the text of an element with id "title", if any. */
export function parseExcalidraw(text: string, where: string): { title: string | null } {
  let scene: unknown;
  try {
    scene = JSON.parse(text);
  } catch (err) {
    throw new MetaError(`${where}: invalid JSON (${(err as Error).message})`);
  }
  const s = scene as { type?: unknown; elements?: unknown };
  if (!s || typeof s !== 'object' || s.type !== 'excalidraw' || !Array.isArray(s.elements)) {
    throw new MetaError(`${where}: not an Excalidraw scene (needs "type": "excalidraw" and an "elements" array)`);
  }
  const titleEl = (s.elements as ExcalidrawElement[]).find(
    (el) => el && el.id === 'title' && el.type === 'text' && !el.isDeleted && typeof el.text === 'string',
  );
  const title = typeof titleEl?.text === 'string' ? titleEl.text.replace(/\s+/g, ' ').trim() : '';
  return { title: title || null };
}

/** First prose paragraph of a Markdown body, stripped of inline markup, max ~220 chars. */
export function summarize(body: string): string | null {
  const blocks = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s.*$/gm, '')
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim().replace(/^>\s?/gm, ''))
    .filter((b) => b && !/^(#|\||[-*+] |\d+\. |<|!\[)/.test(b));
  if (blocks.length === 0) return null;
  const text = blocks[0]
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).replace(/\s+\S*$/, '')}…`;
}

/** "claude-code" → "Claude Code", "ai" → "AI". */
export function humanize(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}
