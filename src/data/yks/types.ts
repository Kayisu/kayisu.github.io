/** Typed model for the independently audited 2026 YKS Medicine inventory. */

export type ProbabilityBand =
  | 'strong'
  | 'realistic'
  | 'borderline'
  | 'reach'
  | 'speculative';

export type HistoryStatus =
  | 'exact_code_match'
  | 'comparable_predecessor'
  | 'older_reopened_history'
  | 'analogous_program_only'
  | 'genuinely_new'
  | 'no_reliable_history';

export type Confidence = 'high' | 'medium' | 'low';
export type BandSource = 'official-lineage-audit' | 'derived';
export type ProgramType = 'state' | 'foundation' | 'kktc-intl';
export type ScholarshipTier = 'full' | 'half' | 'quarter' | 'paid' | null;
export type AmountStatus = 'known' | 'free_full_scholarship' | 'not_applicable' | 'not_published';

export interface HistoricalRow {
  year: number;
  code: string;
  programName: string;
  scholarshipType: ScholarshipTier;
  quota: number | null;
  placed: number | null;
  filled: boolean | null;
  filledStatus: 'filled' | 'unfilled' | 'unknown';
  closingRank: number | null;
  closingScore: number | null;
  sourceIds: string[];
}

export interface ProgramHistory {
  status: HistoryStatus;
  confidence: Confidence;
  exactCodeRows: HistoricalRow[];
  comparablePredecessor: HistoricalRow | null;
  olderRows: HistoricalRow[];
  transformationNote: string | null;
  explanation: string;
}

export interface ScenarioBand {
  label: string;
  reason: string;
}

export interface PlacementAssessment {
  candidateRank: number;
  band: ProbabilityBand;
  reason: string;
  optimistic: ScenarioBand;
  base: ScenarioBand;
  pessimistic: ScenarioBand;
}

export interface TuitionScenario {
  id: string;
  label: string;
  annualFee: number | null;
  status: string;
}

export interface PreferenceDiscount {
  rate: number | null;
  description: string;
}

export interface TuitionResearch {
  listedAnnualFee: number | null;
  currency: 'TRY' | null;
  vatIncluded: boolean | null;
  amountStatus: AmountStatus;
  placementDiscount: ScholarshipTier;
  baseAnnualPayable: number | null;
  preferenceDiscount: PreferenceDiscount;
  successDiscount: string;
  candidateAdmissionBenefitEligibility: string;
  combinedDiscount: string;
  effectiveScenarios: TuitionScenario[];
  cashPaymentDiscount: string;
  installmentOptions: string;
  continuationRules: string;
  recalculatedAnnually: boolean | null;
  preparationCoverage: string;
  sourceIds: string[];
}

export interface CurrentProgram {
  code: string;
  university: string;
  faculty: string;
  programName: string;
  language: 'tr' | 'en';
  scholarshipType: ScholarshipTier;
  quota: number;
  specialConditions: number[];
}

export interface Program {
  code: string;
  programName: string;
  university: string;
  city: string | null;
  type: ProgramType;
  language: 'tr' | 'en';
  scholarship: ScholarshipTier;
  closingRank2025: number | null;
  quota2026: number;
  rankDistance: number | null;
  band: ProbabilityBand;
  bandSource: BandSource;
  riskLabel: string;
  estimatedPayment: number | null;
  conditionalPreferenceCost: number | null;
  groupTuitionText: string | null;
  accreditation: string;
  staffSignal: string | null;
  staffCount: number | null;
  groupLabel: string | null;
  groupGap: number | null;
  groupGapDirection: 'ahead' | 'behind' | null;
  specialNote: string | null;
  uncertainty: string | null;
  operationalRisk: string | null;
  currentProgram: CurrentProgram;
  history: ProgramHistory;
  placementAssessment: PlacementAssessment;
  tuition: TuitionResearch;
  evidenceIds: string[];
}

export interface Foundation {
  university: string;
  city: string | null;
  listTuition2026: string | null;
  preferenceDiscount: string;
  academicScholarship: string;
  extraBenefits: string;
  verificationStatus: string;
  accreditation: string;
  staffSignal: string | null;
  staffCount: number | null;
  uncertainty: string | null;
  codes: string[];
}

export interface ScenarioEntry {
  position: number;
  code: string;
  heading: string;
  data: string | null;
  reasoning: string | null;
  probability: string | null;
  cost: string | null;
  firstYearListCost: string | null;
  conditionalCost: string | null;
}

export interface Scenario {
  id: string;
  title: string;
  intro: string | null;
  reachSummary?: string;
  coreSummary?: string;
  safetySummary?: string;
  financialAssumptions?: string;
  omissions?: string;
  entries: ScenarioEntry[];
}

export interface Source {
  id: string;
  label: string;
  url: string;
  verified: boolean;
  sourceTitle?: string;
  sourceDate?: string;
  sourceType?: 'official-guide' | 'official-results' | 'yok-atlas' | 'university' | 'secondary';
  verificationStatus?: 'verified' | 'partial' | 'unverified';
  note?: string;
}

export interface CurrentMigrationAuditRow {
  currentCode: string;
  historyStatus: HistoryStatus;
  predecessorCode: string | null;
  confidence: Confidence;
  sourceIds: string[];
}

export interface MigrationAudit {
  generatedAt: string;
  currentAudit: CurrentMigrationAuditRow[];
  historicalCategoryMigrations: unknown[];
}

export interface ExcludedProgram {
  code: string;
  reason: string;
}

export interface LabelledNote {
  label: string;
  detail: string;
}

export interface Guidance {
  swapPool: LabelledNote[];
  internationalOptions: LabelledNote[];
  probabilityLabels: LabelledNote[];
  rankHistory: LabelledNote[];
  nearBand: LabelledNote[];
  conditionalCosts: LabelledNote[];
  finalChecks: { order: number; text: string }[];
}

export interface ReportMeta {
  candidateRank: number;
  reportDate: string;
  guideVersion: string;
  preferencePeriod: string;
  counts: {
    programs: number;
    state: number;
    foundation: number;
    international: number;
    stateGroups: number;
    foundationGroups: number;
    internationalGroups: number;
    sources: number;
    unverifiedSources: number;
    excluded: number;
    eligibilityOmissions: number;
    scenarioEntries: number[];
    bands: Record<ProbabilityBand, number>;
    history: Record<HistoryStatus, number>;
    currentCodeMigrations: number;
    historicalCategoryMigrations: number;
  };
  officialGuideRows: {
    medicine: number;
    eligible: number;
    military: number;
    nationalityRestricted: number;
  };
}
