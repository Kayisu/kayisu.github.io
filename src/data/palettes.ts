export interface ProjectPalette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  font: { family: string; googleSpec: string };
  radius: number;
}

export const PROJECT_PALETTES = {
  cognispace: {
    bg: '#f8f7f4', surface: '#ffffff', text: '#1f1f1f', muted: '#5b5b5b', accent: '#1d9e75',
    font: { family: 'DM Sans', googleSpec: 'DM+Sans:wght@400;600' }, radius: 12,
  },
  ecoreport: {
    bg: '#eef4ec', surface: '#ffffff', text: '#12301e', muted: '#4b6353', accent: '#166534',
    font: { family: 'Public Sans', googleSpec: 'Public+Sans:wght@400;600' }, radius: 12,
  },
  sorudepo: {
    bg: '#fbfbf9', surface: '#ffffff', text: '#17181c', muted: '#5d6068', accent: '#c2410c',
    font: { family: 'Atkinson Hyperlegible', googleSpec: 'Atkinson+Hyperlegible:wght@400;700' }, radius: 4,
  },
  'yks-tercih-sihirbazi': {
    bg: '#fbf7f4', surface: '#ffffff', text: '#2a1714', muted: '#6d5550', accent: '#b4232a',
    font: { family: 'Atkinson Hyperlegible', googleSpec: 'Atkinson+Hyperlegible:wght@400;700' }, radius: 6,
  },
  sandstruction: {
    bg: '#f4ecdc', surface: '#fffaf0', text: '#2b2317', muted: '#6b5d45', accent: '#b7852f',
    font: { family: 'Fredoka', googleSpec: 'Fredoka:wght@400;600' }, radius: 16,
  },
  wordloom: {
    bg: '#f4f5fa', surface: '#ffffff', text: '#1b2333', muted: '#56607a', accent: '#3f5b8b',
    font: { family: 'Literata', googleSpec: 'Literata:wght@400;600' }, radius: 12,
  },
  statsview: {
    bg: '#f8f8f5', surface: '#ffffff', text: '#1c2622', muted: '#56645e', accent: '#356859',
    font: { family: 'Figtree', googleSpec: 'Figtree:wght@400;600' }, radius: 20,
  },
} satisfies Record<string, ProjectPalette>;

export type ProjectTranslationKey = keyof typeof PROJECT_PALETTES;

export function getProjectPalette(translationKey: string): ProjectPalette {
  const palette = PROJECT_PALETTES[translationKey as ProjectTranslationKey];
  if (!palette) {
    throw new Error(`Missing project palette for translationKey "${translationKey}" in src/data/palettes.ts.`);
  }
  return palette;
}
