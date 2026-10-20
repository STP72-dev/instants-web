/**
 * Build-time Markdown → HTML for entry pages (GFM, Shiki, heading ids + anchors).
 * Entry Markdown is data, never markup we trust: raw HTML is shown as text, unsafe URL schemes are dropped,
 * and ```mermaid fences become live-diagram figures hydrated by src/components/entry/MermaidScript.astro.
 */
import { createMarkdownProcessor, parseFrontmatter, rehypeHeadingIds, type MarkdownRenderer } from '@astrojs/markdown-remark';

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: Heading[];
  /** True when the Markdown contained at least one ```mermaid block. */
  hasMermaid: boolean;
}

// Minimal unist/hast/mdast shapes; enough for the transforms below without importing type-only packages.
interface Node {
  type: string;
  value?: string;
  children?: Node[];
}
interface Element extends Node {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
  children: Node[];
}
interface VFileLike {
  data: { astro?: { localImagePaths?: string[]; remoteImagePaths?: string[] } };
}

const isElement = (node: Node, tag?: string): node is Element => node.type === 'element' && (!tag || (node as Element).tagName === tag);
const el = (tagName: string, properties: Record<string, unknown>, children: Node[] = []): Element => ({ type: 'element', tagName, properties, children });
const text = (value: string): Node => ({ type: 'text', value });

function walk(node: Node, visit: (node: Node, parent: Node | null, index: number) => void, parent: Node | null = null, index = 0) {
  visit(node, parent, index);
  node.children?.forEach((child, i) => walk(child, visit, node, i));
}

function textContent(node: Node): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textContent).join('');
}

const HEADING = /^h([1-6])$/;
const SAFE_URL = /^(?:https?:|mailto:|#|\/(?!\/)|\.{1,2}\/|[^:/?#]+(?:[/?#]|$))/i;

/** Raw HTML (block or inline) becomes literal text, so it is visible but can never execute. */
function remarkInertHtml() {
  return (tree: Node) => {
    walk(tree, (node, parent) => {
      if (node.type !== 'html' || !parent) return;
      const literal = text(node.value ?? '');
      const block = parent.type === 'root' || parent.type === 'blockquote' || parent.type === 'listItem';
      Object.assign(node, block ? { type: 'paragraph', children: [literal], value: undefined } : literal);
    });
  };
}

/** The page owns the single h1: drop the Markdown's leading h1 and shift the rest so the shallowest heading is an h2. */
function demoteHeadings(tree: Node) {
  const headings: { node: Element; parent: Node; depth: number }[] = [];
  walk(tree, (node, parent) => {
    const m = isElement(node) && HEADING.exec(node.tagName);
    if (m && parent) headings.push({ node: node as Element, parent, depth: Number(m[1]) });
  });
  if (headings[0]?.depth === 1) {
    const { node, parent } = headings.shift()!;
    parent.children!.splice(parent.children!.indexOf(node), 1);
  }
  const shift = headings.length ? 2 - Math.min(...headings.map((h) => h.depth)) : 0;
  for (const h of headings) h.node.tagName = `h${Math.min(6, Math.max(2, h.depth + shift))}`;
}

function mermaidFigure(source: string, index: number): Element {
  const id = `md-mermaid-${index + 1}`;
  return el('figure', { className: ['mermaid-figure'], dataMermaid: '', ariaLabel: `Diagram ${index + 1}` }, [
    el('div', { className: ['mermaid-canvas'], id, dataMermaidCanvas: '', role: 'img', ariaLabel: `Diagram ${index + 1}` }, [
      el('p', { className: ['mermaid-status'], dataMermaidStatus: '' }, [text('Diagram renders when it scrolls into view.')]),
    ]),
    el('details', { className: ['mermaid-source'], dataMermaidSource: '' }, [
      el('summary', {}, [text('Source')]),
      el('pre', { tabIndex: 0 }, [el('code', { dataMermaidCode: '' }, [text(source.replace(/\n$/, ''))])]),
    ]),
  ]);
}

function rehypeEntry() {
  return (tree: Node, file: VFileLike) => {
    // Astro's image pipeline is not available in this standalone renderer; images stay plain <img>.
    if (file.data.astro) file.data.astro.localImagePaths = file.data.astro.remoteImagePaths = [];

    demoteHeadings(tree);
    // Assign ids now (rehypeHeadingIds keeps existing ids when Astro runs it again later), then add anchors.
    (rehypeHeadingIds() as unknown as (tree: Node, file: VFileLike) => void)(tree, file);

    let mermaidCount = 0;
    walk(tree, (node, parent, index) => {
      if (!isElement(node) || !parent) return;
      const props = node.properties;

      if (HEADING.test(node.tagName) && typeof props.id === 'string') {
        const label = textContent(node);
        node.children.push(
          el('a', { className: ['heading-anchor'], href: `#${props.id}` }, [el('span', { className: ['visually-hidden'] }, [text(`Link to section: ${label}`)])]),
        );
      } else if (node.tagName === 'pre') {
        const code = node.children.find((c) => isElement(c, 'code')) as Element | undefined;
        const classes = (code?.properties.className as string[] | undefined) ?? [];
        if (code && classes.includes('language-mermaid')) {
          parent.children![index] = mermaidFigure(textContent(code), mermaidCount++);
        }
      } else if (node.tagName === 'table') {
        // Inter-row newlines would be foster-parented out of the table by rehype-raw; they carry no content.
        walk(node, (n) => {
          if (isElement(n) && /^(table|thead|tbody|tfoot|tr)$/.test(n.tagName)) n.children = n.children.filter((c) => c.type !== 'text' || /\S/.test(c.value ?? ''));
        });
        parent.children![index] =el('div', { className: ['table-scroll'], role: 'region', ariaLabel: 'Table (scrolls horizontally)', tabIndex: 0 }, [node]);
      } else if (node.tagName === 'a' || node.tagName === 'img') {
        const attr = node.tagName === 'a' ? 'href' : 'src';
        const url = props[attr];
        if (typeof url === 'string' && !SAFE_URL.test(url.trim())) delete props[attr];
        if (node.tagName === 'img') Object.assign(props, { loading: 'lazy', decoding: 'async' });
        else if (typeof props.href === 'string' && /^https?:/i.test(props.href)) props.rel = 'noopener noreferrer';
      }
    });
  };
}

let processor: Promise<MarkdownRenderer> | undefined;

function getProcessor() {
  processor ??= createMarkdownProcessor({
    syntaxHighlight: { type: 'shiki', excludeLangs: ['mermaid'] },
    shikiConfig: { theme: 'github-dark-default', wrap: false },
    remarkPlugins: [remarkInertHtml],
    rehypePlugins: [rehypeEntry],
    remarkRehype: { allowDangerousHtml: false },
    gfm: true,
    smartypants: true,
  });
  return processor;
}

/** Render one entry's Markdown file (frontmatter is stripped; the manifest already carries it). */
export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const { content } = parseFrontmatter(source, { frontmatter: 'remove' });
  const renderer = await getProcessor();
  const result = await renderer.render(content);
  // Astro re-collects headings after the anchors exist, so drop the anchor's hidden label from the text.
  const headings = result.metadata.headings.map((h) => ({ ...h, text: h.text.replace(/Link to section: .*$/, '').trim() }));
  return { html: result.code, headings, hasMermaid: result.code.includes('data-mermaid') };
}
