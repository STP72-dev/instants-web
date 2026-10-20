import { inflateSync } from 'node:zlib';

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
export function scanText(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  text.split('\n').forEach((line, i) => {
    const parts = windows(line);
    for (const rule of SECRET_RULES) {
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

function inflateBounded(bytes: Buffer, budget: { left: number }): string {
  let out: Buffer;
  try {
    out = inflateSync(bytes, { maxOutputLength: Math.min(BINARY_LIMITS.maxInflated, budget.left) });
  } catch {
    throw new Unscannable();
  }
  budget.left -= out.length;
  return out.toString('latin1');
}

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

/** Text a binary export can carry: raw bytes, inflated PDF streams, PNG compressed text chunks. Throws Unscannable. */
export function binaryTexts(buf: Buffer): string[] {
  if (buf.length > BINARY_LIMITS.maxInput) throw new Unscannable();
  const budget = { left: BINARY_LIMITS.maxTotalInflated };
  const texts = [buf.toString('latin1')];
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') texts.push(...pdfStreamTexts(buf, budget));
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) texts.push(...pngTexts(buf, budget));
  return texts;
}

/** Secret scan for binary files (exports). A file that cannot be fully scanned yields an `unscannable-content` hit. */
export function scanBinary(buf: Buffer): SecretHit[] {
  try {
    return binaryTexts(buf).flatMap((t) => scanText(t));
  } catch (err) {
    if (err instanceof Unscannable) return [{ rule: UNSCANNABLE, line: 0 }];
    throw err;
  }
}
