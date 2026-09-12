import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { candidateAdvantage, programs } from '../src/data/yks';
import { DEFAULT_FILTERS, filterPrograms } from '../src/components/yks/lib/filters';
import { MAX_PREFERENCES, parseStoredWizard } from '../src/store/yksStore';
import { resolveEquivalentPath } from '../src/i18n/routes';

test('dataset is unique, Medicine-only, and excludes restricted rows', () => {
  assert.equal(programs.length, 225);
  assert.equal(new Set(programs.map((program) => program.programCode)).size, programs.length);
  assert.ok(programs.every((program) => program.durationYears === 6 && program.scoreType === 'SAY'));
  assert.ok(programs.every((program) => !/KKTC Uyruklu|MİLLİ SAVUNMA|İÇİŞLERİ BAKANLIĞI ADINA/.test(`${program.program} ${program.universityName}`)));
});

test('candidate difference has the documented sign', () => {
  const program = programs.find((item) => item.closingRank2025 !== null)!;
  assert.equal(candidateAdvantage(program, program.closingRank2025! - 500), 500);
  assert.equal(candidateAdvantage(program, program.closingRank2025! + 500), -500);
});

test('new and unfilled programs never become numeric zero', () => {
  const missing = programs.filter((program) => program.historyStatus !== 'closing-rank');
  assert.ok(missing.length > 0);
  assert.ok(missing.every((program) => program.closingRank2025 === null));
  assert.ok(missing.every((program) => candidateAdvantage(program, 26_000) === null));
});

test('stored preference restore deduplicates and enforces 24-item limit', () => {
  const codes = Array.from({ length: 30 }, (_, index) => String(100_000_000 + index));
  const restored = parseStoredWizard(JSON.stringify({ version: 2, preferences: [...codes, codes[0]], favourites: [codes[0], codes[0]], candidateRank: 27000 }));
  assert.ok(restored);
  assert.equal(restored!.preferences.length, MAX_PREFERENCES);
  assert.deepEqual(restored!.favourites, [codes[0]]);
  assert.equal(restored!.candidateRank, 27000);
});

test('combined filters apply together', () => {
  const target = programs.find((program) => program.city && program.accreditation && program.closingRank2025 !== null)!;
  const result = filterPrograms(programs, { ...DEFAULT_FILTERS, query: target.universityName, types: [target.universityType], cities: [target.city!], languages: [target.language], accreditedOnly: true });
  assert.ok(result.some((program) => program.programCode === target.programCode));
  assert.ok(result.every((program) => program.city === target.city && program.universityType === target.universityType && program.accreditation !== null));
});

test('search treats Turkish i/İ/ı/I variants consistently', () => {
  const ascii = filterPrograms(programs, { ...DEFAULT_FILTERS, query: 'ISTANBUL' });
  const dotted = filterPrograms(programs, { ...DEFAULT_FILTERS, query: 'İstanbul' });
  assert.deepEqual(ascii.map((program) => program.programCode).sort(), dotted.map((program) => program.programCode).sort());
});

test('mobile CSS prevents page overflow and collapses tables', () => {
  const css = readFileSync('src/styles/yks.css', 'utf8');
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /@media \(max-width:640px\)/);
  assert.match(css, /\.yks-program-table[^}]*display:block/);
});

test('the Sun route has a Turkish page equivalent', () => {
  assert.equal(resolveEquivalentPath({ kind: 'sun' }, 'tr'), '/tr/star/sun/');
  assert.equal(resolveEquivalentPath({ kind: 'sun' }, 'en'), '/star/sun/');
});
