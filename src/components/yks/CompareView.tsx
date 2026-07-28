import {
  BAND_LABELS,
  HISTORY_LABELS,
  SCHOLARSHIP_LABELS,
  TYPE_LABELS,
  programsByCode,
} from '../../data/yks';
import { useYksStore } from '../../store/yksStore';
import { formatMoney, formatNumber, formatRank } from './lib/format';

export default function CompareView() {
  const shortlist = useYksStore((state) => state.shortlist);
  const moveShortlist = useYksStore((state) => state.moveShortlist);
  const toggleShortlist = useYksStore((state) => state.toggleShortlist);
  const clearShortlist = useYksStore((state) => state.clearShortlist);
  const setTab = useYksStore((state) => state.setTab);

  const rows = shortlist
    .map((code) => programsByCode.get(code))
    .filter((program): program is NonNullable<typeof program> => program !== undefined);

  if (rows.length === 0) {
    return (
      <p className="yks-empty">
        Tercih listeniz boş. Programları keşfedip “Listeme ekle” ile buraya taşıyın,
        ya da bir senaryoyu olduğu gibi aktarın.
        <br />
        <button
          type="button"
          className="yks-button"
          style={{ marginTop: '1rem' }}
          onClick={() => setTab('explore')}
        >
          Programlara git
        </button>
      </p>
    );
  }

  const copyList = () => {
    const text = rows
      .map((program, index) => `${index + 1}. ${program.code} — ${program.university} — ${program.programName}`)
      .join('\n');
    void navigator.clipboard?.writeText(text);
  };

  return (
    <div>
      <div className="yks-filter-actions" style={{ marginBottom: '1rem' }}>
        <span className="yks-result-count" role="status">
          {formatNumber(rows.length)} tercih sıralandı (en fazla 24)
        </span>
        <button type="button" className="yks-button" onClick={copyList}>
          Listeyi kopyala
        </button>
        <button type="button" className="yks-button" onClick={clearShortlist}>
          Listeyi temizle
        </button>
      </div>

      <div className="yks-table-scroll">
        <table className="yks-table">
          <caption className="yks-visually-hidden">
            Seçtiğiniz programların tercih sırasına göre karşılaştırması
          </caption>
          <thead>
            <tr>
              <th scope="col">Sıra</th>
              <th scope="col">Program</th>
              <th scope="col">Şans</th>
              <th scope="col">Karşılaştırılan kapanış</th>
              <th scope="col">Geçmiş türü</th>
              <th scope="col">Kontenjan</th>
              <th scope="col">Yıllık ödeme</th>
              <th scope="col">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((program, index) => (
              <tr key={program.code}>
                <td data-label="Sıra">
                  <span className="yks-position">{index + 1}</span>
                </td>
                <td data-label="Program">
                  <strong>{program.university}</strong>
                  <br />
                  {program.programName}
                  <br />
                  <span className="yks-card-sub">
                    {TYPE_LABELS[program.type]}
                    {program.scholarship ? ` • ${SCHOLARSHIP_LABELS[program.scholarship]}` : ''}
                    {' • '}
                    Kod {program.code}
                  </span>
                </td>
                <td data-label="Şans">{BAND_LABELS[program.band]}</td>
                <td data-label="Karşılaştırılan kapanış">{formatRank(program.closingRank2025)}</td>
                <td data-label="Geçmiş türü">{HISTORY_LABELS[program.history.status]}</td>
                <td data-label="Kontenjan">{formatNumber(program.quota2026)}</td>
                <td data-label="Yıllık ödeme">{formatMoney(program.estimatedPayment)}</td>
                <td data-label="İşlem">
                  <div className="yks-order-controls">
                    <button
                      type="button"
                      className="yks-icon-button"
                      disabled={index === 0}
                      aria-label={`${program.university} programını yukarı taşı`}
                      onClick={() => moveShortlist(program.code, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="yks-icon-button"
                      disabled={index === rows.length - 1}
                      aria-label={`${program.university} programını aşağı taşı`}
                      onClick={() => moveShortlist(program.code, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="yks-icon-button"
                      aria-label={`${program.university} programını listeden çıkar`}
                      onClick={() => toggleShortlist(program.code)}
                    >
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
