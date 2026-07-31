export type UniversityType = 'public' | 'foundation' | 'trnc';
export type ProgramLanguage = 'Turkish' | 'English';
export type Scholarship = 'none' | 'full' | 'discount' | 'paid';
export type HistoryStatus = 'closing-rank' | 'new' | 'unfilled';

export interface ConditionDetail {
  code: number;
  text: string | null;
  pdfPage: number | null;
}

export interface MedicineProgram {
  programCode: string;
  universityName: string;
  universityType: UniversityType;
  city: string | null;
  faculty: string;
  program: string;
  language: ProgramLanguage;
  scholarship: Scholarship;
  scholarshipRate: number | null;
  durationYears: number;
  scoreType: string;
  quotas: {
    general: number | null;
    valedictorian: number | null;
    meb: number | null;
    martyrVeteran: number | null;
    women34: number | null;
  };
  specialConditions: number[];
  closingRank2025: number | null;
  minimumScore2025: number | null;
  historyStatus: HistoryStatus;
  accreditation: string | null;
  facultyStaff: {
    professor: number | null;
    associateProfessor: number | null;
    doctorFacultyMember: number | null;
    instructor: number | null;
  };
  tus: { tt1: number | null; tt2: number | null; ktp: number | null };
  annualTuition: number | null;
  source: string;
  sourceRow: number;
  sourcePage: number | null;
  warnings: string[];
}

export interface ExcludedProgram {
  programCode: string;
  universityName: string;
  faculty: string;
  program: string;
  reasonCode: 'kktc-citizen-only' | 'military-ministry-intake';
  reason: string;
  xlsRow: number;
  pdfPage: number | null;
}
