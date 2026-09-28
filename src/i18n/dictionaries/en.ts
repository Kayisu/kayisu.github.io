import type { Dictionary } from '../types';

export const en = {
  locale: 'en',
  metadata: {
    landingTitle: 'Emre Kaan Ataş | Universe',
    landingDescription: 'Projects by Emre Kaan Ataş.',
    aboutTitle: 'Emre Kaan Ataş | About',
  },
  language: { switchTo: 'Switch to Turkish', shortTarget: 'TR' },
  nav: { about: 'About' },
  project: {
    back: 'universe',
    what: 'what',
    role: 'role',
    year: 'year',
    links: 'links',
    demo: 'demo',
    code: 'code',
    construction: 'under construction',
  },
  profile: { now: 'Now', path: 'Path', aim: 'Aim' },
  status: {
    done: 'done',
    live: 'live',
    building: 'under construction',
    parked: 'parked',
    archived: 'archived',
    oneshot: 'one-off',
  },
  accessibility: {
    projectList: 'Project list',
    orbitInner: 'Inner orbit',
    orbitMiddle: 'Middle orbit',
    orbitOuter: 'Outer orbit',
    orbitComet: 'Comets',
    externalLink: 'Opens in a new tab',
  },
  notFound: { message: 'Page not found.', home: 'Home' },
  contact: { email: 'Email', github: 'GitHub', linkedin: 'LinkedIn' },
} satisfies Dictionary;
