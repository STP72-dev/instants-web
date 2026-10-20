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
