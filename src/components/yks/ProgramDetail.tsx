import { useEffect, useMemo, useRef } from 'react';

import {
  BAND_LABELS,
  HISTORY_LABELS,
  SCHOLARSHIP_LABELS,
  TYPE_LABELS,
  foundationsByUniversity,
  sourcesById,
  type Foundation,
  type HistoricalRow,
  type Program,
} from '../../data/yks';
import { formatMoney, formatNumber, formatRank } from './lib/format';

interface Props {
  program: Program;
  onClose: () => void;
}

const tierLabel = (tier: HistoricalRow['scholarshipType']) =>
  tier ? SCHOLARSHIP_LABELS[tier] : 'Devlet/genel kontenjan';

const amountStatusLabel = {
  known: 'Yayımlanmış tutar',
  free_full_scholarship: 'Tam burs — 0 TL öğrenim ücreti',
  not_applicable: 'Uygulanmaz',
  not_published: 'Tutar yayımlanmadı',
};

function benefitByKeyword(foundation: Foundation, keywords: string[], fallback: string): string {
  const text = foundation.extraBenefits;
  return keywords.some((keyword) => text.toLocaleLowerCase('tr-TR').includes(keyword))
    ? text
    : fallback;
}

export default function ProgramDetail({ program, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const foundation = foundationsByUniversity.get(program.university);
  const predecessor = program.history.comparablePredecessor;

  const historicalRows = useMemo(() => {
    const rows = [
      ...program.history.exactCodeRows,
      ...(predecessor ? [predecessor] : []),
      ...program.history.olderRows,
    ];
    return rows.filter(
      (row, index) => rows.findIndex((other) => other.year === row.year && other.code === row.code) === index,
    );
  }, [predecessor, program.history.exactCodeRows, program.history.olderRows]);

  const evidence = program.evidenceIds
    .map((id) => sourcesById.get(id))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="yks-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="yks-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="yks-detail-title"
        aria-describedby="yks-detail-summary"
      >
        <button
          ref={closeRef}
          type="button"
          className="yks-detail-close"
          aria-label="Program ayrıntılarını kapat"
          onClick={onClose}
        >
          ×
        </button>

        <h2 id="yks-detail-title">{program.university}</h2>
        <p id="yks-detail-summary" className="yks-card-sub">
          {program.city ? `${program.city} • ` : ''}
          {program.currentProgram.faculty} • {program.programName} • Kod {program.code}
        </p>

        <div className="yks-badges yks-detail-badges">
          <span className={`yks-badge yks-badge--${program.band}`}>
            Şans: {BAND_LABELS[program.band]}
          </span>
          <span className="yks-badge">{TYPE_LABELS[program.type]}</span>
          {program.scholarship && (
            <span className="yks-badge">{SCHOLARSHIP_LABELS[program.scholarship]}</span>
          )}
          <span className="yks-badge">{program.language === 'en' ? 'İngilizce' : 'Türkçe'}</span>
          <span className="yks-badge">Güven: {program.history.confidence}</span>
        </div>

        <section className="yks-detail-section">
          <h3>Program soy ağacı</h3>
          <p><strong>{HISTORY_LABELS[program.history.status]}.</strong> {program.history.explanation}</p>
          {program.history.transformationNote && (
            <p className="yks-lineage-callout">
              {program.history.transformationNote}
              {predecessor && (
                <>
                  {' '}2026 kodunun 2025’te aynı kodla kapanışı olmayabilir; karşılaştırılan
                  {' '}{predecessor.year} programı {predecessor.quota ?? '—'} kontenjanlı
                  {' '}{tierLabel(predecessor.scholarshipType).toLocaleLowerCase('tr-TR')} havuzdur ve
                  {' '}{predecessor.closingRank !== null
                    ? `${formatRank(predecessor.closingRank)} sıralamasında kapanmıştır.`
                    : `${predecessor.placed ?? '—'}/${predecessor.quota ?? '—'} yerleşenle dolmamıştır; resmî tam-dolu kapanış sırası yoktur.`}
                </>
              )}
            </p>
          )}

          {historicalRows.length > 0 && (
            <div className="yks-table-scroll">
              <table className="yks-table yks-history-table">
                <caption>Exact-code and selected comparable-program history</caption>
                <thead>
                  <tr>
                    <th>Yıl</th><th>Kod / tür</th><th>Kontenjan</th><th>Doluluk</th><th>Kapanış</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalRows.map((row) => (
                    <tr key={`${row.year}-${row.code}`}>
                      <td data-label="Yıl">{row.year}</td>
                      <td data-label="Kod / tür">{row.code}<br /><span className="yks-card-sub">{tierLabel(row.scholarshipType)}</span></td>
                      <td data-label="Kontenjan">{row.quota ?? '—'}</td>
                      <td data-label="Doluluk">{row.filledStatus === 'unfilled' ? `${row.placed ?? '—'}/${row.quota ?? '—'} — dolmadı` : row.filledStatus === 'filled' ? `${row.placed ?? row.quota ?? '—'}/${row.quota ?? '—'} — doldu` : 'Bilinmiyor'}</td>
                      <td data-label="Kapanış">{formatRank(row.closingRank)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="yks-detail-section">
          <h3>26.000 için yerleşme değerlendirmesi</h3>
          <p><strong>{BAND_LABELS[program.band]}:</strong> {program.placementAssessment.reason}</p>
          <div className="yks-scenario-grid">
            <div><h4>İyimser</h4><p>{program.placementAssessment.optimistic.reason}</p></div>
            <div><h4>Temel</h4><p>{program.placementAssessment.base.reason}</p></div>
            <div><h4>Kötümser</h4><p>{program.placementAssessment.pessimistic.reason}</p></div>
          </div>
        </section>

        <dl className="yks-facts">
          <div><dt>2026 kontenjanı</dt><dd>{formatNumber(program.quota2026)}</dd></div>
          <div><dt>Karşılaştırılan kapanış</dt><dd>{formatRank(program.closingRank2025)}</dd></div>
          <div><dt>Yıllık temel ödeme</dt><dd>{formatMoney(program.tuition.baseAnnualPayable)}</dd></div>
          <div><dt>Tutar durumu</dt><dd>{amountStatusLabel[program.tuition.amountStatus]}</dd></div>
        </dl>

        {program.type === 'foundation' && (
          <section className="yks-detail-section">
            <h3>2026–2027 ücret ve indirim araştırması</h3>
            <dl className="yks-note-list">
              <div><dt>Resmî liste ücreti</dt><dd>{formatMoney(program.tuition.listedAnnualFee)}; KDV {program.tuition.vatIncluded === true ? 'dâhil' : program.tuition.vatIncluded === false ? 'hariç' : 'ayrıca doğrulanmadı'}.</dd></div>
              <div><dt>ÖSYM kategorisi</dt><dd>{program.tuition.placementDiscount ? SCHOLARSHIP_LABELS[program.tuition.placementDiscount] : 'Program ücreti uygulanmaz'}</dd></div>
              <div><dt>Tercih indirimi</dt><dd>{program.tuition.preferenceDiscount.description}{program.tuition.preferenceDiscount.rate !== null ? ` (hesaplanan oran: %${Math.round(program.tuition.preferenceDiscount.rate * 100)})` : ''}</dd></div>
              <div><dt>YKS başarı desteği</dt><dd>{program.tuition.successDiscount}</dd></div>
              <div><dt>26.000 uygunluğu</dt><dd>{program.tuition.candidateAdmissionBenefitEligibility}</dd></div>
              <div><dt>Birleşme kuralı</dt><dd>{program.tuition.combinedDiscount}</dd></div>
              <div><dt>Peşin / taksit</dt><dd>{program.tuition.cashPaymentDiscount} {program.tuition.installmentOptions}</dd></div>
              <div><dt>Devam ve yıllık artış</dt><dd>{program.tuition.continuationRules} {program.tuition.recalculatedAnnually === true ? 'Ücret her akademik yıl yeniden belirlenir; altı yıllık sabit toplam değildir.' : ''}</dd></div>
              <div><dt>Hazırlık</dt><dd>{program.tuition.preparationCoverage}</dd></div>
            </dl>
            {program.tuition.effectiveScenarios.length > 0 && (
              <ul className="yks-fee-scenarios">
                {program.tuition.effectiveScenarios.map((scenario) => (
                  <li key={`${scenario.label}-${scenario.annualFee}`}>
                    <strong>{scenario.label}:</strong> {formatMoney(scenario.annualFee)}
                    {scenario.status === 'conditional' && ' — koşullu; ayrıca yazılı doğrulama gerekli'}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="yks-detail-section">
          <h3>Karar için üniversite/fakülte notları</h3>
          <dl className="yks-note-list">
            <div><dt>Hastane ve klinik ağ</dt><dd>{program.staffSignal ?? 'Klinik eğitim ağı bu araştırmada ayrı birincil kaynakla doğrulanmadı.'}</dd></div>
            <div><dt>Akreditasyon</dt><dd>{program.accreditation}</dd></div>
            <div><dt>Dil ve hazırlık</dt><dd>{program.language === 'en' ? 'Eğitim dili İngilizce; hazırlık/muafiyet koşulu kod bazında kontrol edilmeli.' : 'Eğitim dili Türkçe.'} {program.tuition.preparationCoverage}</dd></div>
            <div><dt>Barınma, yemek, aylık destek</dt><dd>{foundation ? benefitByKeyword(foundation, ['yurt', 'yemek', 'aylık'], 'Bu başlıklarda Medicine koduna özgü doğrulanmış garanti bulunamadı.') : 'Şehir ve kurum bazında ayrıca araştırılmalı.'}</dd></div>
            <div><dt>Değişim, araştırma, ÇAP/yandal</dt><dd>{foundation ? benefitByKeyword(foundation, ['erasmus', 'araştır', 'çift', 'yandal'], 'Medicine için uygulanabilir, program-koduna özgü bir hak ayrıca doğrulanmadı.') : 'Program/fakülte kaynağında ayrıca doğrulanmalı.'}</dd></div>
            <div><dt>Ulaşım ve kampüs dağılımı</dt><dd>Klinik yıllardaki hastane ve kampüsler arasında ulaşım yükü kayıt öncesi üniversiteden doğrulanmalı.</dd></div>
            <div><dt>Belirsizlik / dezavantaj</dt><dd>{program.uncertainty ?? program.operationalRisk ?? foundation?.uncertainty ?? 'Araştırma paketinde ayrıca doğrulanmış maddi dezavantaj kaydı yok.'}</dd></div>
          </dl>
        </section>

        <section className="yks-detail-section" aria-labelledby="yks-evidence-title">
          <h3 id="yks-evidence-title">Bu program için kanıtlar</h3>
          <ul className="yks-source-list">
            {evidence.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="nofollow noopener noreferrer">
                  [{source.id}] {source.sourceTitle ?? source.label}
                </a>
                {source.sourceDate && ` — ${source.sourceDate}`}
                {source.note && <span className="yks-source-note"> {source.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
