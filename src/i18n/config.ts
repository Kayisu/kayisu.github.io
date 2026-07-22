export const LOCALES = ['en', 'tr'] as const;

export type Locale = (typeof LOCALES)[number];

export interface LocaleMetadata {
  label: string;
  nativeLabel: string;
  htmlLang: string;
  formatLocale: string;
  ogLocale: string;
  prefix: '' | '/tr';
}

export const DEFAULT_LOCALE: Locale = 'en';

export const localeMeta = {
  en: {
    label: 'English',
    nativeLabel: 'English',
    htmlLang: 'en',
    formatLocale: 'en-US',
    ogLocale: 'en_US',
    prefix: '',
  },
  tr: {
    label: 'Turkish',
    nativeLabel: 'Türkçe',
    htmlLang: 'tr',
    formatLocale: 'tr-TR',
    ogLocale: 'tr_TR',
    prefix: '/tr',
  },
} as const satisfies Record<Locale, LocaleMetadata>;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'tr' : 'en';
}
