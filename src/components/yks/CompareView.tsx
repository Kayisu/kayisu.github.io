import { useState } from 'react';

import { candidateAdvantage, programsByCode, type MedicineProgram } from '../../data/yks';
import { MAX_PREFERENCES, useYksStore } from '../../store/yksStore';
import { formatAdvantage, formatRank } from './lib/format';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const download = (name: string, contents: string, type: string) => { const url = URL.createObjectURL(new Blob([contents], { type })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); };

export default function CompareView() {
  const store = useYksStore(); const [dragged, setDragged] = useState<string | null>(null);
  const selected = store.preferences.map((code) => programsByCode.get(code)).filter((program): program is MedicineProgram => Boolean(program));
  const copy = async () => navigator.clipboard.writeText(selected.map((program, index) => `${index + 1}. ${program.programCode} — ${program.universityName} — ${program.program}`).join('\n'));
  const exportJson = () => download('yks-2026-tip-tercih-listem.json', JSON.stringify({ candidateRank: store.filters.candidateRank, programs: selected }, null, 2), 'application/json');
  const exportCsv = () => download('yks-2026-tip-tercih-listem.csv', ['Sıra,Kod,Üniversite,Program,Şehir,2025 Kapanış,Aday Farkı', ...selected.map((program, index) => [index + 1, program.programCode, program.universityName, program.program, program.city, program.closingRank2025, candidateAdvantage(program, store.filters.candidateRank)].map(csvCell).join(','))].join('\n'), 'text/csv;charset=utf-8');

  if (!selected.length) return <section className="yks-empty"><h2>Tercih listeniz boş</h2><p>Programlar ekranından en fazla 24 program ekleyebilirsiniz.</p><button className="yks-button yks-button--primary" type="button" onClick={() => store.setTab('explore')}>Programlara dön</button></section>;
  const known = selected.filter((program) => program.closingRank2025 !== null);
  return <section className="yks-preferences">
    <div className="yks-section-head"><div><h2>Tercih listem</h2><p>{selected.length} / {MAX_PREFERENCES} program · {known.length} kapanış verili · {selected.length - known.length} geçmişsiz</p></div><div className="yks-export-actions"><button type="button" className="yks-button" onClick={copy}>Kopyala</button><button type="button" className="yks-button" onClick={() => print()}>Yazdır</button><button type="button" className="yks-button" onClick={exportJson}>JSON</button><button type="button" className="yks-button" onClick={exportCsv}>CSV</button><button type="button" className="yks-button yks-button--danger" onClick={() => confirm('Tercih listesinin tamamı silinsin mi?') && store.clearPreferences()}>Temizle</button></div></div>
    <p className="yks-warning"><strong>Önemli:</strong> Bu sıra bir yerleşme olasılığı önerisi değildir. Tercihleri yalnızca gerçek istek sıranıza göre düzenleyin.</p>
    <ol className="yks-preference-list">{selected.map((program, index) => {
      const advantage = candidateAdvantage(program, store.filters.candidateRank);
      return <li key={program.programCode} data-preference-code={program.programCode} draggable onDragStart={() => setDragged(program.programCode)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragged) store.reorderPreference(dragged, program.programCode); setDragged(null); }}>
        <span className="yks-drag" aria-label="Sürükleyerek taşı" role="button" tabIndex={0} onPointerDown={(event) => { if (event.pointerType !== 'mouse') { setDragged(program.programCode); event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerUp={(event) => { if (dragged) { const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-preference-code]')?.getAttribute('data-preference-code'); if (target) store.reorderPreference(dragged, target); } setDragged(null); }} onPointerCancel={() => setDragged(null)}>⠿</span><span className="yks-position">{index + 1}</span><div className="yks-preference-main"><strong>{program.universityName}</strong><span>{program.programCode} · {program.city ?? 'Şehir verisi yok'} · 2025: {formatRank(program.closingRank2025)} · {formatAdvantage(advantage)}</span></div>
        <div className="yks-order-actions"><button type="button" aria-label="Yukarı taşı" disabled={index === 0} onClick={() => store.movePreference(program.programCode, -1)}>↑</button><button type="button" aria-label="Aşağı taşı" disabled={index === selected.length - 1} onClick={() => store.movePreference(program.programCode, 1)}>↓</button><button type="button" aria-label="Listeden çıkar" onClick={() => store.togglePreference(program.programCode)}>×</button></div>
      </li>;
    })}</ol>
  </section>;
}
