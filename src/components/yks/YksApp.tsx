import { MAX_SHORTLIST_SIZE, useYksStore, type YksTab } from '../../store/yksStore';
import CompareView from './CompareView';
import FoundationView from './FoundationView';
import ProgramDetail from './ProgramDetail';
import ProgramExplorer from './ProgramExplorer';
import ScenarioView from './ScenarioView';

const TABS: { id: YksTab; label: string }[] = [
  { id: 'explore', label: 'Programlar' },
  { id: 'scenarios', label: 'Senaryolar' },
  { id: 'foundations', label: 'Vakıf bursları' },
  { id: 'compare', label: 'Tercih listem' },
];

export default function YksApp() {
  const tab = useYksStore((state) => state.tab);
  const setTab = useYksStore((state) => state.setTab);
  const shortlist = useYksStore((state) => state.shortlist);
  const detail = useYksStore((state) => state.detail);
  const closeDetail = useYksStore((state) => state.closeDetail);

  return (
    <>
      <div className="yks-tabs" role="tablist" aria-label="Bölümler">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`yks-tab-${item.id}`}
            className="yks-tab"
            aria-selected={tab === item.id}
            aria-controls={`yks-panel-${item.id}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.id === 'compare' && shortlist.length > 0 ? ` (${shortlist.length})` : ''}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`yks-panel-${tab}`}
        aria-labelledby={`yks-tab-${tab}`}
        tabIndex={-1}
      >
        {tab === 'explore' && <ProgramExplorer />}
        {tab === 'scenarios' && <ScenarioView />}
        {tab === 'foundations' && <FoundationView />}
        {tab === 'compare' && <CompareView />}
      </div>

      {shortlist.length > 0 && tab !== 'compare' && (
        <div className="yks-shortlist-bar">
          <span className="yks-shortlist-count">
            Tercih listem: {shortlist.length} / {MAX_SHORTLIST_SIZE}
          </span>
          <button
            type="button"
            className="yks-button yks-button--primary"
            onClick={() => setTab('compare')}
          >
            Listeyi aç
          </button>
        </div>
      )}

      {detail && <ProgramDetail program={detail} onClose={closeDetail} />}
    </>
  );
}
