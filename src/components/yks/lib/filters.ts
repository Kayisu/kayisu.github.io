import { candidateAdvantage, type MedicineProgram, type ProgramLanguage, type Scholarship, type UniversityType } from '../../../data/yks';
import { foldForSearch } from './turkish';

export type SortKey = 'advantage' | 'closingRank' | 'quota' | 'tuition' | 'name' | 'city';
export type RankRelation = 'all' | 'ahead' | 'behind';

export interface FilterState {
  candidateRank: number;
  query: string;
  types: UniversityType[];
  cities: string[];
  languages: ProgramLanguage[];
  scholarships: Scholarship[];
  accreditedOnly: boolean;
  rankMin: number | null;
  rankMax: number | null;
  quotaMin: number | null;
  quotaMax: number | null;
  tuitionMin: number | null;
  tuitionMax: number | null;
  relation: RankRelation;
  withoutHistoryOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: FilterState = {
  candidateRank: 26_000,
  query: '',
  types: [],
  cities: [],
  languages: [],
  scholarships: [],
  accreditedOnly: false,
  rankMin: null,
  rankMax: null,
  quotaMin: null,
  quotaMax: null,
  tuitionMin: null,
  tuitionMax: null,
  relation: 'all',
  withoutHistoryOnly: false,
  sort: 'advantage',
};

export const SORT_LABELS: Record<SortKey, string> = {
  advantage: 'Aday sırasına en yakın fark',
  closingRank: '2025 kapanış sırası',
  quota: 'Genel kontenjan',
  tuition: 'Yıllık ücret',
  name: 'Üniversite adı',
  city: 'Şehir',
};

const within = (value: number | null, min: number | null, max: number | null) => {
  if (min === null && max === null) return true;
  if (value === null) return false;
  return (min === null || value >= min) && (max === null || value <= max);
};

export function filterPrograms(source: MedicineProgram[], filters: FilterState): MedicineProgram[] {
  const query = foldForSearch(filters.query.trim());
  return source.filter((program) => {
    const haystack = foldForSearch([program.universityName, program.city, program.faculty, program.program, program.programCode].filter(Boolean).join(' '));
    const advantage = candidateAdvantage(program, filters.candidateRank);
    return (!query || haystack.includes(query))
      && (!filters.types.length || filters.types.includes(program.universityType))
      && (!filters.cities.length || (program.city !== null && filters.cities.includes(program.city)))
      && (!filters.languages.length || filters.languages.includes(program.language))
      && (!filters.scholarships.length || filters.scholarships.includes(program.scholarship))
      && (!filters.accreditedOnly || program.accreditation !== null)
      && within(program.closingRank2025, filters.rankMin, filters.rankMax)
      && within(program.quotas.general, filters.quotaMin, filters.quotaMax)
      && within(program.annualTuition, filters.tuitionMin, filters.tuitionMax)
      && (filters.relation === 'all' || (filters.relation === 'ahead' ? advantage !== null && advantage >= 0 : advantage !== null && advantage < 0))
      && (!filters.withoutHistoryOnly || program.closingRank2025 === null);
  }).sort((a, b) => comparePrograms(a, b, filters.sort, filters.candidateRank));
}

function nullableNumber(a: number | null, b: number | null, direction = 1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export function comparePrograms(a: MedicineProgram, b: MedicineProgram, sort: SortKey, rank: number): number {
  if (sort === 'advantage') {
    const aa = candidateAdvantage(a, rank), ba = candidateAdvantage(b, rank);
    if (aa === null && ba === null) return a.universityName.localeCompare(b.universityName, 'tr');
    if (aa === null) return 1;
    if (ba === null) return -1;
    return Math.abs(aa) - Math.abs(ba) || aa - ba;
  }
  if (sort === 'closingRank') return nullableNumber(a.closingRank2025, b.closingRank2025);
  if (sort === 'quota') return nullableNumber(a.quotas.general, b.quotas.general, -1);
  if (sort === 'tuition') return nullableNumber(a.annualTuition, b.annualTuition);
  if (sort === 'city') return (a.city ?? 'ZZZ').localeCompare(b.city ?? 'ZZZ', 'tr');
  return a.universityName.localeCompare(b.universityName, 'tr');
}

export function activeFilterCount(filters: FilterState): number {
  return [filters.query, filters.types.length, filters.cities.length, filters.languages.length, filters.scholarships.length,
    filters.accreditedOnly, filters.rankMin, filters.rankMax, filters.quotaMin, filters.quotaMax,
    filters.tuitionMin, filters.tuitionMax, filters.relation !== 'all', filters.withoutHistoryOnly].filter(Boolean).length;
}
