import {
  BAND_ORDER,
  type ProbabilityBand,
  type Program,
  type ScholarshipTier,
} from '../../../data/yks';
import { compareTurkish, matchesQuery } from './turkish';

export type SortKey = 'rank' | 'name' | 'cost' | 'quota';

export interface FilterState {
  query: string;
  types: Program['type'][];
  bands: ProbabilityBand[];
  scholarships: Exclude<ScholarshipTier, null>[];
  languages: Program['language'][];
  /** Upper bound on annual payment in TL; `null` means no limit. */
  maxPayment: number | null;
  sort: SortKey;
}

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  types: [],
  bands: [],
  scholarships: [],
  languages: [],
  maxPayment: null,
  sort: 'rank',
};

function searchableText(program: Program): string {
  return [program.university, program.programName, program.city, program.code]
    .filter(Boolean)
    .join(' ');
}

/**
 * Programmes with no published figure are kept under a payment cap: hiding them
 * would silently imply they cost more than the cap, which is not known.
 */
function withinPayment(program: Program, maxPayment: number | null): boolean {
  if (maxPayment === null || program.estimatedPayment === null) return true;
  return program.estimatedPayment <= maxPayment;
}

export function filterPrograms(programs: Program[], filters: FilterState): Program[] {
  const result = programs.filter((program) => {
    if (filters.types.length > 0 && !filters.types.includes(program.type)) return false;
    if (filters.bands.length > 0 && !filters.bands.includes(program.band)) return false;
    if (filters.languages.length > 0 && !filters.languages.includes(program.language)) return false;
    if (filters.scholarships.length > 0) {
      if (program.scholarship === null) return false;
      if (!filters.scholarships.includes(program.scholarship)) return false;
    }
    if (!withinPayment(program, filters.maxPayment)) return false;
    if (filters.query.trim() && !matchesQuery(searchableText(program), filters.query)) return false;
    return true;
  });

  return result.sort(comparators[filters.sort]);
}

const comparators: Record<SortKey, (a: Program, b: Program) => number> = {
  // Best chance first: programmes without history sort last rather than as 0.
  rank: (a, b) => {
    if (a.closingRank2025 === null && b.closingRank2025 === null) {
      return compareTurkish(a.university, b.university);
    }
    if (a.closingRank2025 === null) return 1;
    if (b.closingRank2025 === null) return -1;
    return b.closingRank2025 - a.closingRank2025;
  },
  name: (a, b) => compareTurkish(a.university, b.university)
    || compareTurkish(a.programName, b.programName),
  cost: (a, b) => {
    if (a.estimatedPayment === null && b.estimatedPayment === null) {
      return compareTurkish(a.university, b.university);
    }
    if (a.estimatedPayment === null) return 1;
    if (b.estimatedPayment === null) return -1;
    return a.estimatedPayment - b.estimatedPayment;
  },
  quota: (a, b) => b.quota2026 - a.quota2026,
};

export const SORT_LABELS: Record<SortKey, string> = {
  rank: 'Şansa göre (en yüksek önce)',
  name: 'Üniversite adına göre',
  cost: 'Ücrete göre (en düşük önce)',
  quota: 'Kontenjana göre (en yüksek önce)',
};

export function countByBand(programs: Program[]): Record<ProbabilityBand, number> {
  const counts = Object.fromEntries(
    BAND_ORDER.map((band) => [band, 0]),
  ) as Record<ProbabilityBand, number>;
  for (const program of programs) counts[program.band] += 1;
  return counts;
}

export function activeFilterCount(filters: FilterState): number {
  return filters.types.length
    + filters.bands.length
    + filters.scholarships.length
    + filters.languages.length
    + (filters.maxPayment === null ? 0 : 1)
    + (filters.query.trim() ? 1 : 0);
}
