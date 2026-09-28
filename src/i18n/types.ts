import type { Locale } from './config';

export type ProjectStatus = 'done' | 'live' | 'building' | 'parked' | 'archived' | 'oneshot';

export interface Dictionary {
  locale: Locale;
  metadata: {
    landingTitle: string;
    landingDescription: string;
    aboutTitle: string;
  };
  language: {
    switchTo: string;
    shortTarget: string;
  };
  nav: {
    about: string;
  };
  project: {
    back: string;
    what: string;
    role: string;
    year: string;
    links: string;
    demo: string;
    code: string;
    construction: string;
  };
  profile: {
    now: string;
    path: string;
    aim: string;
  };
  status: Record<ProjectStatus, string>;
  accessibility: {
    projectList: string;
    orbitInner: string;
    orbitMiddle: string;
    orbitOuter: string;
    orbitComet: string;
    externalLink: string;
  };
  notFound: {
    message: string;
    home: string;
  };
  contact: {
    email: string;
    github: string;
    linkedin: string;
  };
}
