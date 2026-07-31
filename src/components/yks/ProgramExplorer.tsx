import { useMemo } from 'react';

import { candidateAdvantage, LANGUAGE_LABELS, programs, scholarshipLabel, UNIVERSITY_TYPE_LABELS, type MedicineProgram, type ProgramLanguage, type Scholarship, type UniversityType } from '../../data/yks';
import { MAX_PREFERENCES, useYksStore } from '../../store/yksStore';
import ProgramCard from './ProgramCard';
import { activeFilterCount, filterPrograms, SORT_LABELS, type RankRelation, type SortKey } from './lib/filters';
import { formatAdvantage, formatNumber, formatRank } from './lib/format';

const types: UniversityType[] = ['public', 'foundation', 'trnc'];
const languages: ProgramLanguage[] = ['Turkish', 'English'];
const scholarships: Scholarship[] = ['none', 'full', 'discount', 'paid'];
const scholarshipLabels = { none: 'Etiketsiz', full: 'Burslu', discount: 'İndirimli', paid: 'Ücretli' };
const numberValue = (value: string) => value === '' ? null : Number(value);

export default function ProgramExplorer() {
  const store = useYksStore();
  const { filters } = store;
  const visible = useMemo(() => filterPrograms(programs, filters), [filters]);
  const cities = useMemo(() => [...new Set(programs.map((program) => program.city).filter((city): city is string => Boolean(city)))].sort((a, b) => a.localeCompare(b, 'tr')), []);
  const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const activeCount = activeFilterCount(filters);

  const filterPanel = (
    <aside className={`yks-filter-panel ${store.filtersOpen ? 'is-open' : ''}`} aria-label="Program filtreleri">
      <div className="yks-filter-title"><strong>Filtreler</strong><button type="button" className="yks-mobile-only yks-icon-button" aria-label="Filtreleri kapat" onClick={() => store.setFiltersOpen(false)}>×</button></div>
      <label className="yks-field"><span>Üniversite, şehir, fakülte veya kod</span><input type="search" value={filters.query} onChange={(e) => store.patchFilters({ query: e.target.value })} placeholder="İstanbul, Çukurova, 100210168" /></label>
      <fieldset><legend>Üniversite türü</legend><div className="yks-chips">{types.map((type) => <button key={type} type="button" aria-pressed={filters.types.includes(type)} onClick={() => store.patchFilters({ types: toggle(filters.types, type) })}>{UNIVERSITY_TYPE_LABELS[type]}</button>)}</div></fieldset>
      <label className="yks-field"><span>Şehir</span><select value={filters.cities[0] ?? ''} onChange={(e) => store.patchFilters({ cities: e.target.value ? [e.target.value] : [] })}><option value="">Tüm şehirler</option>{cities.map((city) => <option key={city}>{city}</option>)}</select></label>
      <fieldset><legend>Eğitim dili</legend><div className="yks-chips">{languages.map((language) => <button key={language} type="button" aria-pressed={filters.languages.includes(language)} onClick={() => store.patchFilters({ languages: toggle(filters.languages, language) })}>{LANGUAGE_LABELS[language]}</button>)}</div></fieldset>
      <fieldset><legend>Burs / ücret</legend><div className="yks-chips">{scholarships.map((scholarship) => <button key={scholarship} type="button" aria-pressed={filters.scholarships.includes(scholarship)} onClick={() => store.patchFilters({ scholarships: toggle(filters.scholarships, scholarship) })}>{scholarshipLabels[scholarship]}</button>)}</div></fieldset>
      <label className="yks-check"><input type="checkbox" checked={filters.accreditedOnly} onChange={(e) => store.patchFilters({ accreditedOnly: e.target.checked })} /> Yalnız TEPDAD akreditasyonlu</label>
      <div className="yks-range"><span>2025 kapanış sıra aralığı</span><input aria-label="En iyi kapanış sırası" type="number" min="1" value={filters.rankMin ?? ''} onChange={(e) => store.patchFilters({ rankMin: numberValue(e.target.value) })} placeholder="Min" /><input aria-label="En düşük kapanış sırası" type="number" min="1" value={filters.rankMax ?? ''} onChange={(e) => store.patchFilters({ rankMax: numberValue(e.target.value) })} placeholder="Maks" /></div>
      <div className="yks-range"><span>Genel kontenjan aralığı</span><input aria-label="En az kontenjan" type="number" min="0" value={filters.quotaMin ?? ''} onChange={(e) => store.patchFilters({ quotaMin: numberValue(e.target.value) })} placeholder="Min" /><input aria-label="En çok kontenjan" type="number" min="0" value={filters.quotaMax ?? ''} onChange={(e) => store.patchFilters({ quotaMax: numberValue(e.target.value) })} placeholder="Maks" /></div>
      <div className="yks-range"><span>Yıllık ücret aralığı (TL)</span><input aria-label="En az ücret" type="number" min="0" value={filters.tuitionMin ?? ''} onChange={(e) => store.patchFilters({ tuitionMin: numberValue(e.target.value) })} placeholder="Min" /><input aria-label="En çok ücret" type="number" min="0" value={filters.tuitionMax ?? ''} onChange={(e) => store.patchFilters({ tuitionMax: numberValue(e.target.value) })} placeholder="Maks" /></div>
      <p className="yks-help">Resmî tabloda yıllık ücret tutarı bulunmadığı için ücret girildiğinde sonuç çıkmayabilir.</p>
      <label className="yks-field"><span>Aday farkı</span><select value={filters.relation} onChange={(e) => store.patchFilters({ relation: e.target.value as RankRelation })}><option value="all">Tümü</option><option value="ahead">Aday önde</option><option value="behind">Aday geride</option></select></label>
      <label className="yks-check"><input type="checkbox" checked={filters.withoutHistoryOnly} onChange={(e) => store.patchFilters({ withoutHistoryOnly: e.target.checked })} /> Yalnız kapanış geçmişi olmayanlar</label>
      <button type="button" className="yks-button" onClick={store.resetFilters}>Filtreleri temizle {activeCount ? `(${activeCount})` : ''}</button>
    </aside>
  );

  return (
    <div className="yks-explorer">
      {filterPanel}
      <section className="yks-results">
        <div className="yks-toolbar">
          <label className="yks-rank-input"><span>Aday SAY sırası</span><input type="number" min="1" max="999999" value={filters.candidateRank} onChange={(e) => store.patchFilters({ candidateRank: Math.max(1, Number(e.target.value) || 1) })} /></label>
          <button type="button" className="yks-button yks-mobile-only" onClick={() => store.setFiltersOpen(true)}>Filtreler {activeCount ? `(${activeCount})` : ''}</button>
          <label><span className="sr-only">Sıralama</span><select value={filters.sort} onChange={(e) => store.patchFilters({ sort: e.target.value as SortKey })}>{Object.entries(SORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <div className="yks-view-switch" aria-label="Görünüm"><button type="button" aria-pressed={store.view === 'cards'} onClick={() => store.setView('cards')}>Kart</button><button type="button" aria-pressed={store.view === 'table'} onClick={() => store.setView('table')}>Tablo</button></div>
        </div>
        <p className="yks-result-count" role="status">{formatNumber(visible.length)} program · {store.favourites.length} favori</p>
        {!visible.length ? <p className="yks-empty">Bu filtrelerle eşleşen program yok.</p> : store.view === 'table' ? (
          <div className="yks-table-wrap"><table className="yks-program-table"><thead><tr><th>Program</th><th>Şehir / tür</th><th>2025 sıra</th><th>Aday farkı</th><th>Kont.</th><th>İşlem</th></tr></thead><tbody>{visible.map((program) => <ProgramRow key={program.programCode} program={program} candidateRank={filters.candidateRank} />)}</tbody></table></div>
        ) : <ul className="yks-program-grid">{visible.map((program) => <ProgramCard key={program.programCode} program={program} candidateRank={filters.candidateRank} preferred={store.preferences.includes(program.programCode)} favourite={store.favourites.includes(program.programCode)} preferenceFull={store.preferences.length >= MAX_PREFERENCES} onTogglePreference={store.togglePreference} onToggleFavourite={store.toggleFavourite} onOpen={store.openDetail} />)}</ul>}
      </section>
    </div>
  );
}

function ProgramRow({ program, candidateRank }: { program: MedicineProgram; candidateRank: number }) {
  const store = useYksStore(); const advantage = candidateAdvantage(program, candidateRank); const preferred = store.preferences.includes(program.programCode);
  return <tr><td><button className="yks-link-button" type="button" onClick={() => store.openDetail(program)}><strong>{program.universityName}</strong><small>{program.programCode} · {program.program}</small></button></td><td>{program.city ?? 'Veri yok'}<small>{UNIVERSITY_TYPE_LABELS[program.universityType]} · {scholarshipLabel(program)}</small></td><td>{formatRank(program.closingRank2025)}</td><td className={advantage === null ? '' : advantage >= 0 ? 'is-positive' : 'is-negative'}>{formatAdvantage(advantage)}</td><td>{program.quotas.general ?? 'Veri yok'}</td><td><button type="button" className="yks-button" disabled={!preferred && store.preferences.length >= MAX_PREFERENCES} onClick={() => store.togglePreference(program.programCode)}>{preferred ? 'Çıkar' : 'Ekle'}</button></td></tr>;
}
