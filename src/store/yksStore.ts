import { create } from 'zustand';

import { DEFAULT_FILTERS, type FilterState } from '../components/yks/lib/filters';
import type { MedicineProgram } from '../data/yks';

export type YksTab = 'explore' | 'list';
export type ViewMode = 'cards' | 'table';
export const MAX_PREFERENCES = 24;
export const STORAGE_KEY = 'yks-2026-medicine-wizard';

export interface StoredWizard {
  version: 2;
  preferences: string[];
  favourites: string[];
  candidateRank: number;
}

export function parseStoredWizard(raw: string | null): StoredWizard | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredWizard>;
    if (value.version !== 2 || !Array.isArray(value.preferences) || !Array.isArray(value.favourites)) return null;
    const clean = (codes: unknown[], limit = Infinity) => [...new Set(codes.filter((code): code is string => typeof code === 'string' && /^\d{9}$/.test(code)))].slice(0, limit);
    return {
      version: 2,
      preferences: clean(value.preferences, MAX_PREFERENCES),
      favourites: clean(value.favourites),
      candidateRank: Number.isFinite(value.candidateRank) && Number(value.candidateRank) > 0 ? Number(value.candidateRank) : 26_000,
    };
  } catch { return null; }
}

const load = (): StoredWizard => {
  if (typeof window === 'undefined') return { version: 2, preferences: [], favourites: [], candidateRank: 26_000 };
  try { return parseStoredWizard(localStorage.getItem(STORAGE_KEY)) ?? { version: 2, preferences: [], favourites: [], candidateRank: 26_000 }; }
  catch { return { version: 2, preferences: [], favourites: [], candidateRank: 26_000 }; }
};
const initial = load();

interface YksState {
  tab: YksTab;
  view: ViewMode;
  filtersOpen: boolean;
  filters: FilterState;
  preferences: string[];
  favourites: string[];
  detail: MedicineProgram | null;
  setTab: (tab: YksTab) => void;
  setView: (view: ViewMode) => void;
  setFiltersOpen: (open: boolean) => void;
  patchFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;
  togglePreference: (code: string) => void;
  movePreference: (code: string, direction: -1 | 1) => void;
  reorderPreference: (source: string, target: string) => void;
  clearPreferences: () => void;
  toggleFavourite: (code: string) => void;
  openDetail: (program: MedicineProgram) => void;
  closeDetail: () => void;
}

function persist(state: Pick<YksState, 'preferences' | 'favourites' | 'filters'>): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, preferences: state.preferences, favourites: state.favourites, candidateRank: state.filters.candidateRank })); } catch { /* storage can be unavailable */ }
}

export const useYksStore = create<YksState>((set) => ({
  tab: 'explore', view: 'cards', filtersOpen: false,
  filters: { ...DEFAULT_FILTERS, candidateRank: initial.candidateRank },
  preferences: initial.preferences, favourites: initial.favourites, detail: null,
  setTab: (tab) => set({ tab }),
  setView: (view) => set({ view }),
  setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
  patchFilters: (patch) => set((state) => { const filters = { ...state.filters, ...patch }; persist({ ...state, filters }); return { filters }; }),
  resetFilters: () => set((state) => { const filters = { ...DEFAULT_FILTERS, candidateRank: state.filters.candidateRank }; persist({ ...state, filters }); return { filters }; }),
  togglePreference: (code) => set((state) => {
    const preferences = state.preferences.includes(code) ? state.preferences.filter((item) => item !== code)
      : state.preferences.length < MAX_PREFERENCES ? [...state.preferences, code] : state.preferences;
    persist({ ...state, preferences }); return { preferences };
  }),
  movePreference: (code, direction) => set((state) => {
    const index = state.preferences.indexOf(code), target = index + direction;
    if (index < 0 || target < 0 || target >= state.preferences.length) return {};
    const preferences = [...state.preferences]; [preferences[index], preferences[target]] = [preferences[target], preferences[index]];
    persist({ ...state, preferences }); return { preferences };
  }),
  reorderPreference: (source, target) => set((state) => {
    const from = state.preferences.indexOf(source), to = state.preferences.indexOf(target);
    if (from < 0 || to < 0 || from === to) return {};
    const preferences = [...state.preferences]; preferences.splice(to, 0, preferences.splice(from, 1)[0]);
    persist({ ...state, preferences }); return { preferences };
  }),
  clearPreferences: () => set((state) => { persist({ ...state, preferences: [] }); return { preferences: [] }; }),
  toggleFavourite: (code) => set((state) => { const favourites = state.favourites.includes(code) ? state.favourites.filter((item) => item !== code) : [...state.favourites, code]; persist({ ...state, favourites }); return { favourites }; }),
  openDetail: (detail) => set({ detail }), closeDetail: () => set({ detail: null }),
}));
