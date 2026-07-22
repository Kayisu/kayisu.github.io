import { en } from './dictionaries/en';
import { tr } from './dictionaries/tr';
import type { Locale } from './config';

export { DEFAULT_LOCALE, LOCALES, isLocale, localeMeta, otherLocale } from './config';
export type { Locale, LocaleMetadata } from './config';
export type {
  BodyCopy,
  CelestialBodyId,
  Dictionary,
  ProjectStatus,
} from './types';
export {
  explorePath,
  getAlternatePaths,
  homePath,
  languageSwitchPath,
  planetPath,
  projectPath,
  resolveEquivalentPath,
  sectionPath,
} from './routes';
export type { AbsolutePath, LocalisedRoute } from './routes';

export const dictionaries = { en, tr } as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
