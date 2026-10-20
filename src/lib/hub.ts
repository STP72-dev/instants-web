/** Groups a topic's entries (already in reading order) into the sections a hub page renders. */
import type { Entry, Role, Topic } from './manifest.ts';

export interface Stage {
  id: string;
  label: string;
  entries: Entry[];
}

export interface Chapter {
  slug: string;
  title: string;
  overview: Entry | null;
  stages: Stage[];
}

const MUSIC_STAGES: Array<[string, string, Role[]]> = [
  ['overview', 'Overview', ['overview']],
  ['sound-dna', 'Sound DNA', ['sound-dna']],
  ['variants', 'Variants', ['variant']],
  ['workflow', 'Workflow', ['workflow']],
  ['notes', 'Notes', ['supporting']],
];

const TECH_STAGES: Array<[string, string, Role[]]> = [
  ['start', 'Start here', ['overview']],
  ['concepts', 'Concepts', ['concept']],
  ['practice', 'In practice', ['practice', 'workflow']],
  ['reference', 'Reference', ['reference']],
  ['deep-dives', 'Deep dives', ['detail', 'variant', 'sound-dna', 'supporting']],
];

function stagesFor(entries: Entry[], spec: Array<[string, string, Role[]]>): Stage[] {
  return spec
    .map(([id, label, roles]) => ({ id, label, entries: entries.filter((e) => roles.includes(e.role)) }))
    .filter((s) => s.entries.length > 0);
}

/**
 * Music topics: one chapter per track (overview → sound DNA → variants → workflow), then topic-level entries
 * grouped by the same story stages (a topic without tracks still reads overview → … → workflow).
 */
export function musicChapters(topic: Topic, entries: Entry[]): { chapters: Chapter[]; rest: Stage[] } {
  const chapters = topic.tracks.map((track) => {
    const members = entries.filter((e) => e.track === track.slug);
    return {
      slug: track.slug,
      title: track.title,
      overview: members.find((e) => e.role === 'overview') ?? null,
      stages: stagesFor(members, MUSIC_STAGES),
    };
  });
  return { chapters, rest: stagesFor(entries.filter((e) => e.track === null), MUSIC_STAGES) };
}

/** Technical topics: a guided path of stages from orientation to detail. */
export function guidedPath(entries: Entry[]): Stage[] {
  return stagesFor(entries, TECH_STAGES);
}
