export interface EarthGameDefinition {
  slug: 'sandbox';
  title: string;
  summary: string;
  status: 'prototype' | 'active' | 'shipped';
  href: '/sandstruction/' | `/planet/earth/games/${string}/`;
  controls: readonly string[];
}
export const EARTH_GAMES = [{
  slug: 'sandbox', title: 'Sandstruction',
  summary: 'This page is under construction. Build something while you’re here: drive six machines, move earth, grade and pave your own roads.',
  status: 'prototype', href: '/sandstruction/',
  controls: ['Drive six machines', 'Excavate & haul', 'Grade & pave', 'Undo & save locally'],
}] as const satisfies readonly EarthGameDefinition[];
