import { useEffect, useRef } from 'react';

import {
  BAND_DESCRIPTIONS,
  BAND_LABELS,
  SCHOLARSHIP_LABELS,
  TYPE_LABELS,
  foundationsByUniversity,
  type Program,
} from '../../data/yks';
import { formatMoney, formatNumber, formatRank, formatRankDistance } from './lib/format';

interface Props {
  program: Program;
  onClose: () => void;
}

export default function ProgramDetail({ program, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const foundation = foundationsByUniversity.get(program.university);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="yks-detail-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="yks-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="yks-detail-title"
        style={{ position: 'relative' }}
      >
        <button
          ref={closeRef}
          type="button"
          className="yks-detail-close"
          aria-label="Ayrıntıları kapat"
          onClick={onClose}
        >
          ×
        </button>

        <h2 id="yks-detail-title">{program.university}</h2>
        <p className="yks-card-sub">
          {program.city ? `${program.city} • ` : ''}
          {program.programName} • Kod {program.code}
        </p>

        <div className="yks-badges" style={{ marginTop: '0.75rem' }}>
          <span className={`yks-badge yks-badge--${program.band}`}>
            {BAND_LABELS[program.band]}
          </span>
          <span className="yks-badge">{TYPE_LABELS[program.type]}</span>
          {program.scholarship && (
            <span className="yks-badge">{SCHOLARSHIP_LABELS[program.scholarship]}</span>
          )}
          <span className="yks-badge">{program.language === 'en' ? 'İngilizce' : 'Türkçe'}</span>
        </div>

        <div className="yks-detail-section">
          <h3>Şans değerlendirmesi</h3>
          <p>
            {BAND_DESCRIPTIONS[program.band]} Rapordaki etiket: <strong>{program.riskLabel}</strong>.
            {program.bandSource === 'derived'
              ? ' Bu etiket, raporun yayımladığı eşiklerden hesaplandı.'
              : ' Bu etiket doğrudan raporun program havuzundan alındı.'}
          </p>
        </div>

        <dl className="yks-facts" style={{ marginTop: '1rem' }}>
          <div>
            <dt>2025 kapanış sırası</dt>
            <dd>{formatRank(program.closingRank2025)}</dd>
          </div>
          <div>
            <dt>26.000’e uzaklık</dt>
            <dd>{formatRankDistance(program.rankDistance)}</dd>
          </div>
          <div>
            <dt>2026 kontenjanı</dt>
            <dd>{formatNumber(program.quota2026)}</dd>
          </div>
          <div>
            <dt>Tahmini yıllık ödeme</dt>
            <dd>{formatMoney(program.estimatedPayment)}</dd>
          </div>
          {program.conditionalPreferenceCost !== null && (
            <div>
              <dt>Tercih koşulu sağlanırsa</dt>
              <dd>{formatMoney(program.conditionalPreferenceCost)}</dd>
            </div>
          )}
          {program.staffCount !== null && (
            <div>
              <dt>Öğretim üyesi</dt>
              <dd>{formatNumber(program.staffCount)}</dd>
            </div>
          )}
        </dl>

        <div className="yks-detail-section">
          <h3>Akreditasyon</h3>
          <p>{program.accreditation}</p>
        </div>

        {program.staffSignal && (
          <div className="yks-detail-section">
            <h3>İmkân sinyali</h3>
            <p>{program.staffSignal}</p>
          </div>
        )}

        {program.groupLabel && (
          <div className="yks-detail-section">
            <h3>Fakültenin geneli için rapor yorumu</h3>
            <p>
              {program.groupLabel}
              {program.groupGap !== null
                ? ` • ${formatNumber(program.groupGap)} sıra ${
                    program.groupGapDirection === 'ahead' ? 'önde' : 'geride'
                  }`
                : ''}
              . Bu yorum fakültenin en erişilebilir programı içindir; bu program farklı olabilir.
            </p>
          </div>
        )}

        {program.groupTuitionText && (
          <div className="yks-detail-section">
            <h3>Fakülte ücret notu</h3>
            <p>{program.groupTuitionText}</p>
          </div>
        )}

        {program.specialNote && (
          <div className="yks-detail-section">
            <h3>Özel not</h3>
            <p>{program.specialNote}</p>
          </div>
        )}

        {program.uncertainty && (
          <div className="yks-detail-section">
            <h3>Belirsizlik</h3>
            <p>{program.uncertainty}</p>
          </div>
        )}

        {program.operationalRisk && (
          <div className="yks-detail-section">
            <h3>Operasyonel risk</h3>
            <p>{program.operationalRisk}</p>
          </div>
        )}

        {foundation && (
          <>
            <div className="yks-detail-section">
              <h3>İlk tercih / giriş indirimi</h3>
              <p>{foundation.preferenceDiscount}</p>
            </div>
            <div className="yks-detail-section">
              <h3>Okul içi akademik başarı</h3>
              <p>{foundation.academicScholarship}</p>
            </div>
            <div className="yks-detail-section">
              <h3>Doğrulama durumu</h3>
              <p>{foundation.verificationStatus}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
