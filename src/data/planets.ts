// Single source of truth for every celestial body.
// Ported verbatim from the original script.js createPlanet(...) calls so the
// scene, the info panel, the search box, and the per-body pages all read the
// same data. Distances are scaled for aesthetics; orbital speed is *derived*
// from distance (see `orbitalSpeed`), not stored.

export interface Body {
  /** lowercase id, also used in URLs and search */
  name: string;
  /** route to the dedicated page for this body */
  href: string;
  /** sphere radius in scene units */
  radius: number;
  /** orbit distance from the sun in scene units (0 for the sun) */
  distance: number;
  /** flat-color fallback / Saturn ring tint */
  color: number;
  /** texture under public/textures/ */
  texture: string;
  /** category label shown in the info panel and as the detail-page eyebrow */
  type: string;
  /** identity tagline shown in the info panel and detail page */
  desc: string;
  /** the sun is lit differently and does not orbit */
  isStar?: boolean;
  /** Saturn's ring */
  hasRing?: boolean;
}

export const SUN: Body = {
  name: 'sun',
  href: '/star/sun',
  radius: 3,
  distance: 0,
  color: 0xfff4c2,
  texture: '/textures/sun.jpg',
  type: 'Core',
  desc: "The center everything orbits. Who I am, what I'm chasing, and why.",
  isStar: true,
};

export const PLANETS: Body[] = [
  {
    name: 'mercury',
    href: '/planet/mercury',
    radius: 0.4,
    distance: 6,
    color: 0x8a7761,
    texture: '/textures/mercury.jpg',
    type: 'Tools',
    desc: 'Small, sharp utilities — single-purpose things that just work.',
  },
  {
    name: 'venus',
    href: '/planet/venus',
    radius: 0.8,
    distance: 10,
    color: 0xd4a96a,
    texture: '/textures/venus.jpg',
    type: 'Creative',
    desc: 'Stories, games, and designs — things I make to be felt, not just used.',
  },
  {
    name: 'earth',
    href: '/planet/earth',
    radius: 0.9,
    distance: 15,
    color: 0x5a7684,
    texture: '/textures/earth.jpg',
    type: 'Roots',
    desc: 'Where I come from — education, fundamentals, the ground I\'m built on.',
  },
  {
    name: 'mars',
    href: '/planet/mars',
    radius: 0.7,
    distance: 21,
    color: 0x9b5d4e,
    texture: '/textures/mars.jpg',
    type: 'Research',
    desc: "Frontier questions and unfinished problems I'm pushing into.",
  },
  {
    name: 'jupiter',
    href: '/planet/jupiter',
    radius: 2.0,
    distance: 32,
    color: 0xc9a87c,
    texture: '/textures/jupiter.jpg',
    type: 'Ventures',
    desc: 'The big bets — startups and products with real weight behind them.',
  },
  {
    name: 'saturn',
    href: '/planet/saturn',
    radius: 1.7,
    distance: 45,
    color: 0xe2cfb5,
    texture: '/textures/saturn.jpg',
    type: 'Systems',
    desc: 'Serious, durable engineering — built with structure and meant to last.',
    hasRing: true,
  },
  {
    name: 'uranus',
    href: '/planet/uranus',
    radius: 1.2,
    distance: 58,
    color: 0x9ed8d8,
    texture: '/textures/uranus.jpg',
    type: 'Lab',
    desc: 'Experiments and prototypes — half-finished, rule-breaking, learning by doing.',
  },
  {
    name: 'neptune',
    href: '/planet/neptune',
    radius: 1.1,
    distance: 70,
    color: 0x2e5fb5,
    texture: '/textures/neptune.jpg',
    type: 'Mind',
    desc: 'Essays, ideas, and the thinking itself — process over product.',
  },
  {
    name: 'pluto',
    href: '/planet/pluto',
    radius: 0.3,
    distance: 85,
    color: 0xbcb5a7,
    texture: '/textures/pluto.jpg',
    type: 'Archive',
    desc: 'Retired and old work — cold storage, kept for the record.',
  },
];

/** Every body, sun first. */
export const BODIES: Body[] = [SUN, ...PLANETS];

/** Kepler's-third-law approximation used in the original: v ~ 1 / sqrt(distance). */
export function orbitalSpeed(distance: number): number {
  return (1 / Math.sqrt(distance)) * 0.015;
}

export function getBody(name: string): Body | undefined {
  return BODIES.find((b) => b.name === name);
}
