import { create } from 'zustand';

import {
  DEFAULT_FILTERS,
  type FilterState,
  type SortKey,
} from '../components/yks/lib/filters';
import type { ProbabilityBand, Program, ScholarshipTier } from '../data/yks';

export type YksTab = 'explore' | 'scenarios' | 'foundations' | 'compare';

const STORAGE_KEY = 'yks-2026-tip-shortlist';
const STORAGE_VERSION = 1;
const MAX_SHORTLIST = 24;

interface StoredShortlist {
  version: number;
  codes: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Rejects anything that is not a current-version shortlist. Old or corrupted
 * payloads are dropped rather than partially trusted.
 */
function parseShortlist(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (value.version !== STORAGE_VERSION) return null;
    if (!Array.isArray(value.codes)) return null;
    const codes = value.codes.filter(
      (code): code is string => typeof code === 'string' && /^\d{9}$/.test(code),
    );
    return codes.slice(0, MAX_SHORTLIST);
  } catch {
    return null;
  }
}

function readShortlist(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseShortlist(window.localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function writeShortlist(codes: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredShortlist = { version: STORAGE_VERSION, codes };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private-browsing or quota failures must not break the page.
  }
}

interface YksState {
  tab: YksTab;
  filters: FilterState;
  /** Programme codes in the user's preference order. */
  shortlist: string[];
  detail: Program | null;
  setTab: (tab: YksTab) => void;
  setQuery: (query: string) => void;
  setSort: (sort: SortKey) => void;
  setMaxPayment: (maxPayment: number | null) => void;
  toggleType: (type: Program['type']) => void;
  toggleBand: (band: ProbabilityBand) => void;
  toggleScholarship: (tier: Exclude<ScholarshipTier, null>) => void;
  toggleLanguage: (language: Program['language']) => void;
  resetFilters: () => void;
  toggleShortlist: (code: string) => void;
  moveShortlist: (code: string, direction: -1 | 1) => void;
  clearShortlist: () => void;
  openDetail: (program: Program) => void;
  closeDetail: () => void;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export const MAX_SHORTLIST_SIZE = MAX_SHORTLIST;

export const useYksStore = create<YksState>((set, get) => ({
  tab: 'explore',
  filters: DEFAULT_FILTERS,
  shortlist: readShortlist(),
  detail: null,

  setTab: (tab) => set({ tab }),
  setQuery: (query) => set((state) => ({ filters: { ...state.filters, query } })),
  setSort: (sort) => set((state) => ({ filters: { ...state.filters, sort } })),
  setMaxPayment: (maxPayment) => set((state) => ({ filters: { ...state.filters, maxPayment } })),

  toggleType: (type) => set((state) => ({
    filters: { ...state.filters, types: toggle(state.filters.types, type) },
  })),
  toggleBand: (band) => set((state) => ({
    filters: { ...state.filters, bands: toggle(state.filters.bands, band) },
  })),
  toggleScholarship: (tier) => set((state) => ({
    filters: { ...state.filters, scholarships: toggle(state.filters.scholarships, tier) },
  })),
  toggleLanguage: (language) => set((state) => ({
    filters: { ...state.filters, languages: toggle(state.filters.languages, language) },
  })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  toggleShortlist: (code) => {
    const current = get().shortlist;
    const next = current.includes(code)
      ? current.filter((item) => item !== code)
      : current.length >= MAX_SHORTLIST ? current : [...current, code];
    if (next !== current) {
      writeShortlist(next);
      set({ shortlist: next });
    }
  },

  moveShortlist: (code, direction) => {
    const current = get().shortlist;
    const index = current.indexOf(code);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    writeShortlist(next);
    set({ shortlist: next });
  },

  clearShortlist: () => {
    writeShortlist([]);
    set({ shortlist: [] });
  },

  openDetail: (program) => set({ detail: program }),
  closeDetail: () => set({ detail: null }),
}));
