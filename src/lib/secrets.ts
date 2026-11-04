import { inflateRawSync, inflateSync } from 'node:zlib';

/** Secret patterns shared by the ingest snapshot scan and the pre-push diff scan. */
export interface SecretRule {
  id: string;
  pattern: RegExp;
}

export const SECRET_RULES: readonly SecretRule[] = [
  { id: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: 'github-token', pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { id: 'github-installation-token', pattern: /\bghs_\d+_eyJ[A-Za-z0-9_-]{10,}/ },
  { id: 'openai-key', pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/ },
  { id: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { id: 'google-api-key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'slack-token', pattern: /\bxox[abpors]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'stripe-key', pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/ },
  { id: 'vercel-token', pattern: /\bvercel_[A-Za-z0-9]{24,}\b/i },
  { id: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    // KEY=value / key: "value" assignments with a credential-like name and a non-placeholder value.
    id: 'credential-assignment',
    pattern:
      /\b[A-Z0-9_]*(?:API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD)[A-Z0-9_]*\s*[:=]\s*["']?(?!\$\{|<|your|xxx|\*{3}|changeme|example|placeholder|\.\.\.)[A-Za-z0-9/+_.-]{12,}/i,
  },
];

/**
 * Personal data that must never reach the public site (DECISIONS.md D11). Only the publish scan uses these;
 * the commit diff scan keeps SECRET_RULES, because code and docs may legitimately mention addresses or paths.
 */
export const PII_RULES: readonly SecretRule[] = [
  // The domain must start with a letter, so asset names such as "icon@2x.png" do not match.
  { id: 'email-address', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/ },
  { id: 'home-path', pattern: /\/home\/[a-z_][a-z0-9_-]*\/|\/Users\/[^/\s"'`]+\/|\b[A-Za-z]:\\Users\\[^\\\s"'`]+/ },
];

/** Everything that is published (content snapshot, built site): secrets + personal data. */
export const PUBLISH_RULES: readonly SecretRule[] = [...SECRET_RULES, ...PII_RULES];

export interface SecretHit {
  rule: string;
  line: number;
}

/** Long lines are scanned in overlapping windows so one huge binary "line" cannot cause super-linear regex work. */
const WINDOW = 4096;
const OVERLAP = 256;

function windows(line: string): string[] {
  if (line.length <= WINDOW) return [line];
  const out: string[] = [];
  for (let i = 0; i < line.length; i += WINDOW - OVERLAP) out.push(line.slice(i, i + WINDOW));
  return out;
}

/** Returns every rule hit in `text` (1-based line numbers). Never returns the matched value. */
export function scanText(text: string, rules: readonly SecretRule[] = SECRET_RULES): SecretHit[] {
  const hits: SecretHit[] = [];
  text.split('\n').forEach((line, i) => {
    const parts = windows(line);
    for (const rule of rules) {
      if (parts.some((part) => rule.pattern.test(part))) hits.push({ rule: rule.id, line: i + 1 });
    }
  });
  return hits;
}

/** Limits for binary scanning; exceeding them is reported as a finding (fail closed), never treated as clean. */
export const BINARY_LIMITS = { maxInput: 64 * 1024 * 1024, maxInflated: 32 * 1024 * 1024, maxTotalInflated: 128 * 1024 * 1024 };

/** Rule id reported when a binary cannot be fully scanned. */
export const UNSCANNABLE = 'unscannable-content';

class Unscannable extends Error {}

function inflateBuffer(bytes: Buffer, budget: { left: number }, raw = false): Buffer {
  let out: Buffer;
  try {
    const opts = { maxOutputLength: Math.min(BINARY_LIMITS.maxInflated, budget.left) };
    out = raw ? inflateRawSync(bytes, opts) : inflateSync(bytes, opts);
  } catch {
    throw new Unscannable();
  }
  budget.left -= out.length;
  return out;
}

const inflateBounded = (bytes: Buffer, budget: { left: number }): string => inflateBuffer(bytes, budget).toString('latin1');

const IMAGE_FILTERS = new Set(['DCTDecode', 'JPXDecode', 'CCITTFaxDecode', 'JBIG2Decode', 'RunLengthDecode']);

/**
 * PDF streams: the length comes from a direct /Length in the stream dictionary (else the next "endstream").
 * FlateDecode-only streams are inflated (failure → unscannable); image codecs are skipped; any other filter chain
 * (ASCII85, ASCIIHex, LZW, …) is unscannable.
 */
function pdfStreamTexts(buf: Buffer, budget: { left: number }): string[] {
  const raw = buf.toString('latin1');
  const texts: string[] = [];
  // A stream keyword directly follows its dictionary's ">>" (this also skips the "stream" inside "endstream").
  const re = /(?<=>>[ \t\r\n]{0,4})stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const dictStart = raw.lastIndexOf('<<', m.index);
    const dict = dictStart >= 0 ? raw.slice(dictStart, m.index) : '';
    const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    const end = len ? start + Number(len[1]) : raw.indexOf('endstream', start);
    if (end < start || end > raw.length) throw new Unscannable();
    const filters = [...dict.matchAll(/\/(\w+Decode)\b/g)].map((f) => f[1]);
    const body = buf.subarray(start, end);
    if (filters.length === 0) texts.push(body.toString('latin1'));
    else if (filters.every((f) => f === 'FlateDecode')) texts.push(inflateBounded(body, budget));
    else if (!filters.every((f) => IMAGE_FILTERS.has(f))) throw new Unscannable();
    re.lastIndex = end;
  }
  return texts;
}

/** PNG: zTXt is always compressed, iTXt when its compression flag is set; tEXt is covered by the raw-bytes scan. */
function pngTexts(buf: Buffer, budget: { left: number }): string[] {
  const texts: string[] = [];
  for (let off = 8; off + 12 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('latin1');
    const data = buf.subarray(off + 8, off + 8 + len);
    const nul = data.indexOf(0);
    if (type === 'zTXt' && nul >= 0) texts.push(inflateBounded(data.subarray(nul + 2), budget));
    else if (type === 'iTXt' && nul >= 0 && data[nul + 1] === 1) {
      // keyword\0 flag method language\0 translated\0 text
      const lang = data.indexOf(0, nul + 3);
      const translated = lang >= 0 ? data.indexOf(0, lang + 1) : -1;
      if (translated < 0) throw new Unscannable();
      texts.push(inflateBounded(data.subarray(translated + 1), budget));
    }
    off += 12 + len;
  }
  return texts;
}

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_END = 0x06054b50;

/**
 * ZIP (topic downloads): walk the local file headers and return each entry's uncompressed bytes. Stored (0) and
 * deflated (8) entries only; data descriptors, other methods, truncated entries or an unknown record → unscannable.
 */
function zipEntries(buf: Buffer, budget: { left: number }): Buffer[] {
  const out: Buffer[] = [];
  let off = 0;
  while (off + 4 <= buf.length && buf.readUInt32LE(off) === ZIP_LOCAL) {
    if (off + 30 > buf.length) throw new Unscannable();
    const flags = buf.readUInt16LE(off + 6);
    const method = buf.readUInt16LE(off + 8);
    const size = buf.readUInt32LE(off + 18);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const end = start + size;
    if (flags & 0x8 || end > buf.length || (method !== 0 && method !== 8)) throw new Unscannable();
    const body = buf.subarray(start, end);
    out.push(method === 8 ? inflateBuffer(body, budget, true) : body);
    off = end;
  }
  if (off + 4 > buf.length || ![ZIP_CENTRAL, ZIP_END].includes(buf.readUInt32LE(off))) throw new Unscannable();
  return out;
}

function expand(buf: Buffer, budget: { left: number }, depth: number): string[] {
  const texts = [buf.toString('latin1')];
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') texts.push(...pdfStreamTexts(buf, budget));
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) texts.push(...pngTexts(buf, budget));
  if (buf.length >= 4 && buf.readUInt32LE(0) === ZIP_LOCAL) {
    if (depth > 0) throw new Unscannable(); // no nested archives
    for (const entry of zipEntries(buf, budget)) texts.push(...expand(entry, budget, depth + 1));
  }
  return texts;
}

/**
 * Text a binary file can carry: raw bytes, inflated PDF streams, PNG compressed text chunks, and the entries of a
 * ZIP (each expanded the same way). Throws Unscannable.
 */
export function binaryTexts(buf: Buffer): string[] {
  if (buf.length > BINARY_LIMITS.maxInput) throw new Unscannable();
  return expand(buf, { left: BINARY_LIMITS.maxTotalInflated }, 0);
}

const PII_IDS = new Set(PII_RULES.map((r) => r.id));
const MIN_READABLE_RUN = 16;

/**
 * Readable text runs (UTF-8, no control bytes, ≥ 16 chars) of a decoded binary. PII rules are short patterns that random
 * compressed or pixel bytes can hit by chance (e.g. a 6-char "x@y.zz" inside a ZIP), so they only see these runs; a real
 * address in PDF metadata or a text entry sits in such a run.
 */
function readableRuns(latin1: string): string {
  return new TextDecoder()
    .decode(Buffer.from(latin1, 'latin1'))
    .split(/[�\u0000-\u0008\u000E-\u001F\u007F]+/)
    .filter((s) => s.length >= MIN_READABLE_RUN)
    .join('\n');
}

/**
 * Secret scan for binary files (exports, downloads, images, fonts). A file that cannot be fully scanned yields an
 * `unscannable-content` hit. PII hits inside binaries report line 0 (the runs have no stable line numbers).
 */
export function scanBinary(buf: Buffer, rules: readonly SecretRule[] = SECRET_RULES): SecretHit[] {
  const nonPiiRules = rules.filter((r) => !PII_IDS.has(r.id));
  const piiRules = rules.filter((r) => PII_IDS.has(r.id));
  try {
    const texts = binaryTexts(buf);
    const hits = texts.flatMap((t) => scanText(t, nonPiiRules));
    if (piiRules.length > 0) {
      for (const t of texts) hits.push(...scanText(readableRuns(t), piiRules).map((h) => ({ rule: h.rule, line: 0 })));
    }
    return hits;
  } catch (err) {
    if (err instanceof Unscannable) return [{ rule: UNSCANNABLE, line: 0 }];
    throw err;
  }
}
