import { describe, expect, it } from 'vitest';
import { getTopic, topicEntries } from '../src/lib/content.ts';
import { guidedPath, musicChapters } from '../src/lib/hub.ts';

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
    expect(rest.map((e) => e.slug)).toEqual(['nonconformist-suno-audio-reference-workflow']);
  });

  it('keeps every entry exactly once', () => {
    for (const slug of ['nonconformist', 'forecastlabai', 'ai', 'instants']) {
      const topic = getTopic(slug);
      const entries = topicEntries(topic);
      const placed =
        topic.kind === 'music'
          ? (() => {
              const { chapters, rest } = musicChapters(topic, entries);
              return [...chapters.flatMap((c) => c.stages.flatMap((s) => s.entries)), ...rest];
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
