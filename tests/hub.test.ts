import { describe, expect, it } from 'vitest';
import { getTopic, topicEntries } from '../src/lib/content.ts';
import { guidedPath, musicChapters } from '../src/lib/hub.ts';
import type { Entry, Role, Topic } from '../src/lib/manifest.ts';

const entry = (slug: string, role: Role, track: string | null = null): Entry => ({
  slug, title: slug, tags: [], source: null, created: null, summary: null, topic: 'm', track, role, order: 0, metadataFrom: 'derived', formats: {},
});
const topicOf = (tracks: Topic['tracks'], entries: Entry[]): Topic => ({
  slug: 'm', title: 'M', kind: 'music', entries: entries.map((e) => e.slug), tracks, tags: [],
});

describe('hub grouping (committed snapshot)', () => {
  it('turns every NONCONFORMIST track into an ordered story', () => {
    const topic = getTopic('nonconformist');
    const { chapters, rest } = musicChapters(topic, topicEntries(topic));
    expect(chapters.map((c) => c.slug)).toEqual(['hell-yeah', 'sage-solo', 'techtoon-ep01']);
    for (const c of chapters) {
      const ids = c.stages.map((s) => s.id);
      expect(ids.slice(0, 2)).toEqual(['overview', 'sound-dna']);
      expect(ids).toContain('variants');
      expect(c.overview?.role).toBe('overview');
    }
    expect(chapters[0].stages.find((s) => s.id === 'variants')!.entries.map((e) => e.slug)).toEqual([
      'nonconformist-hell-yeah-suno-version-a',
      'nonconformist-hell-yeah-suno-version-b',
    ]);
    expect(rest.map((s) => [s.id, s.entries.map((e) => e.slug)])).toEqual([['workflow', ['nonconformist-suno-audio-reference-workflow']]]);
  });

  it('keeps every entry exactly once', () => {
    for (const slug of ['nonconformist', 'forecastlabai', 'ai', 'instants']) {
      const topic = getTopic(slug);
      const entries = topicEntries(topic);
      const placed =
        topic.kind === 'music'
          ? (() => {
              const { chapters, rest } = musicChapters(topic, entries);
              return [...chapters.flatMap((c) => c.stages.flatMap((s) => s.entries)), ...rest.flatMap((s) => s.entries)];
            })()
          : guidedPath(entries).flatMap((s) => s.entries);
      expect(placed.map((e) => e.slug).sort()).toEqual(entries.map((e) => e.slug).sort());
    }
  });

  it('orders a technical path from orientation to detail', () => {
    const stages = guidedPath(topicEntries(getTopic('forecastlabai')));
    expect(stages.map((s) => s.id)).toEqual(['start', 'concepts', 'practice', 'reference', 'deep-dives']);
  });
});

describe('hub grouping edge cases', () => {
  it('a music topic without tracks keeps role-based stages (no false "workflow" heading)', () => {
    const entries = [entry('m-overview', 'overview'), entry('m-suno-a', 'variant')];
    const { chapters, rest } = musicChapters(topicOf([], entries), entries);
    expect(chapters).toEqual([]);
    expect(rest.map((s) => s.id)).toEqual(['overview', 'variants']);
  });

  it('a track with only an overview is a one-stage chapter', () => {
    const entries = [entry('m-t-overview', 'overview', 't')];
    const { chapters, rest } = musicChapters(topicOf([{ slug: 't', title: 'T', entries: ['m-t-overview'] }], entries), entries);
    expect(chapters[0].stages.map((s) => s.id)).toEqual(['overview']);
    expect(chapters[0].overview?.slug).toBe('m-t-overview');
    expect(rest).toEqual([]);
  });

  it('a single-entry technical topic is a one-stage path', () => {
    expect(guidedPath([entry('g-x', 'detail')]).map((s) => [s.id, s.entries.length])).toEqual([['deep-dives', 1]]);
  });
});
