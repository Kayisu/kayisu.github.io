import { useEffect } from 'react';

import { candidateAdvantage, conditionsByCode, LANGUAGE_LABELS, scholarshipLabel, UNIVERSITY_TYPE_LABELS, type MedicineProgram } from '../../data/yks';
import { formatAdvantage, formatDecimal, formatMoney, formatNumber, formatRank } from './lib/format';

const value = (item: number | string | null) => item === null ? 'Veri yok' : typeof item === 'number' ? formatNumber(item) : item;

export default function ProgramDetail({ program, candidateRank, onClose }: { program: MedicineProgram; candidateRank: number; onClose: () => void }) {
  useEffect(() => { const listener = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener); }, [onClose]);
  const advantage = candidateAdvantage(program, candidateRank);
  return <div className="yks-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="yks-modal" role="dialog" aria-modal="true" aria-labelledby="program-detail-title">
      <button className="yks-modal-close" type="button" aria-label="Kapat" onClick={onClose}>×</button>
      <p className="yks-code">{program.programCode} · PDF s. {program.sourcePage ?? 'Veri yok'} · XLS satır {program.sourceRow}</p>
      <h2 id="program-detail-title">{program.universityName}</h2><p>{program.faculty} · {program.program}</p>
      <div className="yks-tags"><span>{UNIVERSITY_TYPE_LABELS[program.universityType]}</span><span>{program.city ?? 'Şehir verisi yok'}</span><span>{LANGUAGE_LABELS[program.language]}</span><span>{scholarshipLabel(program)}</span></div>
      <h3>Yerleştirme ve kontenjan</h3>
      <dl className="yks-detail-grid">
        <div><dt>2025 kapanış sırası</dt><dd>{formatRank(program.closingRank2025)}</dd></div><div><dt>2025 en küçük puan</dt><dd>{program.minimumScore2025 ?? 'Veri yok'}</dd></div>
        <div><dt>Aday farkı</dt><dd>{formatAdvantage(advantage)}</dd></div><div><dt>Geçmiş durumu</dt><dd>{program.historyStatus === 'new' ? 'Yeni / kapanış geçmişi yok' : program.historyStatus === 'unfilled' ? '2025’te dolmadı' : 'Kapanış verisi var'}</dd></div>
        <div><dt>Genel kontenjan</dt><dd>{value(program.quotas.general)}</dd></div><div><dt>Okul birincisi</dt><dd>{value(program.quotas.valedictorian)}</dd></div>
        <div><dt>MEB</dt><dd>{value(program.quotas.meb)}</dd></div><div><dt>Şehit/gazi yakını</dt><dd>{value(program.quotas.martyrVeteran)}</dd></div><div><dt>34+ kadın</dt><dd>{value(program.quotas.women34)}</dd></div>
        <div><dt>Süre / puan türü</dt><dd>{program.durationYears} yıl · {program.scoreType}</dd></div><div><dt>Yıllık ücret</dt><dd>{formatMoney(program.annualTuition)}</dd></div>
      </dl>
      <h3>Akreditasyon, kadro ve TUS</h3>
      <dl className="yks-detail-grid"><div><dt>Akreditasyon</dt><dd>{program.accreditation ?? 'Veri yok'}</dd></div><div><dt>Profesör</dt><dd>{value(program.facultyStaff.professor)}</dd></div><div><dt>Doçent</dt><dd>{value(program.facultyStaff.associateProfessor)}</dd></div><div><dt>Dr. Öğr. Üyesi</dt><dd>{value(program.facultyStaff.doctorFacultyMember)}</dd></div><div><dt>TUS TT1</dt><dd>{formatDecimal(program.tus.tt1)}</dd></div><div><dt>TUS TT2</dt><dd>{formatDecimal(program.tus.tt2)}</dd></div><div><dt>TUS KTP</dt><dd>{formatDecimal(program.tus.ktp)}</dd></div></dl>
      <h3>Özel koşullar</h3>
      {program.specialConditions.length ? <ol className="yks-condition-list">{program.specialConditions.map((code) => conditionsByCode[String(code)] ?? { code, text: null, pdfPage: null }).map((condition) => <li key={condition.code}><strong>Koşul {condition.code}</strong> · PDF s. {condition.pdfPage ?? 'Veri yok'}<p>{condition.text ?? 'Veri yok'}</p></li>)}</ol> : <p>Özel koşul yok.</p>}
      {!!program.warnings.length && <div className="yks-warning"><strong>Veri uyarıları</strong><ul>{program.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      <p className="yks-source-note">Kaynak: {program.source}. Ücret, burs devamı ve kayıt koşullarını ÖSYM’nin tercih ekranı ile üniversiteden ayrıca doğrulayın.</p>
    </section>
  </div>;
}
