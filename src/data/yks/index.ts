import conditionsJson from './conditions-2026.json';
import excludedJson from './excluded-2026.json';
import manifestJson from './manifest-2026.json';
import programsJson from './medicine-programs-2026.json';
import validationJson from './validation-2026.json';

import type { ExcludedProgram, MedicineProgram } from './types';

export type * from './types';

export const programs = programsJson as MedicineProgram[];
export const conditionsByCode = conditionsJson as Record<string, import('./types').ConditionDetail>;
export const excluded = excludedJson as ExcludedProgram[];
export const manifest = manifestJson;
export const validation = validationJson;
export const programsByCode = new Map(programs.map((program) => [program.programCode, program]));

export const UNIVERSITY_TYPE_LABELS = {
  public: 'Devlet',
  foundation: 'Vakıf',
  trnc: 'KKTC',
} as const;

export const LANGUAGE_LABELS = { Turkish: 'Türkçe', English: 'İngilizce' } as const;

export function scholarshipLabel(program: MedicineProgram): string {
  if (program.scholarship === 'full') return 'Burslu';
  if (program.scholarship === 'discount') return `%${program.scholarshipRate} indirimli`;
  if (program.scholarship === 'paid') return 'Ücretli';
  return 'Burs/ücret etiketi yok';
}

export function candidateAdvantage(program: MedicineProgram, candidateRank: number): number | null {
  return program.closingRank2025 === null ? null : program.closingRank2025 - candidateRank;
}

export function validateYksDataset(): void {
  const failures: string[] = [];
  if (!validation.valid) failures.push('generated validation report is not valid');
  if (programs.length !== 225) failures.push(`expected 225 programs, found ${programs.length}`);
  if (new Set(programs.map((program) => program.programCode)).size !== programs.length) failures.push('duplicate program code');
  if (programs.some((program) => program.durationYears !== 6 || program.scoreType !== 'SAY')) failures.push('non-Medicine shape');
  if (programs.some((program) => program.program.includes('KKTC Uyruklu'))) failures.push('restricted nationality row included');
  if (programs.some((program) => /MİLLİ SAVUNMA|İÇİŞLERİ BAKANLIĞI ADINA/.test(program.universityName))) failures.push('military row included');
  if (programs.some((program) => program.historyStatus !== 'closing-rank' && program.closingRank2025 !== null)) failures.push('missing rank converted to zero/value');
  if (failures.length) throw new Error(`YKS dataset validation failed: ${failures.join('; ')}`);
}
