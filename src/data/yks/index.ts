/**
 * Typed entry point for the 2026 YKS medicine dataset.
 *
 * `validateYksDataset()` is called from the page's frontmatter, so it runs
 * during `astro build`: a dataset that violates any invariant fails the build
 * rather than shipping a wrong number to someone making a real decision.
 */
import excludedJson from './excluded.json';
import foundationsJson from './foundations.json';
import guidanceJson from './guidance.json';
import metaJson from './report-meta.json';
import programsJson from './programs.json';
import scenariosJson from './scenarios.json';
import sourcesJson from './sources.json';

import type {
  ExcludedProgram,
  Foundation,
  Guidance,
  ProbabilityBand,
  Program,
  ReportMeta,
  Scenario,
  Source,
} from './types';

export * from './types';

export const programs = programsJson as Program[];
export const foundations = foundationsJson as Foundation[];
export const scenarios = scenariosJson as Scenario[];
export const sources = sourcesJson as Source[];
export const excluded = excludedJson as ExcludedProgram[];
export const guidance = guidanceJson as Guidance;
export const reportMeta = metaJson as ReportMeta;

/** Display order for bands, best chance first. */
export const BAND_ORDER: ProbabilityBand[] = ['strong', 'borderline', 'weak', 'unmeasured'];

export const BAND_LABELS: Record<ProbabilityBand, string> = {
  strong: 'Güçlü tarihsel marj',
  borderline: 'Sınırda / gerçekçi',
  weak: 'Zayıf ihtimal',
  unmeasured: 'Geçmişsiz / ölçülemez',
};

/** Short explanation of what each band means, shown next to the filter chips. */
export const BAND_DESCRIPTIONS: Record<ProbabilityBand, string> = {
  strong: '2025 kapanışı 26.000’in gerisinde; geçmiş veriye göre rahat görünüyor.',
  borderline: '2025 kapanışına 1.000 sıradan yakın; her iki yöne de dönebilir.',
  weak: '2025 kapanışı 26.000’in en az 1.000 sıra üstünde; zor ama imkânsız değil.',
  unmeasured: '2025 kapanış verisi yok; geçmişle ölçülemiyor.',
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

/**
 * Asserts every invariant the page relies on. Counts are cross-checked against
 * the totals the report itself prints in its appendix footers.
 */
export function validateYksDataset(): void {
  const { counts } = reportMeta;

  expect(programs.length, 225, 'programme count');
  expect(programsByCode.size, programs.length, 'unique programme codes');
  expect(counts.programs, programs.length, 'meta programme count');

  const byType = (type: Program['type']) => programs.filter((p) => p.type === type).length;
  expect(byType('state'), 100, 'state programmes');
  expect(byType('foundation'), 112, 'foundation programmes');
  expect(byType('kktc-intl'), 13, 'KKTC / international programmes');

  expect(foundations.length, 33, 'foundation faculty groups');
  expect(counts.stateGroups, 89, 'state faculty groups');
  expect(sources.length, 45, 'sources');
  expect(sourcesById.size, sources.length, 'unique source ids');
  expect(excluded.length, 5, 'excluded programmes');

  for (const program of programs) {
    const where = `programme ${program.code}`;
    if (!/^\d{9}$/.test(program.code)) fail(`${where}: malformed code`);
    if (!program.programName || !program.university) fail(`${where}: missing name`);
    if (!BAND_ORDER.includes(program.band)) fail(`${where}: unknown band ${program.band}`);
    if (program.quota2026 < 1) fail(`${where}: non-positive quota`);
    if (program.closingRank2025 !== null && program.closingRank2025 < 1) {
      fail(`${where}: non-positive closing rank`);
    }
    // 0 TL means "a full scholarship covers this"; null means "no figure applies".
    // Collapsing the two would advertise free tuition where none was published.
    if (program.estimatedPayment !== null && program.estimatedPayment < 0) {
      fail(`${where}: negative payment`);
    }
    if (program.scholarship === 'paid' && program.estimatedPayment === 0) {
      fail(`${where}: a paid programme cannot cost 0 TL`);
    }
    if (program.type === 'state' && program.estimatedPayment !== null) {
      fail(`${where}: state programmes carry no tuition figure`);
    }
    const hasHistory = program.closingRank2025 !== null;
    if (hasHistory === (program.band === 'unmeasured')) {
      fail(`${where}: band "${program.band}" contradicts its rank history`);
    }
  }

  for (const entry of excluded) {
    if (programsByCode.has(entry.code)) {
      fail(`excluded programme ${entry.code} must not appear in the pool`);
    }
  }

  expect(scenarios.length, 3, 'scenarios');
  for (const scenario of scenarios) {
    expect(scenario.entries.length, 24, `scenario ${scenario.id} entries`);
    const positions = scenario.entries.map((entry) => entry.position);
    if (new Set(positions).size !== 24 || Math.min(...positions) !== 1 || Math.max(...positions) !== 24) {
      fail(`scenario ${scenario.id}: preference positions must be 1-24 with no gaps`);
    }
    const codes = new Set(scenario.entries.map((entry) => entry.code));
    if (codes.size !== 24) fail(`scenario ${scenario.id}: duplicate programme codes`);
    for (const code of codes) {
      if (!programsByCode.has(code)) fail(`scenario ${scenario.id}: unknown code ${code}`);
    }
  }

  for (const foundation of foundations) {
    const where = `foundation ${foundation.university}`;
    if (!foundation.preferenceDiscount) fail(`${where}: missing preference discount text`);
    if (!foundation.academicScholarship) fail(`${where}: missing academic scholarship text`);
    if (!foundation.extraBenefits) fail(`${where}: missing extra benefits text`);
    if (!foundation.verificationStatus) fail(`${where}: missing verification status`);
    if (foundation.codes.length === 0) fail(`${where}: no programmes`);
    for (const code of foundation.codes) {
      if (programsByCode.get(code)?.type !== 'foundation') {
        fail(`${where}: code ${code} is not a foundation programme`);
      }
    }
  }
  expect(
    foundations.reduce((total, foundation) => total + foundation.codes.length, 0),
    112,
    'foundation programme codes',
  );

  for (const source of sources) {
    if (!/^https?:\/\//.test(source.url)) fail(`source ${source.id}: not an absolute URL`);
  }

  for (const band of BAND_ORDER) {
    expect(
      programs.filter((program) => program.band === band).length,
      counts.bands[band],
      `band "${band}" count`,
    );
  }
}
