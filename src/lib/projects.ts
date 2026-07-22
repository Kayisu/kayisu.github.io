import { getCollection, type CollectionEntry } from 'astro:content';
import { LOCALES, planetPath, projectPath, type Locale } from '../i18n';

export const PROJECT_LOCALES = LOCALES;
export type ProjectLocale = Locale;
export type ProjectEntry = CollectionEntry<'projects'>;
export type ProjectPlanet = ProjectEntry['data']['planet'];

export interface ProjectNeighbours {
  previous?: ProjectEntry;
  next?: ProjectEntry;
}

export interface ProjectIndex {
  readonly all: readonly ProjectEntry[];
  forLocale(locale: ProjectLocale): readonly ProjectEntry[];
  forPlanet(locale: ProjectLocale, planet: ProjectPlanet): readonly ProjectEntry[];
  find(locale: ProjectLocale, slug: string): ProjectEntry | undefined;
  translationOf(entry: ProjectEntry, locale: ProjectLocale): ProjectEntry | undefined;
  neighboursOf(entry: ProjectEntry): ProjectNeighbours;
}

export function projectHref(entry: ProjectEntry): string {
  return projectPath(entry.data.locale, entry.data.slug);
}

export function planetHref(locale: ProjectLocale, planet: ProjectPlanet): string {
  return planetPath(locale, planet);
}

export function sortProjects(
  entries: readonly ProjectEntry[],
  locale: ProjectLocale,
): ProjectEntry[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });

  return [...entries].sort((a, b) => {
    if (Boolean(a.data.featured) !== Boolean(b.data.featured)) {
      return a.data.featured ? -1 : 1;
    }
    if ((a.data.year ?? 0) !== (b.data.year ?? 0)) {
      return (b.data.year ?? 0) - (a.data.year ?? 0);
    }
    return collator.compare(a.data.title, b.data.title) || a.data.slug.localeCompare(b.data.slug);
  });
}

function duplicateError(kind: string, key: string, entries: readonly ProjectEntry[]): Error {
  const sources = entries.map((entry) => entry.id).join(', ');
  return new Error(`Duplicate project ${kind} "${key}" in: ${sources}`);
}

async function buildProjectIndex(): Promise<ProjectIndex> {
  const entries = await getCollection('projects');
  const byLocale = new Map<ProjectLocale, ProjectEntry[]>();
  const byLocaleAndSlug = new Map<string, ProjectEntry>();
  const byLocaleAndTranslation = new Map<string, ProjectEntry>();
  const byTranslation = new Map<string, ProjectEntry[]>();

  for (const locale of PROJECT_LOCALES) byLocale.set(locale, []);

  for (const entry of entries) {
    const { locale, slug, translationKey } = entry.data;
    const sourceLocale = entry.id.replace(/\\/g, '/').split('/')[0];
    if (sourceLocale !== locale) {
      throw new Error(
        `Project locale "${locale}" does not match its source directory "${sourceLocale}": ${entry.id}`,
      );
    }
    const slugKey = `${locale}:${slug}`;
    const translationKeyForLocale = `${locale}:${translationKey}`;

    if (byLocaleAndSlug.has(slugKey)) {
      throw duplicateError('slug', slugKey, [byLocaleAndSlug.get(slugKey)!, entry]);
    }
    if (byLocaleAndTranslation.has(translationKeyForLocale)) {
      throw duplicateError('translation key', translationKeyForLocale, [
        byLocaleAndTranslation.get(translationKeyForLocale)!,
        entry,
      ]);
    }

    byLocaleAndSlug.set(slugKey, entry);
    byLocaleAndTranslation.set(translationKeyForLocale, entry);
    byLocale.get(locale)!.push(entry);
    const translations = byTranslation.get(translationKey) ?? [];
    translations.push(entry);
    byTranslation.set(translationKey, translations);
  }

  for (const [translationKey, translations] of byTranslation) {
    const planets = new Set(translations.map((entry) => entry.data.planet));
    if (planets.size > 1) {
      const sources = translations.map((entry) => entry.id).join(', ');
      throw new Error(`Project translations for "${translationKey}" use different planets: ${sources}`);
    }
  }

  for (const locale of PROJECT_LOCALES) {
    byLocale.set(locale, sortProjects(byLocale.get(locale)!, locale));
  }

  const all = PROJECT_LOCALES.flatMap((locale) => byLocale.get(locale)!);

  return {
    all,
    forLocale(locale) {
      return byLocale.get(locale) ?? [];
    },
    forPlanet(locale, planet) {
      return (byLocale.get(locale) ?? []).filter((entry) => entry.data.planet === planet);
    },
    find(locale, slug) {
      return byLocaleAndSlug.get(`${locale}:${slug}`);
    },
    translationOf(entry, locale) {
      return byLocaleAndTranslation.get(`${locale}:${entry.data.translationKey}`);
    },
    neighboursOf(entry) {
      const categoryEntries = (byLocale.get(entry.data.locale) ?? []).filter(
        (candidate) => candidate.data.planet === entry.data.planet,
      );
      const index = categoryEntries.findIndex((candidate) => candidate.id === entry.id);
      return index < 0
        ? {}
        : {
            previous: index > 0 ? categoryEntries[index - 1] : undefined,
            next: index < categoryEntries.length - 1 ? categoryEntries[index + 1] : undefined,
          };
    },
  };
}

let projectIndexPromise: Promise<ProjectIndex> | undefined;

/** Load and validate all project metadata once during a static build. */
export function getProjectIndex(): Promise<ProjectIndex> {
  projectIndexPromise ??= buildProjectIndex();
  return projectIndexPromise;
}
