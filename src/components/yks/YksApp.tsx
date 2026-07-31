import { MAX_PREFERENCES, useYksStore } from '../../store/yksStore';
import CompareView from './CompareView';
import ProgramDetail from './ProgramDetail';
import ProgramExplorer from './ProgramExplorer';

export default function YksApp() {
  const store = useYksStore();
  return <>
    <nav className="yks-tabs" aria-label="Tercih sihirbazı bölümleri"><button type="button" aria-current={store.tab === 'explore' ? 'page' : undefined} onClick={() => store.setTab('explore')}>Programlar</button><button type="button" aria-current={store.tab === 'list' ? 'page' : undefined} onClick={() => store.setTab('list')}>Tercih listem ({store.preferences.length})</button></nav>
    {store.tab === 'explore' ? <ProgramExplorer /> : <CompareView />}
    <div className="yks-list-bar"><span><strong>{store.preferences.length}</strong> / {MAX_PREFERENCES} tercih</span><button type="button" className="yks-button yks-button--primary" onClick={() => store.setTab(store.tab === 'list' ? 'explore' : 'list')}>{store.tab === 'list' ? 'Programlara dön' : 'Listeyi aç'}</button></div>
    {store.detail && <ProgramDetail program={store.detail} candidateRank={store.filters.candidateRank} onClose={store.closeDetail} />}
  </>;
}
