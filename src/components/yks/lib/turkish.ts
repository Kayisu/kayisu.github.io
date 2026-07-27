/**
 * Turkish-aware text helpers.
 *
 * Search has to fold diacritics so that typing "cukurova" finds "Çukurova",
 * while sorting must stay locale-correct so that Ç/Ğ/İ/Ö/Ş/Ü land in their
 * proper places rather than after Z.
 */

const FOLD_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u',
};

/** Lowercases with Turkish rules, then strips diacritics for loose matching. */
export function foldForSearch(value: string): string {
  return value
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (char) => FOLD_MAP[char] ?? char)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Locale-correct comparison for list ordering. */
export function compareTurkish(a: string, b: string): number {
  return a.localeCompare(b, 'tr');
}

/** True when every whitespace-separated term appears somewhere in the haystack. */
export function matchesQuery(haystack: string, query: string): boolean {
  const folded = foldForSearch(haystack);
  return foldForSearch(query)
    .split(' ')
    .filter(Boolean)
    .every((term) => folded.includes(term));
}
