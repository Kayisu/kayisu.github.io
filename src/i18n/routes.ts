import { DEFAULT_LOCALE, type Locale, otherLocale } from './config';

export type AbsolutePath = `/${string}`;

export type LocalisedRoute =
  | { kind: 'landing' }
  | { kind: 'project'; slugs: Partial<Record<Locale, string>> }
  | { kind: 'about' }
  | { kind: 'sandbox' };

type LegacySunRoute = { kind: 'sun' };

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment.trim());
}

export function homePath(locale: Locale): AbsolutePath {
  return locale === DEFAULT_LOCALE ? '/' : '/en/';
}

export function projectPath(locale: Locale, slug: string): AbsolutePath {
  const segment = encodeSegment(slug);
  return locale === DEFAULT_LOCALE
    ? `/projects/${segment}/`
    : `/en/projects/${segment}/`;
}

export function aboutPath(locale: Locale): AbsolutePath {
  return locale === DEFAULT_LOCALE ? '/about/' : '/en/about/';
}

export function sandboxPath(): AbsolutePath {
  return '/sandstruction/';
}

function exactPath(route: LocalisedRoute | LegacySunRoute, locale: Locale): AbsolutePath | undefined {
  switch (route.kind) {
    case 'landing':
      return homePath(locale);
    case 'project': {
      const slug = route.slugs[locale];
      return slug ? projectPath(locale, slug) : undefined;
    }
    case 'about':
      return aboutPath(locale);
    case 'sandbox':
      return locale === 'tr' ? sandboxPath() : undefined;
    case 'sun':
      return locale === 'tr' ? '/tr/star/sun/' : '/star/sun/';
  }
}

export function resolveEquivalentPath(
  route: LocalisedRoute | LegacySunRoute,
  targetLocale: Locale,
): AbsolutePath {
  return exactPath(route, targetLocale) ?? homePath(targetLocale);
}

export function getAlternatePaths(
  route: LocalisedRoute,
): Partial<Record<Locale, AbsolutePath>> {
  const paths: Partial<Record<Locale, AbsolutePath>> = {};
  for (const locale of ['tr', 'en'] as const) {
    const path = exactPath(route, locale);
    if (path) paths[locale] = path;
  }
  return paths;
}

export function languageSwitchPath(route: LocalisedRoute, locale: Locale) {
  return resolveEquivalentPath(route, otherLocale(locale));
}
