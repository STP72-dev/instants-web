import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// WCAG 2.x contrast of the token palette against the page background.
const css = readFileSync(join(import.meta.dirname, '..', 'src/styles/tokens.css'), 'utf8');
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('token contrast (WCAG AA)', () => {
  for (const bg of ['bg', 'bg-raised', 'surface', 'surface-hover']) {
    it.each(['text', 'text-muted', 'text-faint'])(`--%s on --${bg} ≥ 4.5:1`, (fg) => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
    it.each(['amber', 'cyan', 'violet', 'mint', 'rose', 'lime'])(`--accent-%s on --${bg} ≥ 4.5:1`, (a) => {
      expect(contrast(token(`accent-${a}`), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }
  it.each(['amber', 'cyan', 'violet', 'mint', 'rose', 'lime'])('--text-on-accent on --accent-%s ≥ 4.5:1', (a) => {
    expect(contrast(token('text-on-accent'), token(`accent-${a}`))).toBeGreaterThanOrEqual(4.5);
  });
});
