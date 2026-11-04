import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { applyAllowlist, globToRegExp, parseAllowlist, scanTree } from '../src/lib/publish-scan.ts';
import { PUBLISH_RULES, scanBinary, scanText, UNSCANNABLE } from '../src/lib/secrets.ts';
import { createZip } from '../src/lib/zip.ts';

// Fixtures are assembled from pieces so this file never contains a literal secret, address or path itself.
const FIXTURES: Record<string, string> = {
  'private-key': '-----BEGIN ' + 'RSA PRIVATE KEY-----',
  'aws-access-key': 'AKIA' + 'ABCDEFGHIJKLMNOP',
  'github-token': 'ghp_' + 'a'.repeat(36),
  'github-installation-token': 'ghs_' + '12345_' + 'eyJ' + 'hbGciOiJSUzI1NiJ9.eyJpc3MiOjF9.sig',
  'openai-key': 'sk-' + 'A'.repeat(40),
  'anthropic-key': 'sk-' + 'ant-' + 'b'.repeat(30),
  'google-api-key': 'AIza' + 'C'.repeat(35),
  'slack-token': 'xoxb-' + '1234567890ab',
  'stripe-key': 'sk_' + 'live_' + 'D'.repeat(24),
  'vercel-token': 'vercel_' + 'E'.repeat(24),
  jwt: 'eyJ' + 'hbGciOiJIUzI1' + '.eyJ' + 'zdWIiOiIxMjM0' + '.' + 'abcdefghijkl',
  'credential-assignment': 'OPENROUTER_API_KEY' + '=' + 'abcd1234efgh5678ijkl',
  'email-address': 'jane.doe' + '@' + 'example.org',
  'home-path': '/ho' + 'me/alice/notes.md',
};

const CLEAN = [
  'Rotate the API key after a leak. API_KEY=${API_KEY}',
  'Assets: icon@2x.png and logo@3x.webp',
  'Paths: ~/work/repo, ./home/page, https://example.org/Users',
  'mGF Monk v5.1 — HIGH coverage 91,2%, nem kereskedési jelzés.',
].join('\n');

const tmp = () => mkdtempSync(join(tmpdir(), 'iweb-publish-'));

describe('publish rules', () => {
  it('have a must-fail fixture for every rule', () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(PUBLISH_RULES.map((r) => r.id).sort());
  });

  it.each(Object.entries(FIXTURES))('flag %s in a text file of a scanned tree', (rule, sample) => {
    const dir = tmp();
    writeFileSync(join(dir, 'entry.md'), `# Title\n\nsee ${sample} here\n`);
    expect(scanTree(dir, 'site').findings).toContainEqual({ path: 'site/entry.md', line: 3, rule });
  });

  it('pass a clean tree', () => {
    const dir = tmp();
    mkdirSync(join(dir, 'files'));
    writeFileSync(join(dir, 'files', 'clean.md'), CLEAN);
    expect(scanTree(dir, 'site')).toEqual({ scanned: 1, findings: [] });
  });

  it('keep personal-data rules out of the default (commit diff) rule set', () => {
    expect(scanText(FIXTURES['email-address'])).toEqual([]);
    expect(scanText(FIXTURES['email-address'], PUBLISH_RULES).map((h) => h.rule)).toEqual(['email-address']);
  });
});

describe('binary files in the published tree', () => {
  it('find a token inside a deflated ZIP entry and an address inside a stored PDF entry', () => {
    const pdfBody = deflateSync(Buffer.from(`BT (Author ${FIXTURES['email-address']} wrote this page) Tj ET`));
    const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj <</Filter /FlateDecode>> stream\n'), pdfBody, Buffer.from('\nendstream\nendobj\n')]);
    const zip = Buffer.from(
      createZip([
        { name: 'md/a.md', data: Buffer.from(`# a\n\n${'filler '.repeat(50)}${FIXTURES['github-token']}\n`) },
        { name: 'exports/a.pdf', data: pdf },
      ]),
    );
    const rules = scanBinary(zip, PUBLISH_RULES).map((h) => h.rule);
    expect(rules).toContain('github-token');
    expect(rules).toContain('email-address');
  });

  it('fail closed on ZIP entries it cannot read (data descriptor flag)', () => {
    const zip = Buffer.from(createZip([{ name: 'a.md', data: Buffer.from('hello world, hello world, hello world') }]));
    zip.writeUInt16LE(zip.readUInt16LE(6) | 0x8, 6);
    expect(scanBinary(zip, PUBLISH_RULES)).toEqual([{ rule: UNSCANNABLE, line: 0 }]);
  });

  it('ignore address-shaped noise in compressed bytes (no readable run)', () => {
    const noise = Buffer.from([0x01, 0x52, 0x40, 0x71, 0x2e, 0x4c, 0x78, 0x02, 0xff, 0x00]); // "\x01R@q.Lx\x02"
    expect(scanBinary(Buffer.concat([Buffer.from('%PNG-ish'), noise]), PUBLISH_RULES)).toEqual([]);
  });

  it('scan a ZIP of the clean fixture as clean', () => {
    const zip = Buffer.from(createZip([{ name: 'clean.md', data: Buffer.from(CLEAN) }]));
    expect(scanBinary(zip, PUBLISH_RULES)).toEqual([]);
  });
});

describe('allowlist', () => {
  it('matches globs segment-wise', () => {
    expect(globToRegExp('*/_astro/**').test('dist/_astro/a/b.js')).toBe(true);
    expect(globToRegExp('*/_astro/excalidraw.*.js').test('site/_astro/excalidraw.AbC1.js')).toBe(true);
    expect(globToRegExp('*/_astro/*.js').test('dist/files/_astro/a.js')).toBe(false);
  });

  it('silences only the listed rule on the listed paths', () => {
    const allow = [{ path: '*/_astro/**', rule: 'credential-assignment', reason: 'vendor bundles' }];
    const findings = [
      { path: 'dist/_astro/x.js', line: 1, rule: 'credential-assignment' },
      { path: 'dist/_astro/x.js', line: 2, rule: 'github-token' },
      { path: 'dist/entries/a/index.html', line: 3, rule: 'credential-assignment' },
    ];
    expect(applyAllowlist(findings, allow)).toEqual({ kept: findings.slice(1), allowed: findings.slice(0, 1) });
  });

  it('rejects entries without a reason', () => {
    expect(() => parseAllowlist('{"allow":[{"path":"*","rule":"jwt","reason":" "}]}')).toThrow(/reason/);
    expect(() => parseAllowlist('{"nope":[]}')).toThrow(/allow/);
  });

  it('the committed allowlist parses and every entry names a known rule', () => {
    const allow = parseAllowlist(readFileSync(join(import.meta.dirname, '..', 'publish-scan.allow.json'), 'utf8'));
    const ids = new Set(PUBLISH_RULES.map((r) => r.id));
    expect(allow.every((a) => ids.has(a.rule))).toBe(true);
  });
});

describe('scripts/scan-publish.ts', () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [join(import.meta.dirname, '..', 'scripts', 'scan-publish.ts'), ...args], { encoding: 'utf8' });

  it('exits 1 with file, line and rule — never the value', () => {
    const dir = tmp();
    writeFileSync(join(dir, 'page.html'), `<p>${FIXTURES['github-token']}</p>`);
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/page\.html:1 github-token/);
    expect(res.stderr).not.toContain(FIXTURES['github-token']);
  });

  it('exits 0 on a clean tree and 1 on an empty or missing one', () => {
    const clean = tmp();
    writeFileSync(join(clean, 'a.md'), CLEAN);
    expect(run(clean).status).toBe(0);
    expect(run(tmp()).status).toBe(1);
    expect(run(join(clean, 'missing')).status).toBe(1);
  });
});
