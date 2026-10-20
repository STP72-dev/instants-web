import { describe, expect, it } from 'vitest';
import { buildTopic, deriveTopics, discoverTracks, musicRole, technicalRole, trackOf } from '../../src/lib/ingest/topics.ts';

describe('deriveTopics', () => {
  it('uses the longest name prefix that is also a tag', () => {
    const topics = deriveTopics([
      { slug: 'claude-code-command-shell', tags: ['claude-code', 'shell'] },
      { slug: 'ai-model-routing', tags: ['ai'] },
      { slug: 'forecastlabai-architecture', tags: ['forecastlabai', 'architecture'] },
    ]);
    expect(Object.fromEntries(topics)).toEqual({
      'claude-code-command-shell': 'claude-code',
      'ai-model-routing': 'ai',
      'forecastlabai-architecture': 'forecastlabai',
    });
  });

  it('falls back to learned topics, then the first segment, for untagged entries', () => {
    const topics = deriveTopics([
      { slug: 'claude-code-hooks', tags: ['claude-code'] },
      { slug: 'claude-code-sketch', tags: [] },
      { slug: 'instants-prime-flow', tags: [] },
    ]);
    expect(topics.get('claude-code-sketch')).toBe('claude-code');
    expect(topics.get('instants-prime-flow')).toBe('instants');
  });
});

describe('track-DNA ordering', () => {
  it('discovers tracks from overview / sound-dna anchors and picks the longest prefix', () => {
    const tracks = discoverTracks(['hell-yeah-overview', 'hell-yeah-sound-dna', 'sage-solo-overview', 'suno-audio-workflow']);
    expect(tracks).toEqual(['hell-yeah', 'sage-solo']);
    expect(trackOf('sage-solo-suno-3a', tracks)).toBe('sage-solo');
    expect(trackOf('suno-audio-workflow', tracks)).toBeNull();
  });

  it('classifies music roles', () => {
    expect(['overview', 'sound-dna', 'suno-version-a', 'suno-extend-workflow', 'suno-workflow', 'notes'].map(musicRole)).toEqual([
      'overview',
      'sound-dna',
      'variant',
      'workflow',
      'workflow',
      'supporting',
    ]);
  });

  it('orders each track as a story, then topic-level entries', () => {
    const tags = ['nonconformist', 'music', 'track-dna'];
    const slugs = [
      'nc-b-suno-workflow',
      'nc-suno-audio-reference-workflow',
      'nc-a-suno-version-b',
      'nc-b-overview',
      'nc-a-sound-dna',
      'nc-a-overview',
      'nc-a-suno-version-a',
      'nc-b-sound-dna',
    ];
    const { topic, placements } = buildTopic(
      'nc',
      slugs.map((slug) => ({ slug, tags, title: slug === 'nc-a-overview' ? 'NC — Track A, facts' : slug })),
    );
    expect(topic.kind).toBe('music');
    expect(topic.entries).toEqual([
      'nc-a-overview',
      'nc-a-sound-dna',
      'nc-a-suno-version-a',
      'nc-a-suno-version-b',
      'nc-b-overview',
      'nc-b-sound-dna',
      'nc-b-suno-workflow',
      'nc-suno-audio-reference-workflow',
    ]);
    expect(topic.tracks.map((t) => [t.slug, t.title])).toEqual([
      ['a', 'Track A'],
      ['b', 'B'],
    ]);
    expect(placements.get('nc-suno-audio-reference-workflow')).toEqual({ track: null, role: 'workflow', order: 7 });
  });
});

describe('technical guided path', () => {
  it('orders overview → concept → practice → reference → detail', () => {
    const slugs = ['fl-feature-leakage', 'fl-interview-qa', 'fl-ml-workflow', 'fl-architecture', 'fl-overview-stack'];
    const { topic } = buildTopic(
      'fl',
      slugs.map((slug) => ({ slug, tags: ['fl'], title: `FL — ${slug}` })),
    );
    expect(topic.kind).toBe('technical');
    expect(topic.title).toBe('FL');
    expect(topic.entries).toEqual(['fl-overview-stack', 'fl-architecture', 'fl-ml-workflow', 'fl-interview-qa', 'fl-feature-leakage']);
    expect(technicalRole('random-notes')).toBe('detail');
  });

  it('does not use one entry title as the topic title', () => {
    expect(buildTopic('git', [{ slug: 'git-new-repo', tags: ['git'], title: 'Git new repo — safe path' }]).topic.title).toBe('Git');
  });
});
