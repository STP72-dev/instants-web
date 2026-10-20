import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { manifest } from '../src/lib/content.ts';
import { renderMarkdown } from '../src/lib/markdown.ts';

const md = (body: string) => `---\ntitle: T\ntags: [a]\n---\n\n# T\n\n${body}\n`;

describe('renderMarkdown', () => {
  it('strips frontmatter and the leading h1 (the page owns the single h1)', async () => {
    const { html } = await renderMarkdown(md('## Problem\n\ntext'));
    expect(html).not.toContain('title: T');
    expect(html).not.toMatch(/<h1/);
    expect(html).toMatch(/<h2 id="problem">Problem<a class="heading-anchor" href="#problem">/);
  });

  it('shifts headings so the shallowest is an h2, with ids, anchors and clean heading text', async () => {
    const { html, headings } = await renderMarkdown('### Deep\n\n#### Deeper');
    expect(html).toMatch(/<h2 id="deep">/);
    expect(html).toMatch(/<h3 id="deeper">/);
    expect(headings).toEqual([
      { depth: 2, slug: 'deep', text: 'Deep' },
      { depth: 3, slug: 'deeper', text: 'Deeper' },
    ]);
  });

  it('keeps relative depth when a later h1 appears (it becomes an h2)', async () => {
    const { html } = await renderMarkdown('## Section\n\n# Stray top\n\n###### Tiny');
    expect(html).toMatch(/<h3 id="section">/);
    expect(html).toMatch(/<h2 id="stray-top">/);
    expect(html).toMatch(/<h6 id="tiny">/);
  });

  it('renders GFM tables inside a focusable horizontal scroll region', async () => {
    const { html } = await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toMatch(/<div class="table-scroll" role="region" aria-label="[^"]+" tabindex="0"><table>/);
    expect(html).toContain('<td>1</td>');
    expect(html).not.toMatch(/\n\s*\n\s*<table>/);
  });

  it('highlights fenced code with Shiki', async () => {
    const { html } = await renderMarkdown('```python\nprint("hi")\n```');
    expect(html).toMatch(/<pre class="astro-code [^"]*"[^>]*data-language="python"/);
    expect(html).toContain('<span style="color:');
  });

  it('turns ```mermaid fences into live-diagram figures with the source kept as text', async () => {
    const { html, hasMermaid } = await renderMarkdown('```mermaid\ngraph TD; A-->B\n```');
    expect(hasMermaid).toBe(true);
    expect(html).toContain('data-mermaid=""');
    expect(html).toContain('data-mermaid-canvas=""');
    expect(html).toMatch(/<code data-mermaid-code="">graph TD; A-->B<\/code>/);
    expect(html).not.toContain('astro-code');
  });

  it('never emits raw HTML from the Markdown: it is shown as inert text', async () => {
    const { html } = await renderMarkdown('<script>alert(1)</script>\n\nhi <img src=x onerror=alert(1)> <b>bold</b>');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).not.toContain('<b>');
    expect(html).toContain('&#x3C;script>alert(1)&#x3C;/script>');
  });

  it('drops unsafe URL schemes from links and images, keeps safe ones', async () => {
    const { html } = await renderMarkdown(
      '[a](javascript:alert(1)) [b](JaVaScRiPt:alert(1)) [c](data:text/html,x) [d](https://example.com) [e](./rel.md) [f](#x) [g](mailto:a@b.c)\n\n![i](javascript:alert(1)) ![j](https://example.com/i.png)',
    );
    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toContain('data:text/html');
    expect(html).toContain('<a href="https://example.com" rel="noopener noreferrer">d</a>');
    expect(html).toContain('href="./rel.md"');
    expect(html).toContain('href="#x"');
    expect(html).toContain('href="mailto:a@b.c"');
    expect(html).toMatch(/<img src="https:\/\/example.com\/i.png" alt="j" loading="lazy" decoding="async">/);
  });

  it('renders every Markdown file in the snapshot without raw HTML or an h1', async () => {
    const files = manifest.entries.flatMap((e) => (e.formats.md ? [e.formats.md.source.path] : []));
    expect(files.length).toBeGreaterThan(0);
    for (const path of files) {
      const { html, headings } = await renderMarkdown(readFileSync(join('content', path), 'utf8'));
      expect(html, path).not.toMatch(/<(h1|script|iframe|style)\b/i);
      expect(headings.every((h) => h.depth >= 2), path).toBe(true);
    }
  });
});
