import { candidateAdvantage, LANGUAGE_LABELS, scholarshipLabel, UNIVERSITY_TYPE_LABELS, type MedicineProgram } from '../../data/yks';
import { formatAdvantage, formatNumber, formatRank } from './lib/format';

interface Props {
  program: MedicineProgram;
  candidateRank: number;
  preferred: boolean;
  favourite: boolean;
  preferenceFull: boolean;
  onTogglePreference: (code: string) => void;
  onToggleFavourite: (code: string) => void;
  onOpen: (program: MedicineProgram) => void;
}

export default function ProgramCard(props: Props) {
  const { program } = props;
  const advantage = candidateAdvantage(program, props.candidateRank);
  return (
    <li className="yks-program-card">
      <div className="yks-card-head">
        <div>
          <p className="yks-code">{program.programCode} · {program.city ?? 'Şehir verisi yok'}</p>
          <h3>{program.universityName}</h3>
          <p>{program.faculty} · {program.program}</p>
        </div>
        <button className="yks-icon-button" type="button" aria-label={props.favourite ? 'Favorilerden çıkar' : 'Favorilere ekle'} aria-pressed={props.favourite} onClick={() => props.onToggleFavourite(program.programCode)}>
          {props.favourite ? '★' : '☆'}
        </button>
      </div>
      <div className="yks-tags">
        <span>{UNIVERSITY_TYPE_LABELS[program.universityType]}</span><span>{LANGUAGE_LABELS[program.language]}</span><span>{scholarshipLabel(program)}</span>
        {program.accreditation && <span>{program.accreditation}</span>}
      </div>
      <dl className="yks-metrics">
        <div><dt>2025 kapanış</dt><dd>{formatRank(program.closingRank2025)}</dd></div>
        <div><dt>Aday farkı</dt><dd className={advantage === null ? '' : advantage >= 0 ? 'is-positive' : 'is-negative'}>{formatAdvantage(advantage)}</dd></div>
        <div><dt>Genel kont.</dt><dd>{program.quotas.general === null ? 'Veri yok' : formatNumber(program.quotas.general)}</dd></div>
      </dl>
      <div className="yks-card-actions">
        <button type="button" className="yks-button" onClick={() => props.onOpen(program)}>Ayrıntı</button>
        <button type="button" className="yks-button yks-button--primary" disabled={!props.preferred && props.preferenceFull} onClick={() => props.onTogglePreference(program.programCode)}>
          {props.preferred ? 'Listeden çıkar' : 'Tercihe ekle'}
        </button>
      </div>
    </li>
  );
}
