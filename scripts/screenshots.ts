/**
 * Full-page screenshots at desktop and phone width.
 * Usage: node scripts/screenshots.ts [base-url] [out-dir] [path ...]
 *   defaults: http://localhost:4321  docs/screenshots  / /styleguide/
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [base = 'http://localhost:4321', outDir = 'docs/screenshots', ...rest] = process.argv.slice(2);
const paths = rest.length > 0 ? rest : ['/', '/styleguide/'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'narrow', width: 360, height: 740 },
];
const overflowing: string[] = [];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    for (const path of paths) {
      const res = await page.goto(base.replace(/\/$/, '') + path, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) throw new Error(`${path}: HTTP ${res?.status()}`);
      // Full-page shots never scroll, so load lazy images up front.
      await page.evaluate(async () => {
        const imgs = [...document.images];
        imgs.forEach((img) => (img.loading = 'eager'));
        await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => img.addEventListener('load', r, { once: true })))));
        await document.fonts.ready;
      });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const name = (path.replace(/^\/|\/$/g, '').replace(/[/?=&]+/g, '_') || 'home') + `.${vp.name}.png`;
      await page.screenshot({ path: join(outDir, name), fullPage: true });
      console.log(`${vp.name.padEnd(7)} ${path} → ${join(outDir, name)}${overflow > 0 ? `  ⚠ horizontal overflow ${overflow}px` : ''}`);
      if (overflow > 0) overflowing.push(`${vp.name} ${path} (${overflow}px)`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
if (overflowing.length > 0) {
  console.error(`horizontal overflow on: ${overflowing.join(', ')}`);
  process.exit(1);
}
