import { DEFAULT_LOCALE, type Locale, otherLocale } from './config';
import type { CelestialBodyId } from './types';

export type AbsolutePath = `/${string}`;

export type LocalisedRoute =
  | { kind: 'landing' }
  | { kind: 'explore' }
  | { kind: 'planet'; name: Exclude<CelestialBodyId, 'sun'> }
  | { kind: 'project'; slugs: Partial<Record<Locale, string>> }
  | { kind: 'sun' }
  | { kind: 'earth-games' }
  | { kind: 'sandbox' };

function encodeSegment(segment: string): string {
  return encodeURIComponent(segment.trim());
}

export function homePath(locale: Locale): AbsolutePath {
  return locale === DEFAULT_LOCALE ? '/' : '/tr/';
}

export function explorePath(locale: Locale): AbsolutePath {
  return locale === DEFAULT_LOCALE ? '/explore/' : '/tr/explore/';
}

export function planetPath(locale: Locale, name: Exclude<CelestialBodyId, 'sun'>): AbsolutePath {
  const segment = encodeSegment(name);
  return locale === DEFAULT_LOCALE
    ? `/planet/${segment}/`
    : `/tr/planet/${segment}/`;
}

export function projectPath(locale: Locale, slug: string): AbsolutePath {
  const segment = encodeSegment(slug);
  return locale === DEFAULT_LOCALE
    ? `/projects/${segment}/`
    : `/tr/projects/${segment}/`;
}

export function earthGamesPath(locale: Locale): AbsolutePath {
  return locale === DEFAULT_LOCALE
    ? '/planet/earth/games/'
    : '/tr/planet/earth/games/';
}

export function sectionPath(
  locale: Locale,
  section: 'projects' | 'about' | 'contact',
): `${AbsolutePath}#${string}` {
  return `${homePath(locale)}#${section}`;
}

function exactPath(route: LocalisedRoute, locale: Locale): AbsolutePath | undefined {
  switch (route.kind) {
    case 'landing':
      return homePath(locale);
    case 'explore':
      return explorePath(locale);
    case 'planet':
      return planetPath(locale, route.name);
    case 'project': {
      const slug = route.slugs[locale];
      return slug ? projectPath(locale, slug) : undefined;
    }
    case 'sun':
      return locale === DEFAULT_LOCALE ? '/star/sun/' : '/tr/star/sun/';
    case 'earth-games':
      return earthGamesPath(locale);
    case 'sandbox':
      return locale === DEFAULT_LOCALE ? '/planet/earth/games/sandbox/' : undefined;
  }
}

/**
 * Resolve the language switch destination. Routes without a translated page
 * return the target landing page.
 */
export function resolveEquivalentPath(
  route: LocalisedRoute,
  targetLocale: Locale,
): AbsolutePath | `${AbsolutePath}#${string}` {
  const equivalent = exactPath(route, targetLocale);
  if (equivalent) return equivalent;
  return homePath(targetLocale);
}

/** Only genuine page equivalents are returned; fallbacks never become hreflang links. */
export function getAlternatePaths(
  route: LocalisedRoute,
): Partial<Record<Locale, AbsolutePath>> {
  const paths: Partial<Record<Locale, AbsolutePath>> = {};

  for (const locale of ['en', 'tr'] as const) {
    const path = exactPath(route, locale);
    if (path) paths[locale] = path;
  }

  return paths;
}

export function languageSwitchPath(route: LocalisedRoute, locale: Locale) {
  return resolveEquivalentPath(route, otherLocale(locale));
}
