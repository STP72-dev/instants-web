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

import { inflateSync } from 'node:zlib';

/** Returns every rule hit in `text` (1-based line numbers). Never returns the matched value. */
export function scanText(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of SECRET_RULES) {
      if (rule.pattern.test(line)) hits.push({ rule: rule.id, line: i + 1 });
    }
  });
  return hits;
}

function tryInflate(bytes: Buffer): string | null {
  try {
    return inflateSync(bytes).toString('latin1');
  } catch {
    return null;
  }
}

/** Text a binary export can carry: raw bytes, inflated PDF streams, and PNG tEXt / zTXt / iTXt chunks. */
export function binaryTexts(buf: Buffer): string[] {
  const texts = [buf.toString('latin1')];
  // PDF: inflate every stream body (FlateDecode); non-deflate streams simply fail to inflate.
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    const raw = texts[0];
    const re = /stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const start = m.index + m[0].length;
      const end = raw.indexOf('endstream', start);
      if (end < 0) break;
      const inflated = tryInflate(buf.subarray(start, end));
      if (inflated) texts.push(inflated);
      re.lastIndex = end;
    }
  }
  // PNG: walk chunks; zTXt is always compressed, iTXt when its compression flag is set.
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) {
    for (let off = 8; off + 12 <= buf.length; ) {
      const len = buf.readUInt32BE(off);
      const type = buf.subarray(off + 4, off + 8).toString('latin1');
      const data = buf.subarray(off + 8, off + 8 + len);
      const nul = data.indexOf(0);
      if (type === 'zTXt' && nul >= 0) {
        const t = tryInflate(data.subarray(nul + 2));
        if (t) texts.push(t);
      } else if (type === 'iTXt' && nul >= 0 && data[nul + 1] === 1) {
        // keyword\0 flag method language\0 translated\0 text
        const lang = data.indexOf(0, nul + 3);
        const translated = lang >= 0 ? data.indexOf(0, lang + 1) : -1;
        const t = translated >= 0 ? tryInflate(data.subarray(translated + 1)) : null;
        if (t) texts.push(t);
      }
      off += 12 + len;
    }
  }
  return texts;
}

/** Secret scan for binary files (exports): raw bytes plus every compressed text payload. */
export function scanBinary(buf: Buffer): SecretHit[] {
  return binaryTexts(buf).flatMap((t) => scanText(t));
}
