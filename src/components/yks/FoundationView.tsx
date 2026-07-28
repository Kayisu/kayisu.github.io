import { useMemo, useState } from 'react';

import { foundations, programsByCode, sourcesById } from '../../data/yks';
import { compareTurkish, matchesQuery } from './lib/turkish';
import { formatMoney } from './lib/format';

export default function FoundationView() {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const sorted = [...foundations].sort((a, b) => compareTurkish(a.university, b.university));
    if (!query.trim()) return sorted;
    return sorted.filter((item) => matchesQuery(`${item.university} ${item.city ?? ''}`, query));
  }, [query]);

  return (
    <div>
      <div className="yks-filters">
        <label className="yks-field">
          <span>Vakıf üniversitesi ara</span>
          <input
            className="yks-input"
            type="search"
            value={query}
            placeholder="örn. Başkent, Koç, İzmir"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p className="yks-card-sub">
          Burs ve indirim koşulları üniversitelerin kendi yayımladığı belgelerden derlendi.
          Kesin oran her zaman kod bazlı yazılı teklifle doğrulanmalıdır.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="yks-empty">Bu aramayla eşleşen vakıf üniversitesi yok.</p>
      ) : (
        <ul className="yks-list">
          {visible.map((foundation) => {
            const cheapest = foundation.codes
              .map((code) => programsByCode.get(code))
              .filter((program) => program?.estimatedPayment != null)
              .sort((a, b) => (a!.estimatedPayment! - b!.estimatedPayment!))[0];
            const source = foundation.codes
              .flatMap((code) => programsByCode.get(code)?.tuition.sourceIds ?? [])
              .map((id) => sourcesById.get(id))
              .find((item) => item?.sourceType === 'university' || item?.id.startsWith('V'));
            const benefit = foundation.extraBenefits.toLocaleLowerCase('tr-TR');

            return (
              <li key={foundation.university} className="yks-card">
                <div className="yks-card-head">
                  <div>
                    <h3 className="yks-card-title">{foundation.university}</h3>
                    <p className="yks-card-sub">
                      {foundation.city ? `${foundation.city} • ` : ''}
                      {foundation.codes.length} program
                    </p>
                  </div>
                  <div className="yks-badges">
                    {foundation.staffCount !== null && (
                      <span className="yks-badge">{foundation.staffCount} öğretim üyesi</span>
                    )}
                  </div>
                </div>

                <dl className="yks-facts">
                  <div>
                    <dt>2026 liste ücreti</dt>
                    <dd>{foundation.listTuition2026 ?? 'belirtilmemiş'}</dd>
                  </div>
                  <div>
                    <dt>En düşük yıllık ödeme</dt>
                    <dd>{cheapest ? formatMoney(cheapest.estimatedPayment) : 'belirtilmemiş'}</dd>
                  </div>
                </dl>

                <div className="yks-detail-section">
                  <h3>İlk tercih / giriş indirimi</h3>
                  <p>{foundation.preferenceDiscount}</p>
                </div>
                <div className="yks-detail-section">
                  <h3>YKS giriş desteği ve okul içi başarı</h3>
                  <p>{foundation.academicScholarship}</p>
                </div>
                <div className="yks-detail-section">
                  <h3>Hastane ve klinik ağ</h3>
                  <p>{foundation.staffSignal ?? 'Klinik eğitim yerleri bu araştırmada ayrı birincil kaynakla doğrulanmadı.'}</p>
                </div>
                <div className="yks-detail-section">
                  <h3>Barınma, yemek ve aylık destek</h3>
                  <p>{['yurt', 'yemek', 'aylık'].some((key) => benefit.includes(key)) ? foundation.extraBenefits : 'Medicine koduna özgü doğrulanmış garanti bulunamadı.'}</p>
                </div>
                <div className="yks-detail-section">
                  <h3>Değişim, araştırma ve ÇAP/yandal</h3>
                  <p>{['erasmus', 'araştır', 'çift', 'yandal'].some((key) => benefit.includes(key)) ? foundation.extraBenefits : 'Medicine için uygulanabilir program-kodu düzeyinde hak ayrıca doğrulanmadı.'}</p>
                </div>
                <div className="yks-detail-section">
                  <h3>Akreditasyon, kampüs ve ulaşım</h3>
                  <p>{foundation.accreditation} Klinik yıllardaki hastane/kampüs dağılımı ve ulaşım yükü kayıt öncesi doğrulanmalı.</p>
                </div>
                <div className="yks-detail-section">
                  <h3>Doğrulama durumu</h3>
                  <p>{foundation.verificationStatus}</p>
                  {source && (
                    <p><a href={source.url} target="_blank" rel="nofollow noopener noreferrer">Resmî/işaretli üniversite kaynağı [{source.id}]</a></p>
                  )}
                </div>
                {foundation.uncertainty && (
                  <div className="yks-detail-section">
                    <h3>Belirsizlik</h3>
                    <p>{foundation.uncertainty}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
