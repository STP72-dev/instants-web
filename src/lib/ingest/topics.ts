import type { Role, Topic, TopicKind, Track } from '../manifest.ts';
import { humanize } from './parse.ts';

/** Locale-independent comparator so output never depends on the machine's locale. */
export const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const prefixes = (slug: string): string[] => {
  const parts = slug.split('-');
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('-'));
};

export interface TopicInput {
  slug: string;
  tags: string[];
}

/**
 * Topic = the longest kebab prefix of the slug that is also one of the entry's tags.
 * Untagged entries take the longest prefix learned from tagged entries, else the first name segment.
 */
export function deriveTopics(entries: TopicInput[]): Map<string, string> {
  const result = new Map<string, string>();
  const learned = new Set<string>();
  for (const e of entries) {
    const hit = prefixes(e.slug).filter((p) => e.tags.includes(p)).pop();
    if (hit) {
      result.set(e.slug, hit);
      learned.add(hit);
    }
  }
  for (const e of entries) {
    if (result.has(e.slug)) continue;
    const known = prefixes(e.slug).filter((p) => learned.has(p)).pop();
    result.set(e.slug, known ?? e.slug.split('-')[0]);
  }
  return result;
}

export function topicKind(tags: string[]): TopicKind {
  return tags.includes('music') || tags.includes('track-dna') ? 'music' : 'technical';
}

const TRACK_ANCHORS = ['-overview', '-sound-dna'];

/** Track slugs inside one topic: tails that end in an anchor role (overview / sound-dna). */
export function discoverTracks(tails: string[]): string[] {
  const tracks = new Set<string>();
  for (const tail of tails) {
    for (const anchor of TRACK_ANCHORS) {
      if (tail.endsWith(anchor) && tail.length > anchor.length) tracks.add(tail.slice(0, -anchor.length));
    }
  }
  return [...tracks].sort(byCodePoint);
}

/** Longest discovered track that prefixes the tail. */
export function trackOf(tail: string, tracks: string[]): string | null {
  return tracks.filter((t) => tail.startsWith(`${t}-`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export const ROLE_RANK: Record<Role, number> = {
  overview: 10,
  'sound-dna': 20,
  concept: 20,
  variant: 30,
  practice: 30,
  workflow: 40,
  reference: 40,
  detail: 60,
  supporting: 90,
};

/** Track-DNA story: overview → sound DNA → variants → workflow. */
export function musicRole(rest: string): Role {
  if (rest === 'overview') return 'overview';
  if (rest === 'sound-dna') return 'sound-dna';
  if (rest === 'workflow' || rest.endsWith('-workflow')) return 'workflow';
  if (rest.startsWith('suno-') || rest.startsWith('variant')) return 'variant';
  return 'supporting';
}

const TECH_ROLES: Array<[Role, string[]]> = [
  ['overview', ['overview', 'intro', 'introduction', 'start', 'pitch']],
  ['concept', ['architecture', 'concept', 'concepts', 'principle', 'principles', 'model', 'models', 'stack']],
  ['practice', ['workflow', 'guide', 'how', 'howto', 'tutorial', 'loop', 'flow', 'pipeline', 'commits']],
  ['reference', ['reference', 'api', 'cheatsheet', 'qa', 'metrics', 'checklist']],
];

/** Guided path for technical topics: orientation → concepts → practice → reference → detail. */
export function technicalRole(tail: string): Role {
  const tokens = tail.split('-');
  for (const [role, words] of TECH_ROLES) if (tokens.some((t) => words.includes(t))) return role;
  return 'detail';
}

export interface OrderInput {
  slug: string;
  title: string;
  tags: string[];
}

export interface Placement {
  track: string | null;
  role: Role;
  order: number;
}

/** "NONCONFORMIST — hell YEAH, release facts …" → "hell YEAH". */
function trackTitle(overviewTitle: string | undefined, slug: string): string {
  const m = overviewTitle ? /\s[—–-]\s(.+?),/.exec(overviewTitle) : null;
  return m ? m[1].trim() : humanize(slug);
}

/** Majority prefix before " — " in entry titles, else a humanized slug. */
function topicTitle(slug: string, titles: string[]): string {
  const counts = new Map<string, number>();
  for (const t of titles) {
    const m = /^(.+?)\s[—–]\s/.exec(t);
    if (m) counts.set(m[1].trim(), (counts.get(m[1].trim()) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1] || byCodePoint(a[0], b[0]))[0];
  return best && best[1] >= 2 && best[1] * 2 > titles.length ? best[0] : humanize(slug);
}

/** Builds one topic: tracks, roles and reading order for its entries. */
export function buildTopic(slug: string, entries: OrderInput[]): { topic: Topic; placements: Map<string, Placement> } {
  const tags = [...new Set(entries.flatMap((e) => e.tags))].sort(byCodePoint);
  const kind = topicKind(tags);
  const tailOf = (s: string) => s.slice(slug.length + 1);
  const trackSlugs = kind === 'music' ? discoverTracks(entries.map((e) => tailOf(e.slug))) : [];

  const placed = entries.map((e) => {
    const tail = tailOf(e.slug);
    const track = trackOf(tail, trackSlugs);
    const role = kind === 'music' ? musicRole(track ? tail.slice(track.length + 1) : tail) : technicalRole(tail);
    // Music: tracks in order, then topic-level material. Technical: one guided path.
    const group = kind === 'music' ? (track ? trackSlugs.indexOf(track) : trackSlugs.length) : 0;
    return { e, track, role, group };
  });
  placed.sort(
    (a, b) => a.group - b.group || ROLE_RANK[a.role] - ROLE_RANK[b.role] || byCodePoint(a.e.slug, b.e.slug),
  );

  const placements = new Map<string, Placement>();
  placed.forEach((p, order) => placements.set(p.e.slug, { track: p.track, role: p.role, order }));

  const tracks: Track[] = trackSlugs.map((t) => {
    const members = placed.filter((p) => p.track === t);
    const overview = members.find((p) => p.role === 'overview')?.e.title;
    return { slug: t, title: trackTitle(overview, t), entries: members.map((p) => p.e.slug) };
  });

  return {
    topic: {
      slug,
      title: topicTitle(
        slug,
        entries.map((e) => e.title),
      ),
      kind,
      entries: placed.map((p) => p.e.slug),
      tracks,
      tags,
    },
    placements,
  };
}
