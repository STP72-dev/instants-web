import { describe, expect, it } from 'vitest';
import { scanText } from '../src/lib/secrets.ts';

describe('scanText', () => {
  it('flags a GitHub token and reports its line, not its value', () => {
    const hits = scanText(`ok\ntoken ghp_${'a'.repeat(36)}\n`);
    expect(hits).toEqual([{ rule: 'github-token', line: 2 }]);
  });

  it('flags a stateless GitHub installation token', () => {
    const token = 'ghs_' + '12345_' + 'eyJ' + 'hbGciOiJSUzI1NiJ9.eyJpc3MiOjF9.sig';
    expect(scanText(token).map((h) => h.rule)).toContain('github-installation-token');
  });

  it('flags credential assignments', () => {
    expect(scanText('OPENROUTER_API_KEY' + '=' + 'abcd1234efgh5678ijkl').map((h) => h.rule)).toContain('credential-assignment');
  });

  it('ignores placeholders and prose about secrets', () => {
    expect(scanText('API_KEY=${API_KEY}\nAPI_KEY=<your-key>\nRotate the API key after a leak.')).toEqual([]);
  });
});
