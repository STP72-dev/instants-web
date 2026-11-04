import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLISH_RULES, scanBinary, scanText } from './secrets.ts';

/**
 * Publish scan (issue #37): everything the public site serves — the content snapshot and the built site — must carry
 * no secret and no personal data (DECISIONS.md D11). Findings name file, line and rule, never the matched value.
 */
export interface PublishFinding {
  path: string;
  line: number;
  rule: string;
}

/** A reviewed false positive: `path` is a glob (`*` within a segment, `**` across segments), `rule` a rule id. */
export interface AllowEntry {
  path: string;
  rule: string;
  reason: string;
}

/** Formats whose text is compressed or embedded; scanned through `scanBinary` (fails closed when it cannot decode). */
export const BINARY_EXTENSIONS = new Set(['png', 'pdf', 'zip', 'webp', 'jpg', 'jpeg', 'gif', 'avif', 'ico', 'woff', 'woff2', 'ttf', 'otf']);

export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i += 1;
      if (glob[i + 1] === '/') i += 1;
    } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** Validates the allowlist shape; every entry needs a non-empty reason, so nothing is silenced without review. */
export function parseAllowlist(json: string): AllowEntry[] {
  const data = JSON.parse(json) as { allow?: unknown };
  if (!Array.isArray(data.allow)) throw new Error('allowlist: expected {"allow": [...]}');
  return data.allow.map((e, i) => {
    const entry = e as Partial<AllowEntry>;
    for (const key of ['path', 'rule', 'reason'] as const) {
      if (typeof entry[key] !== 'string' || entry[key].trim() === '') throw new Error(`allowlist entry ${i}: "${key}" must be a non-empty string`);
    }
    return entry as AllowEntry;
  });
}

function walk(dir: string, prefix: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const abs = join(dir, name);
      return statSync(abs).isDirectory() ? walk(abs, `${prefix}${name}/`) : [`${prefix}${name}`];
    });
}

/** Scans every file under `root`; paths in findings are `<label>/<relative path>`. */
export function scanTree(root: string, label: string): { scanned: number; findings: PublishFinding[] } {
  const files = walk(root, '');
  const findings: PublishFinding[] = [];
  for (const rel of files) {
    const buf = readFileSync(join(root, rel));
    const ext = rel.split('.').pop()?.toLowerCase() ?? '';
    const hits = BINARY_EXTENSIONS.has(ext) ? scanBinary(buf, PUBLISH_RULES) : scanText(buf.toString('utf8'), PUBLISH_RULES);
    for (const h of hits) findings.push({ path: `${label}/${rel}`, line: h.line, rule: h.rule });
  }
  return { scanned: files.length, findings };
}

export function applyAllowlist(findings: PublishFinding[], allow: AllowEntry[]): { kept: PublishFinding[]; allowed: PublishFinding[] } {
  const matchers = allow.map((a) => ({ path: globToRegExp(a.path), rule: a.rule }));
  const kept: PublishFinding[] = [];
  const allowed: PublishFinding[] = [];
  for (const f of findings) (matchers.some((m) => m.rule === f.rule && m.path.test(f.path)) ? allowed : kept).push(f);
  return { kept, allowed };
}
