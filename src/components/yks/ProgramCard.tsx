import {
  BAND_LABELS,
  SCHOLARSHIP_LABELS,
  TYPE_LABELS,
  type Program,
} from '../../data/yks';
import { formatMoney, formatNumber, formatRank, formatRankDistance } from './lib/format';

interface Props {
  program: Program;
  shortlisted: boolean;
  shortlistFull: boolean;
  onToggleShortlist: (code: string) => void;
  onOpenDetail: (program: Program) => void;
}

export default function ProgramCard({
  program,
  shortlisted,
  shortlistFull,
  onToggleShortlist,
  onOpenDetail,
}: Props) {
  const disabled = !shortlisted && shortlistFull;
  const location = program.city ? `${program.city} • ` : '';

  return (
    <li className="yks-card">
      <div className="yks-card-head">
        <div>
          <h3 className="yks-card-title">{program.university}</h3>
          <p className="yks-card-sub">
            {location}
            {program.programName}
          </p>
        </div>
        <div className="yks-badges">
          <span className={`yks-badge yks-badge--${program.band}`}>
            {BAND_LABELS[program.band]}
          </span>
          <span className="yks-badge">{TYPE_LABELS[program.type]}</span>
          {program.scholarship && (
            <span className="yks-badge">{SCHOLARSHIP_LABELS[program.scholarship]}</span>
          )}
          {program.language === 'en' && <span className="yks-badge">İngilizce</span>}
        </div>
      </div>

      <dl className="yks-facts">
        <div>
          <dt>2025 kapanış</dt>
          <dd>{formatRank(program.closingRank2025)}</dd>
        </div>
        <div>
          <dt>26.000’e uzaklık</dt>
          <dd>{formatRankDistance(program.rankDistance)}</dd>
        </div>
        <div>
          <dt>2026 kontenjan</dt>
          <dd>{formatNumber(program.quota2026)}</dd>
        </div>
        <div>
          <dt>Yıllık ödeme</dt>
          <dd>{formatMoney(program.estimatedPayment)}</dd>
        </div>
      </dl>

      <div className="yks-card-actions">
        <button
          type="button"
          className={shortlisted ? 'yks-button yks-button--primary' : 'yks-button'}
          aria-pressed={shortlisted}
          disabled={disabled}
          onClick={() => onToggleShortlist(program.code)}
        >
          {shortlisted ? 'Listemden çıkar' : 'Listeme ekle'}
        </button>
        <button type="button" className="yks-button" onClick={() => onOpenDetail(program)}>
          Ayrıntılar
        </button>
        <span className="yks-card-sub">Kod {program.code}</span>
      </div>
      {disabled && (
        <p className="yks-card-sub">Tercih listesi 24 programla dolu.</p>
      )}
    </li>
  );
}
