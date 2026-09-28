import { en } from './dictionaries/en';
import { tr } from './dictionaries/tr';
import type { Locale } from './config';

export { DEFAULT_LOCALE, LOCALES, isLocale, localeMeta, otherLocale } from './config';
export type { Locale, LocaleMetadata } from './config';
export type { Dictionary, ProjectStatus } from './types';
export {
  aboutPath,
  getAlternatePaths,
  homePath,
  languageSwitchPath,
  projectPath,
  resolveEquivalentPath,
  sandboxPath,
} from './routes';
export type { AbsolutePath, LocalisedRoute } from './routes';

export const dictionaries = { tr, en } as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
