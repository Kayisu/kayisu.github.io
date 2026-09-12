import type { Locale } from './config';

export type CelestialBodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto';

export type ProjectStatus = 'active' | 'shipped' | 'prototype' | 'wip' | 'archived';
export type ProjectKind = 'product' | 'research' | 'experiment' | 'writing' | 'tool' | 'game';

export interface BodyCopy {
  name: string;
  category: string;
  description: string;
}

export interface Dictionary {
  locale: Locale;
  metadata: {
    landingTitle: string;
    landingDescription: string;
    exploreTitle: string;
    exploreDescription: string;
    planetTitleSuffix: string;
    projectsTitle: string;
  };
  common: {
    home: string;
    back: string;
    open: string;
    repository: string;
    demo: string;
    readMore: string;
  };
  nav: {
    label: string;
    home: string;
    projects: string;
    about: string;
    contact: string;
    explore: string;
    github: string;
    openMenu: string;
  };
  language: {
    label: string;
    switchTo: string;
    shortTarget: string;
  };
  theme: {
    label: string;
    system: string;
    light: string;
    dark: string;
  };
  hero: {
    eyebrow: string;
    introduction: string;
    viewProjects: string;
    exploreSystem: string;
  };
  sections: {
    featuredEyebrow: string;
    featuredTitle: string;
    featuredDescription: string;
    currentEyebrow: string;
    currentTitle: string;
    currentDescription: string;
    categoriesEyebrow: string;
    categoriesTitle: string;
    categoriesDescription: string;
    allCategories: string;
    aboutEyebrow: string;
    aboutTitle: string;
    contactEyebrow: string;
    contactTitle: string;
    contactBody: string;
  };
  profile: {
    now: string;
    path: string;
  };
  project: {
    projects: string;
    featured: string;
    currentWork: string;
    status: string;
    role: string;
    team: string;
    year: string;
    period: string;
    technologies: string;
    highlights: string;
    gallery: string;
    previous: string;
    next: string;
    backToProjects: string;
    backToCategory: string;
    emptyQuiet: string;
    kind: Record<ProjectKind, string>;
  };
  status: Record<ProjectStatus, string>;
  planet: {
    categoryLabel: string;
    projectCount: string;
    projectCountPlural: string;
    gamesTitle: string;
    gamesDescription: string;
    exploreGames: string;
    gamesBackToEarth: string;
    gamesControls: string;
  };
  solar: {
    canvasLabel: string;
    loadingLabel: string;
    unavailableTitle: string;
    unavailableMessage: string;
    errorTitle: string;
    errorMessage: string;
    contextLostTitle: string;
    contextLostMessage: string;
    speedLabel: string;
    speedOptions: {
      paused: string;
      half: string;
      normal: string;
      double: string;
    };
    searchLabel: string;
    searchPlaceholder: string;
    searchNoResults: string;
    closeLabel: string;
    typeLabel: string;
    exploreLabel: string;
    previewLabel: string;
    keyboardHelp: string;
    bodies: Record<CelestialBodyId, BodyCopy>;
  };
  accessibility: {
    skipToContent: string;
    externalLink: string;
  };
  contact: {
    email: string;
    github: string;
    linkedin: string;
  };
  footer: {
    navigationLabel: string;
    note: string;
  };
}
