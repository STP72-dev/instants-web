import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildConfig, writeVercelOutput, type Route } from '../scripts/vercel-output.ts';

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name), base) : [join(dir, e.name).slice(base.length + 1)],
  );
}

describe('buildConfig', () => {
  const { version, routes } = buildConfig();
  const find = (pred: (r: Route) => boolean) => routes.findIndex(pred);

  it('is Build Output API v3', () => {
    expect(version).toBe(3);
  });

  it('sets the content types from the URL contract', () => {
    const type = (ext: string) => routes.find((r) => r.src === `/.*\\.${ext}$`)?.headers?.['Content-Type'];
    expect(type('md')).toBe('text/markdown; charset=utf-8');
    expect(type('mmd')).toBe('text/plain; charset=utf-8');
    expect(type('excalidraw')).toBe('application/vnd.excalidraw+json');
  });

  it('mirrors the nginx security headers and has no CSP yet', () => {
    const headers = routes[0]?.headers ?? {};
    expect(headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
    });
    expect(JSON.stringify(routes)).not.toMatch(/content-security-policy/i);
  });

  it('forces attachment only for /downloads/<topic>.zip', () => {
    const route = routes.find((r) => r.headers?.['Content-Disposition'] === 'attachment');
    const re = new RegExp(route?.src ?? '');
    expect(re.test('/downloads/music.zip')).toBe(true);
    expect(re.test('/files/md/a.md')).toBe(false);
    expect(re.test('/exports/md/a.zip')).toBe(false);
    expect(re.test('/downloads/a/b.zip')).toBe(false);
  });

  it('keeps route order: generic no-cache before immutable, headers before filesystem, 404 last', () => {
    const generic = find((r) => r.src === '/(.*)' && r.headers?.['Cache-Control'] === 'no-cache');
    const immutable = find((r) => r.src === '/_astro/(.*)');
    const fs = find((r) => r.handle === 'filesystem');
    expect(routes[immutable]?.headers?.['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(generic).toBeGreaterThanOrEqual(0);
    expect(generic).toBeLessThan(immutable);
    for (const r of routes.slice(0, fs).filter((x) => x.continue)) expect(routes.indexOf(r)).toBeLessThan(fs);
    expect(routes.slice(0, fs).every((r) => r.continue || r.status === 301)).toBe(true);
    expect(routes.at(-2)).toEqual({ handle: 'filesystem' });
    expect(routes.at(-1)).toEqual({ src: '/.*', status: 404, dest: '/404.html' });
  });

  it('redirects only dot-less paths without a trailing slash', () => {
    const route = routes.find((r) => r.status === 301);
    const re = new RegExp(route?.src ?? '');
    expect(re.test('/topics/x')).toBe(true);
    expect(re.test('/topics/x/')).toBe(false);
    expect(re.test('/')).toBe(false);
    expect(re.test('/search-index.json')).toBe(false);
    expect(re.test('/_astro/app.abc.css')).toBe(false);
    expect('/topics/x'.replace(re, route?.headers?.Location ?? '')).toBe('/topics/x/');
  });
});

describe('writeVercelOutput', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vercel-output-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function makeDist(): string {
    const dist = join(root, 'dist');
    mkdirSync(join(dist, '_astro'), { recursive: true });
    mkdirSync(join(dist, 'topics', 'x'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<h1>home</h1>\n');
    writeFileSync(join(dist, '404.html'), '<h1>404</h1>\n');
    writeFileSync(join(dist, 'topics', 'x', 'index.html'), '<h1>x</h1>\n');
    writeFileSync(join(dist, '_astro', 'app.abc.css'), 'body{}');
    writeFileSync(join(dist, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x0d, 0x0a]));
    return dist;
  }

  it('writes config.json and a byte-identical static/ copy', () => {
    const dist = makeDist();
    const out = join(root, 'out');
    writeVercelOutput(dist, out);

    expect(JSON.parse(readFileSync(join(out, 'config.json'), 'utf8'))).toEqual(buildConfig());
    const files = listFiles(dist).sort();
    expect(listFiles(join(out, 'static')).sort()).toEqual(files);
    for (const f of files) {
      expect(readFileSync(join(out, 'static', f)).equals(readFileSync(join(dist, f)))).toBe(true);
    }
  });

  it('replaces stale output instead of merging into it', () => {
    const dist = makeDist();
    const out = join(root, 'out');
    mkdirSync(join(out, 'static'), { recursive: true });
    writeFileSync(join(out, 'static', 'stale.html'), 'old');
    writeVercelOutput(dist, out);
    expect(listFiles(join(out, 'static'))).not.toContain('stale.html');
  });

  it('refuses a missing dist, an empty site and nested directories', () => {
    expect(() => writeVercelOutput(join(root, 'nope'), join(root, 'out'))).toThrow(/not found/);
    mkdirSync(join(root, 'empty'));
    expect(() => writeVercelOutput(join(root, 'empty'), join(root, 'out'))).toThrow(/index\.html/);
    const dist = makeDist();
    expect(() => writeVercelOutput(dist, dist)).toThrow(/nested/);
    expect(() => writeVercelOutput(dist, join(dist, 'out'))).toThrow(/nested/);
  });
});
