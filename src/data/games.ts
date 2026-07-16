export interface EarthGameDefinition {
  slug: 'sandbox';
  title: string;
  summary: string;
  status: 'prototype' | 'active' | 'shipped';
  href: `/planet/earth/games/${string}/`;
  controls: readonly string[];
}

export const EARTH_GAMES = [
  {
    slug: 'sandbox',
    title: 'Sandcastle Sandbox',
    summary:
      'Sculpt a small coastal landscape, guide the water, and place towers and decorations.',
    status: 'prototype',
    href: '/planet/earth/games/sandbox/',
    controls: ['Sculpt terrain', 'Place towers', 'Decorate the shore', 'Save locally'],
  },
] as const satisfies readonly EarthGameDefinition[];
