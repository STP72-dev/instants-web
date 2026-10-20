/**
 * Browser proof that the Content-Security-Policy does not break the site (#12).
 * Usage: node scripts/csp-check.ts [base-url] [--allow-missing-csp]
 *   default base-url http://localhost:8080 (run it against the Docker image, e.g. WEB_PORT=18080).
 * Visits every page type, exercises the interactive parts (Mermaid, Excalidraw canvas, source toggles, PDF
 * preview, code copy) and exits 1 on any CSP violation (securitypolicyviolation event, CSP console error,
 * request blocked by CSP), any uncaught page error, or any request to an origin other than the site's own.
 * Every HTML response must carry exactly the policy buildCsp() produces (only 'self' + sha256 hashes in script-src)
 * and the expected Permissions-Policy, unless --allow-missing-csp (`astro preview` sends no headers).
 */
import { chromium, type Page } from 'playwright';
import { buildCsp, PERMISSIONS_POLICY } from './vercel-output.ts';

const args = process.argv.slice(2);
const allowMissingCsp = args.includes('--allow-missing-csp');
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:8080').replace(/\/$/, '');

// Same-origin only: works against the Docker image and a real deployment alike.
const SITE_ORIGIN = new URL(base).origin;

/** Exact policy check: script-src may hold only 'self' and sha256 hashes; everything else must equal buildCsp(). */
function policyProblem(csp: string): string | null {
  const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '));
  if (!scriptSrc) return 'no script-src directive';
  const sources = scriptSrc.split(/\s+/).slice(1);
  const hashes = sources.filter((t) => /^'sha256-[A-Za-z0-9+/]+={0,2}'$/.test(t));
  const other = sources.filter((t) => t !== "'self'" && !/^'sha256-/.test(t));
  if (other.length > 0) return `script-src allows ${other.join(' ')}`;
  const normalise = (p: string) => p.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean).join('; ');
  return normalise(csp) === normalise(buildCsp(hashes)) ? null : `policy differs from buildCsp(): ${csp}`;
}

interface PageSpec {
  path: string;
  /** Statuses that count as "the page loaded". */
  statuses?: number[];
  /** A missing page is skipped (with a note) instead of failing; for pages that land in a later issue. */
  optional?: boolean;
  act?: (page: Page) => Promise<void>;
}

const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);

/** Scroll top to bottom in steps so lazy images, Mermaid and Excalidraw figures enter the viewport. */
async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await settle(page);
}

async function mermaid(page: Page): Promise<void> {
  const figures = page.locator('[data-mermaid]');
  const count = await figures.count();
  if (count === 0) throw new Error('expected a Mermaid figure on this page');
  for (let i = 0; i < count; i++) {
    const figure = figures.nth(i);
    await figure.scrollIntoViewIfNeeded();
    await figure.locator('svg').first().waitFor({ state: 'attached', timeout: 20_000 });
    const summary = figure.locator('[data-mermaid-source] > summary');
    await summary.click();
    if (!(await figure.locator('[data-mermaid-source]').evaluate((d) => (d as HTMLDetailsElement).open))) throw new Error('Source did not open');
    await summary.click();
  }
}

async function canvas(page: Page): Promise<void> {
  const figure = page.locator('[data-excalidraw]').first();
  await figure.scrollIntoViewIfNeeded();
  if ((await figure.locator('[data-exc-svg]').count()) > 0) {
    await figure.locator('[data-exc-svg] svg').first().waitFor({ state: 'attached', timeout: 20_000 });
  }
  await figure.locator('[data-exc-open]').click();
  await page.locator('dialog[data-exc-dialog][open] .excalidraw canvas').first().waitFor({ state: 'attached', timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[data-exc-dialog][open]'), undefined, { timeout: 5_000 });
}

async function pdf(page: Page): Promise<void> {
  const summaries = page.locator('details.pdf > summary');
  for (let i = 0; i < (await summaries.count()); i++) {
    await summaries.nth(i).click();
    await page.waitForTimeout(1_000);
  }
}

async function codeCopy(page: Page): Promise<void> {
  const button = page.locator('.code-copy').first();
  if ((await button.count()) > 0) await button.click();
}

const PAGES: PageSpec[] = [
  { path: '/', act: scrollThrough },
  { path: '/topics/nonconformist/', act: scrollThrough },
  { path: '/topics/forecastlabai/', act: scrollThrough },
  {
    path: '/entries/forecastlabai-architecture/',
    act: async (page) => {
      await scrollThrough(page);
      await mermaid(page);
      await pdf(page);
      await canvas(page);
    },
  },
  { path: '/entries/instants-prime-flow/', act: async (page) => (await scrollThrough(page), canvas(page)) },
  { path: '/entries/ai-model-routing/', act: async (page) => (await scrollThrough(page), mermaid(page)) },
  { path: '/entries/ai-start-guide/', act: async (page) => (await scrollThrough(page), codeCopy(page)) },
  { path: '/search/?q=pgvector', optional: true, act: scrollThrough },
  { path: '/styleguide/', act: scrollThrough },
  { path: '/404.html', statuses: [404, 200], act: scrollThrough },
  { path: '/no-such-page/', statuses: [404], act: scrollThrough },
];

const problems: string[] = [];
const browser = await chromium.launch();
try {
  for (const spec of PAGES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin }).catch(() => undefined);
    const violations: string[] = [];
    const external: string[] = [];
    const warnings: string[] = [];
    let requests = 0;

    await context.exposeFunction('__reportCsp', (v: string) => violations.push(v));
    await context.addInitScript(() => {
      document.addEventListener(
        'securitypolicyviolation',
        (e) => (window as unknown as { __reportCsp(v: string): void }).__reportCsp(`${e.violatedDirective} blocked ${e.blockedURI || '(inline)'} at ${e.sourceFile || location.pathname}:${e.lineNumber}`),
        true,
      );
    });

    const page = await context.newPage();
    page.on('request', (req) => {
      requests++;
      const url = new URL(req.url());
      if (/^(https?|wss?):$/.test(url.protocol) && url.origin !== SITE_ORIGIN) external.push(req.url());
    });
    page.on('requestfailed', (req) => {
      if (req.failure()?.errorText.includes('BLOCKED_BY_CSP')) violations.push(`request blocked by CSP: ${req.url()}`);
    });
    page.on('console', (msg) => {
      const text = msg.text();
      if (/Content[- ]Security[- ]Policy|violates the following/i.test(text)) violations.push(`console: ${text.slice(0, 200)}`);
      else if (msg.type() === 'error') warnings.push(`console error: ${text.slice(0, 160)}`);
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message.slice(0, 160)));

    const label = spec.path.padEnd(42);
    const fail = (msg: string) => problems.push(`${spec.path}: ${msg}`);
    try {
      const res = await page.goto(base + spec.path, { waitUntil: 'load' });
      const status = res?.status() ?? 0;
      if (spec.optional && status === 404) {
        console.log(`skip  ${label} (404: page not built yet)`);
        continue;
      }
      if (!(spec.statuses ?? [200]).includes(status)) fail(`HTTP ${status}`);

      const headers = res?.headers() ?? {};
      const csp = headers['content-security-policy'];
      if (!csp || !headers['permissions-policy']) {
        if (!allowMissingCsp) fail('missing Content-Security-Policy / Permissions-Policy header');
      } else {
        const problem = policyProblem(csp);
        if (problem) fail(problem);
        if (headers['permissions-policy'] !== PERMISSIONS_POLICY) fail(`unexpected Permissions-Policy: ${headers['permissions-policy']}`);
      }

      await settle(page);
      await spec.act?.(page);
      await page.waitForTimeout(300);
    } catch (err) {
      fail(`interaction failed: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    }

    for (const v of new Set(violations)) fail(`CSP violation: ${v}`);
    for (const u of new Set(external)) fail(`external request: ${u}`);
    for (const e of new Set(pageErrors)) fail(`page error: ${e}`);
    const bad = violations.length + external.length + pageErrors.length;
    console.log(`${bad === 0 ? 'ok   ' : 'FAIL '} ${label} ${requests} requests, ${violations.length} violations, ${external.length} external`);
    for (const w of new Set(warnings)) console.log(`      warn: ${w}`);
    await context.close();
  }
} finally {
  await browser.close();
}

if (problems.length > 0) {
  console.error(`\ncsp-check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\ncsp-check: 0 violations, 0 external requests');
