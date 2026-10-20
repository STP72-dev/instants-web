import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  buildConfig,
  buildCsp,
  inlineScriptHashes,
  nginxCspInclude,
  PERMISSIONS_POLICY,
  writeVercelOutput,
  type OutputConfig,
  type Route,
} from '../scripts/vercel-output.ts';

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

  it('mirrors the nginx security headers', () => {
    const headers = routes[0]?.headers ?? {};
    expect(headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN',
    });
  });

  it('sends the CSP and Permissions-Policy on every response, with the hashes it is given', () => {
    const hash = "'sha256-abc='";
    const headers = buildConfig([hash]).routes[0]?.headers ?? {};
    expect(headers['Content-Security-Policy']).toBe(buildCsp([hash]));
    expect(headers['Permissions-Policy']).toBe(PERMISSIONS_POLICY);
    expect(routes[0]?.src).toBe('/(.*)');
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

describe('Content-Security-Policy', () => {
  const directive = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `));

  it('is strict for scripts: self plus hashes, never inline or eval', () => {
    const csp = buildCsp(["'sha256-aaa='", "'sha256-bbb='"]);
    expect(directive(csp, 'script-src')).toBe("script-src 'self' 'sha256-aaa=' 'sha256-bbb='");
    expect(csp).not.toMatch(/unsafe-eval|wasm-unsafe-eval/);
    expect(directive(csp, 'script-src')).not.toContain('unsafe-inline');
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
  });

  it('allows only same-origin (plus data:/blob: where the libraries need them) and no external hosts', () => {
    const csp = buildCsp();
    expect(csp).not.toMatch(/https?:|\*/);
    expect(directive(csp, 'img-src')).toBe("img-src 'self' data: blob:");
    expect(directive(csp, 'font-src')).toBe("font-src 'self' data:");
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self'");
    expect(directive(csp, 'worker-src')).toBe("worker-src 'self' blob:");
    expect(directive(csp, 'object-src')).toBe("object-src 'self'");
    expect(directive(csp, 'frame-src')).toBe("frame-src 'self'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'form-action')).toBe("form-action 'self'");
  });

  it('hashes every distinct inline script (not external ones) from the built HTML', () => {
    const root = mkdtempSync(join(tmpdir(), 'csp-hash-'));
    try {
      const body = 'document.title = `x`;';
      mkdirSync(join(root, 'a'), { recursive: true });
      writeFileSync(join(root, 'index.html'), `<script type="module">${body}</script><script type="module" src="/_astro/a.js"></script>`);
      writeFileSync(join(root, 'a', 'index.html'), `<script type="module">${body}</script><script>other()</script><script></script>`);
      const sha = (t: string) => `'sha256-${createHash('sha256').update(t).digest('base64')}'`;
      expect(inlineScriptHashes(root)).toEqual([sha(body), sha('other()')].sort());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('gives nginx and Vercel the identical policy for the same site', () => {
    const root = mkdtempSync(join(tmpdir(), 'csp-parity-'));
    try {
      writeFileSync(join(root, 'index.html'), '<script type="module">go()</script>');
      const hashes = inlineScriptHashes(root);
      const vercel = buildConfig(hashes).routes[0]?.headers?.['Content-Security-Policy'];
      expect(nginxCspInclude(root)).toContain(`add_header Content-Security-Policy "${vercel}" always;`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is wired into docker/nginx.conf with the same Permissions-Policy and a fail-closed include', () => {
    const nginx = readFileSync(join(import.meta.dirname, '..', 'docker', 'nginx.conf'), 'utf8');
    expect(nginx).toContain(`add_header Permissions-Policy "${PERMISSIONS_POLICY}" always;`);
    expect(nginx).toMatch(/^\s*include \/etc\/nginx\/csp\.conf;/m);
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

    writeFileSync(join(dist, 'inline.html'), '<script type="module">hi()</script>');
    writeVercelOutput(dist, out);
    expect(JSON.parse(readFileSync(join(out, 'config.json'), 'utf8'))).toEqual(buildConfig(inlineScriptHashes(dist)));
    expect(JSON.stringify(buildConfig(inlineScriptHashes(dist)))).toContain('sha256-');
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

  it('resolves symlinks before comparing dist and out', () => {
    const dist = makeDist();
    const alias = join(root, 'alias');
    symlinkSync(dist, alias);
    // out below an alias of dist (the directory does not exist yet)
    expect(() => writeVercelOutput(dist, join(alias, 'out'))).toThrow(/nested/);
    // dist reached through the alias, out given by its real path
    expect(() => writeVercelOutput(alias, join(dist, 'out'))).toThrow(/nested/);
    // out itself is a symlink pointing into dist
    const sneaky = join(root, 'sneaky');
    symlinkSync(join(dist, '_astro'), sneaky);
    expect(() => writeVercelOutput(dist, sneaky)).toThrow(/nested/);
    // a dangling symlink as out is refused rather than followed
    const dangling = join(root, 'dangling');
    symlinkSync(join(root, 'missing-target'), dangling);
    expect(() => writeVercelOutput(dist, dangling)).toThrow(/dangling/);
    // nothing was deleted or written inside dist
    expect(existsSync(join(dist, '_astro', 'app.abc.css'))).toBe(true);
    expect(existsSync(join(dist, 'out'))).toBe(false);
  });
});

/**
 * A small model of the subset of Vercel Build Output API v3 routing that config.json uses:
 * ordered routes, `continue` header accumulation, `handle: filesystem`, redirects and a final
 * dest+status fallback. It follows Vercel's documented semantics; it is NOT Vercel itself, so the
 * first real deploy stays the final check (issue #17).
 */
interface Res {
  status: number;
  headers: Record<string, string>;
  body?: string;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.zip': 'application/zip',
  '.png': 'image/png',
};

function simulate(config: OutputConfig, staticDir: string, requestPath: string): Res {
  const headers: Record<string, string> = {};
  const lookup = (p: string): string | undefined => {
    const rel = p.endsWith('/') ? `${p}index.html` : p;
    const file = join(staticDir, rel);
    return existsSync(file) && statSync(file).isFile() ? file : undefined;
  };
  const serve = (file: string, status: number): Res => ({
    status,
    headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers },
    body: readFileSync(file, 'utf8'),
  });

  let path = requestPath;
  for (const route of config.routes) {
    if (route.handle === 'filesystem') {
      const file = lookup(path);
      if (file) return serve(file, 200);
      continue;
    }
    // Vercel anchors `src` to the whole path.
    const m = new RegExp(`^(?:${route.src})$`).exec(path);
    if (!m) continue;
    const sub = (v: string) => v.replace(/\$(\d)/g, (_, n: string) => m[Number(n)] ?? '');
    for (const [k, v] of Object.entries(route.headers ?? {})) headers[k.toLowerCase()] = sub(v);
    if (route.continue) continue;
    if (route.dest) {
      path = sub(route.dest);
      const file = lookup(path);
      return file ? serve(file, route.status ?? 200) : { status: route.status ?? 404, headers };
    }
    return { status: route.status ?? 200, headers };
  }
  return { status: 404, headers };
}

describe('routing model against the generated output', () => {
  let root: string;
  let staticDir: string;
  let config: OutputConfig;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vercel-routes-'));
    const dist = join(root, 'dist');
    for (const [file, body] of Object.entries({
      'index.html': '<h1>home</h1>',
      '404.html': '<h1>not found</h1>',
      'topics/x/index.html': '<h1>x</h1>',
      'files/md/a.md': '# a',
      'downloads/t.zip': 'PK',
      '_astro/a.js': 'export {}',
    })) {
      mkdirSync(join(dist, file, '..'), { recursive: true });
      writeFileSync(join(dist, file), body);
    }
    const out = join(root, 'out');
    writeVercelOutput(dist, out);
    staticDir = join(out, 'static');
    config = JSON.parse(readFileSync(join(out, 'config.json'), 'utf8')) as OutputConfig;
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const get = (p: string) => simulate(config, staticDir, p);
  const SECURITY = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
  };

  it('serves / as no-cache html with security headers', () => {
    const res = get('/');
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', ...SECURITY });
  });

  it('redirects /topics/x to /topics/x/ and serves the hub there', () => {
    const redirect = get('/topics/x');
    expect(redirect.status).toBe(301);
    expect(redirect.headers.location).toBe('/topics/x/');
    expect(get('/topics/x/')).toMatchObject({ status: 200, body: '<h1>x</h1>' });
  });

  it('serves markdown with the overridden content type and stays inline', () => {
    const res = get('/files/md/a.md');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
    expect(res.headers['content-disposition']).toBeUndefined();
  });

  it('forces download for topic zips', () => {
    const res = get('/downloads/t.zip');
    expect(res).toMatchObject({ status: 200 });
    expect(res.headers['content-disposition']).toBe('attachment');
    expect(res.headers['content-type']).toBe('application/zip');
  });

  it('makes /_astro assets immutable (later route overrides no-cache)', () => {
    const res = get('/_astro/a.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('answers unknown paths with the 404 page (after the trailing-slash redirect)', () => {
    expect(get('/nope')).toMatchObject({ status: 301 });
    const res = get('/nope/');
    expect(res).toMatchObject({ status: 404, body: '<h1>not found</h1>' });
    expect(res.headers).toMatchObject(SECURITY);
    expect(get('/missing.png')).toMatchObject({ status: 404, body: '<h1>not found</h1>' });
  });
});
