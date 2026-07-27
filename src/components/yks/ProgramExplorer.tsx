import { useMemo } from 'react';

import {
  BAND_DESCRIPTIONS,
  BAND_LABELS,
  BAND_ORDER,
  SCHOLARSHIP_LABELS,
  TYPE_LABELS,
  programs,
  type ProbabilityBand,
  type Program,
} from '../../data/yks';
import { MAX_SHORTLIST_SIZE, useYksStore } from '../../store/yksStore';
import ProgramCard from './ProgramCard';
import { SORT_LABELS, activeFilterCount, filterPrograms, type SortKey } from './lib/filters';
import { formatNumber } from './lib/format';

const TYPE_OPTIONS: Program['type'][] = ['state', 'foundation', 'kktc-intl'];
const SCHOLARSHIP_OPTIONS = ['full', 'half', 'quarter', 'paid'] as const;
const PAYMENT_CAPS = [
  { value: 600_000, label: '600 bin TL' },
  { value: 900_000, label: '900 bin TL' },
  { value: 1_200_000, label: '1,2 milyon TL' },
];

export default function ProgramExplorer() {
  const filters = useYksStore((state) => state.filters);
  const shortlist = useYksStore((state) => state.shortlist);
  const setQuery = useYksStore((state) => state.setQuery);
  const setSort = useYksStore((state) => state.setSort);
  const setMaxPayment = useYksStore((state) => state.setMaxPayment);
  const toggleType = useYksStore((state) => state.toggleType);
  const toggleBand = useYksStore((state) => state.toggleBand);
  const toggleScholarship = useYksStore((state) => state.toggleScholarship);
  const toggleLanguage = useYksStore((state) => state.toggleLanguage);
  const resetFilters = useYksStore((state) => state.resetFilters);
  const toggleShortlist = useYksStore((state) => state.toggleShortlist);
  const openDetail = useYksStore((state) => state.openDetail);

  const visible = useMemo(() => filterPrograms(programs, filters), [filters]);
  const activeCount = activeFilterCount(filters);
  const shortlistFull = shortlist.length >= MAX_SHORTLIST_SIZE;

  return (
    <div>
      <div className="yks-filters">
        <label className="yks-field">
          <span>Üniversite, şehir veya program kodu ara</span>
          <input
            className="yks-input"
            type="search"
            value={filters.query}
            placeholder="örn. Çukurova, Ankara, 105710015"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <fieldset className="yks-fieldset">
          <legend>Şans bandı</legend>
          <div className="yks-chips">
            {BAND_ORDER.map((band: ProbabilityBand) => (
              <button
                key={band}
                type="button"
                className="yks-chip"
                aria-pressed={filters.bands.includes(band)}
                title={BAND_DESCRIPTIONS[band]}
                onClick={() => toggleBand(band)}
              >
                {BAND_LABELS[band]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="yks-fieldset">
          <legend>Üniversite türü</legend>
          <div className="yks-chips">
            {TYPE_OPTIONS.map((type) => (
              <button
                key={type}
                type="button"
                className="yks-chip"
                aria-pressed={filters.types.includes(type)}
                onClick={() => toggleType(type)}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="yks-fieldset">
          <legend>Burs durumu</legend>
          <div className="yks-chips">
            {SCHOLARSHIP_OPTIONS.map((tier) => (
              <button
                key={tier}
                type="button"
                className="yks-chip"
                aria-pressed={filters.scholarships.includes(tier)}
                onClick={() => toggleScholarship(tier)}
              >
                {SCHOLARSHIP_LABELS[tier]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="yks-fieldset">
          <legend>Eğitim dili</legend>
          <div className="yks-chips">
            <button
              type="button"
              className="yks-chip"
              aria-pressed={filters.languages.includes('tr')}
              onClick={() => toggleLanguage('tr')}
            >
              Türkçe
            </button>
            <button
              type="button"
              className="yks-chip"
              aria-pressed={filters.languages.includes('en')}
              onClick={() => toggleLanguage('en')}
            >
              İngilizce
            </button>
          </div>
        </fieldset>

        <fieldset className="yks-fieldset">
          <legend>Yıllık ödeme üst sınırı</legend>
          <div className="yks-chips">
            {PAYMENT_CAPS.map((cap) => (
              <button
                key={cap.value}
                type="button"
                className="yks-chip"
                aria-pressed={filters.maxPayment === cap.value}
                onClick={() => setMaxPayment(filters.maxPayment === cap.value ? null : cap.value)}
              >
                En çok {cap.label}
              </button>
            ))}
          </div>
          <p className="yks-card-sub">
            Ücreti yayımlanmamış programlar bu sınıra takılmaz; listede kalır.
          </p>
        </fieldset>

        <label className="yks-field">
          <span>Sıralama</span>
          <select
            className="yks-select"
            value={filters.sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <div className="yks-filter-actions">
          <span className="yks-result-count" role="status">
            {formatNumber(visible.length)} program listeleniyor
            {activeCount > 0 ? ` • ${activeCount} filtre etkin` : ''}
          </span>
          {activeCount > 0 && (
            <button type="button" className="yks-button" onClick={resetFilters}>
              Filtreleri temizle
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="yks-empty">
          Bu filtrelerle eşleşen program yok. Bir filtreyi kaldırıp yeniden deneyin.
        </p>
      ) : (
        <ul className="yks-list yks-list--grid">
          {visible.map((program) => (
            <ProgramCard
              key={program.code}
              program={program}
              shortlisted={shortlist.includes(program.code)}
              shortlistFull={shortlistFull}
              onToggleShortlist={toggleShortlist}
              onOpenDetail={openDetail}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
