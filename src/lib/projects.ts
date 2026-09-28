import type { CollectionEntry } from 'astro:content';
import { getProjectPalette } from '../data/palettes';

export type ProjectEntry = CollectionEntry<'projects'>;

export function validateProjects(entries: readonly ProjectEntry[]) {
  const byKey = new Map(entries.map((entry) => [entry.data.translationKey, entry.data]));
  for (const { data } of entries) {
    getProjectPalette(data.translationKey);
    if (!data.parent) continue;
    const parent = byKey.get(data.parent);
    const fail = (reason: string) => {
      throw new Error(`Project "${data.translationKey}" cannot orbit "${data.parent}": ${reason}.`);
    };
    // Moons are drawn around planets only, one level deep, inside the parent's own system.
    if (!parent) fail('unknown project');
    else if (parent.parent) fail('the parent is itself a moon');
    else if (orbitForStatus(parent.status) === 'comet') fail('comets carry no moons');
    else if (parent.system !== data.system) fail('the parent is in another star system');
  }
}

export function orbitForStatus(status: ProjectEntry['data']['status']) {
  if (status === 'done' || status === 'live') return 'inner';
  if (status === 'building') return 'middle';
  if (status === 'parked' || status === 'archived') return 'outer';
  return 'comet';
}
