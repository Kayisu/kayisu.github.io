import { useState } from 'react';

import { BAND_LABELS, HISTORY_LABELS, programsByCode, scenarios } from '../../data/yks';
import { MAX_SHORTLIST_SIZE, useYksStore } from '../../store/yksStore';

export default function ScenarioView() {
  const [activeId, setActiveId] = useState(scenarios[0]?.id ?? '');
  const clearShortlist = useYksStore((state) => state.clearShortlist);
  const toggleShortlist = useYksStore((state) => state.toggleShortlist);

  const scenario = scenarios.find((item) => item.id === activeId) ?? scenarios[0];
  if (!scenario) return null;

  /** Replaces the working list with this scenario's 24 codes, in its order. */
  const applyScenario = () => {
    clearShortlist();
    for (const entry of scenario.entries.slice(0, MAX_SHORTLIST_SIZE)) {
      toggleShortlist(entry.code);
    }
  };

  return (
    <div>
      <div className="yks-chips" role="group" aria-label="Senaryo seçimi">
        {scenarios.map((item) => (
          <button
            key={item.id}
            type="button"
            className="yks-chip"
            aria-pressed={item.id === scenario.id}
            onClick={() => setActiveId(item.id)}
          >
            {item.title.split('—')[0]?.trim()}
          </button>
        ))}
      </div>

      <div className="yks-section">
        <h2>{scenario.title}</h2>
        {scenario.intro && <p className="yks-lede">{scenario.intro}</p>}
        <dl className="yks-note-list yks-scenario-notes">
          <div><dt>İstek / erişim bölümü</dt><dd>{scenario.reachSummary}</dd></div>
          <div><dt>Gerçekçi çekirdek</dt><dd>{scenario.coreSummary}</dd></div>
          <div><dt>Yedek bölümü</dt><dd>{scenario.safetySummary}</dd></div>
          <div><dt>Finansal varsayım</dt><dd>{scenario.financialAssumptions}</dd></div>
          <div><dt>24 dışında bırakılanlar</dt><dd>{scenario.omissions}</dd></div>
        </dl>
        <div className="yks-filter-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="yks-button yks-button--primary" onClick={applyScenario}>
            Bu sıralamayı listeme aktar
          </button>
          <span className="yks-result-count">
            Mevcut listenizin yerine geçer ({scenario.entries.length} tercih).
          </span>
        </div>
      </div>

      <ol className="yks-list" style={{ marginTop: '1.25rem' }}>
        {scenario.entries.map((entry) => {
          const program = programsByCode.get(entry.code);
          return (
            <li key={entry.code} className="yks-card">
              <div className="yks-card-head">
                <div>
                  <h3 className="yks-card-title">
                    <span className="yks-position">{entry.position}</span>{' '}
                    {program?.university ?? entry.heading}
                  </h3>
                  <p className="yks-card-sub">
                    {program ? program.programName : entry.heading} • Kod {entry.code}
                  </p>
                </div>
              </div>

              {entry.data && <p className="yks-card-sub">{entry.data}</p>}
              {(program?.placementAssessment.reason ?? entry.reasoning) && (
                <p className="yks-detail-section" style={{ margin: 0 }}>
                  {program?.placementAssessment.reason ?? entry.reasoning}
                </p>
              )}

              <dl className="yks-facts">
                {entry.probability && (
                  <div>
                    <dt>Şans değerlendirmesi</dt>
                    <dd>{program ? BAND_LABELS[program.band] : entry.probability}</dd>
                  </div>
                )}
                {program && (
                  <div>
                    <dt>Geçmiş eşleşmesi</dt>
                    <dd>{HISTORY_LABELS[program.history.status]}</dd>
                  </div>
                )}
                {entry.cost && (
                  <div>
                    <dt>Ücret</dt>
                    <dd>{entry.cost}</dd>
                  </div>
                )}
                {entry.firstYearListCost && (
                  <div>
                    <dt>İlk yıl liste ödemesi</dt>
                    <dd>{entry.firstYearListCost}</dd>
                  </div>
                )}
                {entry.conditionalCost && (
                  <div>
                    <dt>Tercih koşulu sağlanırsa</dt>
                    <dd>{entry.conditionalCost}</dd>
                  </div>
                )}
              </dl>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
