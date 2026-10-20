// @ts-check
import { defineConfig } from 'astro/config';

// Static-first: one `dist/` output shared by Docker (nginx) and Vercel (Build Output API v3).
export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  site: process.env.SITE_URL ?? 'http://localhost:8080',
});
