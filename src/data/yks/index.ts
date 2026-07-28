/**
 * Typed, validated entry point for the 2026 YKS Medicine research.
 *
 * `validateYksDataset()` runs during `astro build`; material research defects
 * therefore fail the build instead of silently reaching the decision tool.
 */
import excludedJson from './excluded.json';
import foundationsJson from './foundations.json';
import guidanceJson from './guidance.json';
import lineageJson from './lineage.json';
import metaJson from './report-meta.json';
import migrationAuditJson from './migration-audit.json';
import programsJson from './programs.json';
import scenariosJson from './scenarios.json';
import sourcesJson from './sources.json';

import type {
  ExcludedProgram,
  Foundation,
  Guidance,
  HistoryStatus,
  MigrationAudit,
  ProbabilityBand,
  Program,
  ReportMeta,
  Scenario,
  Source,
} from './types';

export * from './types';

export const BAND_ORDER: ProbabilityBand[] = [
  'strong',
  'realistic',
  'borderline',
  'reach',
  'speculative',
];

export const BAND_LABELS: Record<ProbabilityBand, string> = {
  strong: 'Güçlü',
  realistic: 'Gerçekçi',
  borderline: 'Sınırda',
  reach: 'Zayıf / erişim',
  speculative: 'Çok spekülatif',
};

export const BAND_DESCRIPTIONS: Record<ProbabilityBand, string> = {
  strong: 'Karşılaştırılabilir geçmiş sonuç 26.000’in belirgin gerisinde veya havuz dolmamış.',
  realistic: 'Karşılaştırılabilir geçmiş sonuç aday sırasına yakın ve yapısal eşleşme güçlü.',
  borderline: 'Marj dar ya da 2026 değişikliği sonucu iki yöne de çevirebilir.',
  reach: 'Geçmiş kapanış 26.000’in önünde; ancak istek sırasına göre üstte yazılabilir.',
  speculative: 'Yeni/analog yapı veya zayıf karşılaştırılabilirlik nedeniyle tahmin gücü çok düşük.',
};

export const HISTORY_LABELS: Record<HistoryStatus, string> = {
  exact_code_match: 'Aynı kodla tarihsel sonuç',
  comparable_predecessor: 'Farklı kategoride karşılaştırılabilir önceki program',
  older_reopened_history: 'Daha eski geçmişi olan yeniden açılmış program',
  analogous_program_only: 'Yalnız benzer program geçmişi',
  genuinely_new: 'Gerçekten yeni program',
  no_reliable_history: 'Güvenilir geçmiş yok',
};

export const TYPE_LABELS: Record<Program['type'], string> = {
  state: 'Devlet',
  foundation: 'Vakıf',
  'kktc-intl': 'KKTC / yurt dışı',
};

export const SCHOLARSHIP_LABELS: Record<string, string> = {
  full: 'Burslu',
  half: '%50 indirimli',
  quarter: '%25 indirimli',
  paid: 'Ücretli',
};

const lineageByCode = new Map(
  (lineageJson as unknown as Pick<
    Program,
    'code' | 'currentProgram' | 'history' | 'placementAssessment' | 'tuition' | 'evidenceIds'
  >[]).map((entry) => [entry.code, entry]),
);

export const programs = (programsJson as Omit<Program, 'currentProgram' | 'history' | 'placementAssessment' | 'tuition' | 'evidenceIds'>[])
  .map((legacy) => {
    const audit = lineageByCode.get(legacy.code);
    if (!audit) throw new Error(`[yks dataset] programme ${legacy.code}: lineage missing`);
    const historicalRank = audit.history.comparablePredecessor?.closingRank
      ?? audit.history.exactCodeRows.find((row) => row.year === 2025)?.closingRank
      ?? null;
    return {
      ...legacy,
      ...audit,
      closingRank2025: historicalRank,
      rankDistance: historicalRank === null ? null : 26_000 - historicalRank,
      band: audit.placementAssessment.band,
      bandSource: 'official-lineage-audit',
      riskLabel: BAND_LABELS[audit.placementAssessment.band],
      estimatedPayment: audit.tuition.baseAnnualPayable,
    } satisfies Program;
  });

export const foundations = foundationsJson as Foundation[];
export const scenarios = scenariosJson as Scenario[];
export const sources = sourcesJson as Source[];
export const excluded = excludedJson as ExcludedProgram[];
export const guidance = guidanceJson as Guidance;
export const reportMeta = metaJson as ReportMeta;
export const migrationAudit = migrationAuditJson as MigrationAudit;

export const programsByCode = new Map(programs.map((program) => [program.code, program]));
export const foundationsByUniversity = new Map(
  foundations.map((foundation) => [foundation.university, foundation]),
);
export const sourcesById = new Map(sources.map((source) => [source.id, source]));

function fail(message: string): never {
  throw new Error(`[yks dataset] ${message}`);
}

function expect(actual: number, wanted: number, what: string): void {
  if (actual !== wanted) fail(`${what}: expected ${wanted}, got ${actual}`);
}

function assertMedipolRegression(): void {
  const cases = [
    ['203111166', '203110292', 170, 47_837],
    ['203101284', '203190974', 68, 49_259],
    ['203101291', '203110477', 7, 38],
    ['209210052', '209210054', 76, 33_458],
    ['209210049', '209210051', 76, null],
  ] as const;

  for (const [code, predecessorCode, quota, rank] of cases) {
    const program = programsByCode.get(code);
    if (!program) fail(`Medipol regression ${code}: current programme missing`);
    if (program.quota2026 !== quota) fail(`Medipol regression ${code}: quota changed`);
    if (program.history.status !== 'comparable_predecessor') {
      fail(`Medipol regression ${code}: must use a comparable predecessor`);
    }
    const predecessor = program.history.comparablePredecessor;
    if (predecessor?.code !== predecessorCode) {
      fail(`Medipol regression ${code}: expected predecessor ${predecessorCode}`);
    }
    if (predecessor.closingRank !== rank) {
      fail(`Medipol regression ${code}: predecessor rank/fill result changed`);
    }
    if (code === '209210049' && predecessor.placed !== 59) {
      fail('Medipol regression 209210049: 2025 English pool must show 59/76 placed');
    }
  }
}

/** Build-time research and integrity assertions. */
export function validateYksDataset(): void {
  const { counts, officialGuideRows } = reportMeta;
  expect(programs.length, 225, 'eligible programme count');
  expect(programsByCode.size, 225, 'unique eligible programme codes');
  expect(counts.programs, 225, 'meta programme count');
  expect(programs.filter((p) => p.type === 'state').length, 100, 'state programmes');
  expect(programs.filter((p) => p.type === 'foundation').length, 112, 'foundation programmes');
  expect(programs.filter((p) => p.type === 'kktc-intl').length, 13, 'KKTC/international programmes');
  expect(foundations.length, 33, 'foundation faculty groups');
  expect(lineageByCode.size, programs.length, 'lineage coverage');

  expect(
    officialGuideRows.eligible + officialGuideRows.military + officialGuideRows.nationalityRestricted,
    officialGuideRows.medicine,
    'official guide reconciliation',
  );
  expect(officialGuideRows.eligible, programs.length, 'official eligible guide rows');

  for (const program of programs) {
    const where = `programme ${program.code}`;
    if (!/^\d{9}$/.test(program.code)) fail(`${where}: malformed code`);
    if (!program.currentProgram.faculty) fail(`${where}: current faculty missing`);
    if (!program.history.explanation) fail(`${where}: lineage explanation missing`);
    if (!program.placementAssessment.reason) fail(`${where}: assessment reason missing`);
    if (!BAND_ORDER.includes(program.band)) fail(`${where}: invalid assessment band`);
    if (program.history.status === 'genuinely_new' && program.history.exactCodeRows.some((row) => row.year === 2025)) {
      fail(`${where}: blank current field was incorrectly treated as genuinely new`);
    }
    if (
      ['comparable_predecessor', 'analogous_program_only'].includes(program.history.status)
      && !program.history.comparablePredecessor
    ) {
      fail(`${where}: comparable predecessor is not recorded`);
    }
    const historyRows = [
      ...program.history.exactCodeRows,
      ...program.history.olderRows,
      ...(program.history.comparablePredecessor ? [program.history.comparablePredecessor] : []),
    ];
    for (const row of historyRows) {
      if (row.closingRank !== null && row.sourceIds.length === 0) {
        fail(`${where}: historical rank ${row.year}/${row.code} has no source`);
      }
    }
    if (!program.tuition.amountStatus) fail(`${where}: fee research status missing`);
    if (program.tuition.amountStatus === 'free_full_scholarship' && program.tuition.baseAnnualPayable !== 0) {
      fail(`${where}: full scholarship must be represented by monetary zero`);
    }
    if (program.tuition.amountStatus === 'not_published' && program.tuition.baseAnnualPayable === 0) {
      fail(`${where}: missing fee must not be conflated with zero`);
    }
    if (program.scholarship === 'paid' && program.tuition.baseAnnualPayable === 0) {
      fail(`${where}: paid programme cannot have zero tuition`);
    }
    for (const sourceId of program.evidenceIds) {
      if (!sourcesById.has(sourceId)) fail(`${where}: unknown evidence source ${sourceId}`);
    }
  }

  for (const [status, wanted] of Object.entries(counts.history)) {
    expect(
      programs.filter((program) => program.history.status === status as HistoryStatus).length,
      wanted,
      `history ${status}`,
    );
  }
  for (const band of BAND_ORDER) {
    expect(programs.filter((program) => program.band === band).length, counts.bands[band], `band ${band}`);
  }

  expect(migrationAudit.currentAudit.length, counts.currentCodeMigrations, 'current-code migrations');
  expect(
    migrationAudit.historicalCategoryMigrations.length,
    counts.historicalCategoryMigrations,
    'historical category migrations',
  );

  for (const entry of excluded) {
    if (programsByCode.has(entry.code)) fail(`excluded programme ${entry.code} appears in eligible pool`);
  }
  expect(excluded.length, counts.excluded, 'excluded programme records');

  expect(scenarios.length, 4, 'preference scenarios');
  scenarios.forEach((scenario, scenarioIndex) => {
    if (scenario.entries.length > 24 || scenario.entries.length < 1) {
      fail(`scenario ${scenario.id}: must contain 1–24 choices`);
    }
    expect(scenario.entries.length, counts.scenarioEntries[scenarioIndex], `scenario ${scenario.id} entries`);
    if (new Set(scenario.entries.map((entry) => entry.code)).size !== scenario.entries.length) {
      fail(`scenario ${scenario.id}: duplicate programme code`);
    }
    scenario.entries.forEach((entry, index) => {
      if (entry.position !== index + 1) fail(`scenario ${scenario.id}: non-contiguous positions`);
      if (!programsByCode.has(entry.code)) fail(`scenario ${scenario.id}: unknown code ${entry.code}`);
    });
    if (!scenario.reachSummary || !scenario.coreSummary || !scenario.safetySummary) {
      fail(`scenario ${scenario.id}: reach/core/safety explanation missing`);
    }
    if (!scenario.financialAssumptions || !scenario.omissions) {
      fail(`scenario ${scenario.id}: financial assumptions/omissions missing`);
    }
  });

  for (const foundation of foundations) {
    if (!foundation.verificationStatus) fail(`foundation ${foundation.university}: fee research status missing`);
    foundation.codes.forEach((code) => {
      const program = programsByCode.get(code);
      if (!program || program.type !== 'foundation') {
        fail(`foundation ${foundation.university}: invalid programme ${code}`);
      }
    });
  }
  expect(foundations.reduce((sum, foundation) => sum + foundation.codes.length, 0), 112, 'foundation code coverage');

  for (const source of sources) {
    if (!/^https?:\/\//.test(source.url)) fail(`source ${source.id}: invalid URL`);
  }
  expect(sourcesById.size, sources.length, 'unique source ids');
  assertMedipolRegression();
}
