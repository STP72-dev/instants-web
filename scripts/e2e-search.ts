/**
 * Browser checks for /search/ (issue #8). Usage: node scripts/e2e-search.ts <base-url>   (exits 1 on the first failure)
 */
import { chromium, type Page } from 'playwright';

const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const browser = await chromium.launch();
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
};
const visible = (p: Page) => p.$$eval('#results > li:not([hidden])', (els) => els.map((e) => (e as HTMLElement).dataset.slug));

try {
  // 1. Without JavaScript every entry is listed and the page says filters need JS.
  const noJs = await browser.newPage({ javaScriptEnabled: false });
  await noJs.goto(`${base}/search/?tag=suno`);
  check('no-JS lists every entry', (await noJs.$$('#results > li')).length === 38);
  check('no-JS notice shown', (await noJs.textContent('noscript'))?.includes('need JavaScript') ?? false);
  await noJs.close();

  const p = await browser.newPage();
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));

  // 2. Hostile URL values are ignored, never injected.
  await p.goto(`${base}/search/?topic=${encodeURIComponent('"]<img src=x onerror=alert(1)>')}&tag=${encodeURIComponent('<script>x</script>')}`);
  await p.waitForTimeout(300);
  check('hostile ?topic/?tag ignored', (await visible(p)).length === 38 && errors.length === 0, errors.join('; '));

  // 3. Ranking order is the DOM (and tab) order.
  await p.goto(`${base}/search/?q=pgvector`);
  await p.waitForFunction(() => document.querySelector('#result-count')?.textContent?.includes('for'));
  check('ranked first result', (await visible(p))[0] === 'forecastlabai-rag-pipeline', String((await visible(p))[0]));

  // 4. A failed index load is reported, then retried on the next keystroke.
  const fresh = await browser.newPage();
  await fresh.route('**/search-index.json', (route) => route.fulfill({ status: 500, body: 'down' }));
  await fresh.goto(`${base}/search/`);
  await fresh.fill('#search-input', 'pgvector');
  await fresh.waitForTimeout(600);
  check('failed index reported', (await fresh.textContent('#result-count'))?.includes('could not be loaded') ?? false, (await fresh.textContent('#result-count')) ?? '');
  await fresh.unroute('**/search-index.json');
  await fresh.type('#search-input', ' ');
  await fresh.waitForFunction(() => document.querySelector('#result-count')?.textContent?.includes('for'), null, { timeout: 5000 });
  check('retry after failure works', (await visible(fresh))[0] === 'forecastlabai-rag-pipeline');
  await fresh.close();

  // 5. Clear restores everything and returns focus to the field.
  await p.click('#clear');
  check('clear restores all + focus', (await visible(p)).length === 38 && (await p.evaluate(() => document.activeElement?.id)) === 'search-input');
} finally {
  await browser.close();
}
process.exit(failures > 0 ? 1 : 0);
