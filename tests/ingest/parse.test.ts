import { describe, expect, it } from 'vitest';
import { humanize, isKebab, MetaError, parseExcalidraw, parseMarkdown, parseMermaid, summarize } from '../../src/lib/ingest/parse.ts';
import { excalidraw, md, mmd } from './fixture.ts';

describe('parseMarkdown', () => {
  it('reads title, sorted unique tags, source and created', () => {
    const { meta, body } = parseMarkdown(md('Hello — world', ['git', 'Repo-Setup', 'git'], 'created: 2026-10-19\n'), 'md/x.md');
    expect(meta).toEqual({ title: 'Hello — world', tags: ['git', 'repo-setup'], source: 'unit test', created: '2026-10-19' });
    expect(body).toContain('# Hello — world');
  });

  it('accepts block-list tags', () => {
    const text = '---\ntitle: T\ntags:\n  - a\n  - b\nsource: s\n---\nbody';
    expect(parseMarkdown(text, 'md/t.md').meta.tags).toEqual(['a', 'b']);
  });

  it.each([
    ['no frontmatter', '# just a heading\n', /missing YAML frontmatter/],
    ['missing title', '---\ntags: [a]\nsource: s\n---\n', /missing "title"/],
    ['missing source', '---\ntitle: T\ntags: [a]\n---\n', /missing "source"/],
    ['tags not a list', '---\ntitle: T\ntags: {a: 1}\nsource: s\n---\n', /"tags" must be a list/],
    ['empty tags', '---\ntitle: T\ntags: []\nsource: s\n---\n', /"tags" is empty/],
    ['broken YAML', '---\ntitle: [unclosed\n---\n', /invalid frontmatter YAML/],
  ])('fails loudly on %s', (_name, text, msg) => {
    expect(() => parseMarkdown(text, 'md/bad.md')).toThrow(MetaError);
    expect(() => parseMarkdown(text, 'md/bad.md')).toThrow(msg);
  });
});

describe('parseMermaid', () => {
  it('reads %% header comments', () => {
    expect(parseMermaid(mmd('Flow', ['ai', 'effort']), 'mermaid/f.mmd')).toEqual({
      title: 'Flow',
      tags: ['ai', 'effort'],
      source: 'unit test',
      created: null,
    });
  });

  it('only reads the leading comment header', () => {
    const text = 'flowchart TD\n  A --> B\n%% title: late\n%% tags: x\n%% source: y\n';
    expect(() => parseMermaid(text, 'mermaid/late.mmd')).toThrow(/missing "title"/);
  });

  it('rejects duplicate header keys', () => {
    expect(() => parseMermaid('%% title: a\n%% title: b\n%% tags: t\n%% source: s\n', 'mermaid/d.mmd')).toThrow(/duplicate "%% title:"/);
  });

  it('fails when a header is missing', () => {
    expect(() => parseMermaid('%% title: x\n%% tags: a\nflowchart TD', 'mermaid/x.mmd')).toThrow(/missing "source"/);
  });
});

describe('parseExcalidraw', () => {
  it('returns the title text element', () => {
    expect(parseExcalidraw(excalidraw('Prime  flow'), 'e')).toEqual({ title: 'Prime flow' });
    expect(parseExcalidraw(excalidraw(), 'e')).toEqual({ title: null });
  });

  it.each([
    ['invalid JSON', '{nope', /invalid JSON/],
    ['wrong type', JSON.stringify({ type: 'other', elements: [] }), /not an Excalidraw scene/],
    ['no elements', JSON.stringify({ type: 'excalidraw' }), /not an Excalidraw scene/],
  ])('fails loudly on %s', (_n, text, msg) => {
    expect(() => parseExcalidraw(text, 'excalidraw/x.excalidraw')).toThrow(msg);
  });
});

describe('helpers', () => {
  it('summarize strips markup and skips headings', () => {
    expect(summarize('# T\n\n## Problem\nA **b** [c](d) `e`.\n\nNext')).toBe('A b c e.');
    expect(summarize('# T\n\n> Quoted *intro*\n> line two\n\n- list')).toBe('Quoted intro line two');
    expect(summarize('Fails for `.claude/commands/*.md` and snake_case, *really*.')).toBe('Fails for .claude/commands/*.md and snake_case, really.');
    expect(summarize('# only headings\n## x')).toBeNull();
  });

  it('isKebab and humanize', () => {
    expect(isKebab('claude-code-x1')).toBe(true);
    expect(isKebab('Bad_Name')).toBe(false);
    expect(humanize('claude-code')).toBe('Claude Code');
    expect(humanize('ai')).toBe('AI');
  });
});
