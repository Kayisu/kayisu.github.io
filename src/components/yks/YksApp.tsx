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
  const moveTabFocus = (currentIndex: number, key: string) => {
    let nextIndex = currentIndex;
    if (key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    else if (key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (key === 'Home') nextIndex = 0;
    else if (key === 'End') nextIndex = TABS.length - 1;
    else return;
    const next = TABS[nextIndex];
    setTab(next.id);
    requestAnimationFrame(() => document.getElementById(`yks-tab-${next.id}`)?.focus());
  };

  return (
    <>
      <div className="yks-tabs" role="tablist" aria-label="Bölümler">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`yks-tab-${item.id}`}
            className="yks-tab"
            aria-selected={tab === item.id}
            aria-controls={`yks-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                moveTabFocus(index, event.key);
              }
            }}
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
