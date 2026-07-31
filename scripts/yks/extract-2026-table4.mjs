import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import XLSX from 'xlsx';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const xlsName = 'tablo-4-hohu0j-30164357.xls';
const pdfName = '2026-yuksekogretim-kurumlari-sinavi-yks-yuksekogretim-programlari-ve-kontenjanlari-kilavuzu-h5q8kv-30170002.pdf';
const xlsPath = path.join(root, xlsName);
const pdfPath = path.join(root, pdfName);
const outputDir = path.join(root, 'src/data/yks');

const pdfAudit = JSON.parse(await readFile(path.join(outputDir, 'pdf-crosscheck-2026.json'), 'utf8'));

const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');
const nullish = (value) => {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
};
const numberOrNull = (value) => {
  const text = nullish(value);
  if (text === null || text === '...' || text === '----') return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const conditionCodes = (value) => String(value ?? '').match(/\d+/g)?.map(Number) ?? [];
const cleanName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

const provinces = [
  'ADANA','ADIYAMAN','AFYONKARAHİSAR','AĞRI','AKSARAY','AMASYA','ANKARA','ANTALYA','ARTVİN','AYDIN',
  'BALIKESİR','BARTIN','BATMAN','BAYBURT','BİLECİK','BİNGÖL','BİTLİS','BOLU','BURDUR','BURSA',
  'ÇANAKKALE','ÇANKIRI','ÇORUM','DENİZLİ','DİYARBAKIR','DÜZCE','EDİRNE','ELAZIĞ','ERZİNCAN','ERZURUM','ESKİŞEHİR',
  'GAZİANTEP','GİRESUN','GÜMÜŞHANE','HAKKARİ','HATAY','IĞDIR','ISPARTA','İSTANBUL','İZMİR',
  'KAHRAMANMARAŞ','KARABÜK','KARAMAN','KARS','KASTAMONU','KAYSERİ','KIRIKKALE','KIRKLARELİ','KIRŞEHİR','KİLİS','KOCAELİ','KONYA','KÜTAHYA',
  'MALATYA','MANİSA','MARDİN','MERSİN','MUĞLA','MUŞ','NEVŞEHİR','NİĞDE','ORDU','OSMANİYE','RİZE','SAKARYA','SAMSUN','SİİRT','SİNOP','SİVAS',
  'ŞANLIURFA','ŞIRNAK','TEKİRDAĞ','TOKAT','TRABZON','TUNCELİ','UŞAK','VAN','YALOVA','YOZGAT','ZONGULDAK',
];

function cityFor(university, faculty) {
  if (/KKTC-GAZİMAĞUSA/.test(university)) return 'Gazimağusa';
  if (/KKTC-GİRNE/.test(university)) return 'Girne';
  if (/KKTC-LEFKOŞA/.test(university)) return 'Lefkoşa';
  if (/KIRGIZİSTAN-TÜRKİYE/.test(university)) return 'Bişkek';
  if (/SAĞLIK BİLİMLERİ ÜNİVERSİTESİ/.test(university)) {
    if (/SARAYBOSNA/.test(faculty)) return 'Saraybosna';
    if (/GÜLHANE/.test(faculty)) return 'Ankara';
    if (/HAMİDİYE/.test(faculty)) return 'İstanbul';
    const facultyProvince = provinces.find((province) => faculty.startsWith(province + ' '));
    if (facultyProvince) return titleCase(facultyProvince);
  }
  const parentheses = [...university.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]);
  const explicit = parentheses.find((item) => !/Üniversitesi/i.test(item) && !/Devlet|Vakıf/i.test(item));
  if (explicit) return titleCase(explicit);
  const leading = provinces.find((province) => university.startsWith(province + ' '));
  if (leading) return titleCase(leading);
  return null;
}

function titleCase(value) {
  return value.toLocaleLowerCase('tr-TR').replace(/(^|[-\s])\p{L}/gu, (letter) => letter.toLocaleUpperCase('tr-TR'));
}

function universityType(university) {
  if (/KKTC-/.test(university)) return 'trnc';
  if (/Vakıf Üniversitesi/i.test(university)) return 'foundation';
  return 'public';
}

function scholarshipFor(name) {
  if (/\(Burslu\)/i.test(name)) return { scholarship: 'full', scholarshipRate: 100 };
  const match = name.match(/%(\d+)\s+İndirimli/i);
  if (match) return { scholarship: 'discount', scholarshipRate: Number(match[1]) };
  if (/\(Ücretli\)/i.test(name)) return { scholarship: 'paid', scholarshipRate: 0 };
  return { scholarship: 'none', scholarshipRate: null };
}

function historyFor(rankRaw, scoreRaw) {
  const rank = nullish(rankRaw);
  const score = nullish(scoreRaw);
  if (rank === '...' || score === '----') return 'unfilled';
  if (rank === null && score === null) return 'new';
  return 'closing-rank';
}

const workbook = XLSX.readFile(xlsPath, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });

let university = '';
let faculty = '';
const medicineRows = [];
for (let index = 3; index < rows.length; index += 1) {
  const row = rows[index];
  const code = cleanName(row[0]);
  const name = cleanName(row[1]);
  if (!code && /ÜNİVERSİTESİ/.test(name)) {
    university = name;
    faculty = '';
    continue;
  }
  if (!code && name) {
    faculty = name;
    continue;
  }
  if (/^\d{9}$/.test(code) && /TIP|Tıp|TİP/.test(`${faculty} ${name}`)) {
    medicineRows.push({ row, xlsRow: index + 1, code, name, university, faculty });
  }
}

const excluded = [];
const programs = [];
const suspicious = [];
for (const item of medicineRows) {
  const { row, xlsRow, code, name } = item;
  const codes = conditionCodes(row[9]);
  const restrictedNationality = codes.includes(5) || /KKTC Uyruklu/i.test(name);
  const military = /İÇİŞLERİ BAKANLIĞI VE MİLLİ SAVUNMA BAKANLIĞI ADINA/.test(item.university);
  if (restrictedNationality || military) {
    excluded.push({
      programCode: code,
      universityName: item.university,
      faculty: item.faculty,
      program: name,
      reasonCode: restrictedNationality ? 'kktc-citizen-only' : 'military-ministry-intake',
      reason: restrictedNationality
        ? 'Yalnızca koşul 5 kapsamındaki KKTC uyruklu/KKTC eğitim geçmişi uygun aday kontenjanı.'
        : 'İçişleri veya Millî Savunma Bakanlığı adına askerî/bakanlık öğrenci alımı.',
      xlsRow,
      pdfPage: pdfAudit.programPages[code] ?? null,
    });
    continue;
  }

  const historyStatus = historyFor(row[10], row[11]);
  const closingRank2025 = historyStatus === 'closing-rank' ? numberOrNull(row[10]) : null;
  const scholarship = scholarshipFor(name);
  const conditionDetails = codes.map((conditionCode) => pdfAudit.conditions[String(conditionCode)] ?? {
    code: conditionCode, text: null, pdfPage: null,
  });
  const warnings = [];
  if (!pdfAudit.programPages[code]) warnings.push('Program code was not located in the PDF text layer.');
  if (conditionDetails.some((detail) => !detail.text)) warnings.push('One or more special-condition explanations are unavailable.');
  if (scholarship.scholarship !== 'none') warnings.push('Annual tuition is not present in the official XLS; verify the current amount with the university.');
  if (historyStatus === 'new') warnings.push('No 2025 result is printed; treated as a new/no-history program.');
  if (historyStatus === 'unfilled') warnings.push('The 2025 row is marked ... / ----; treated as unfilled, never as zero.');

  const program = {
    programCode: code,
    universityName: item.university.replace(/\s*\((Devlet|Vakıf) Üniversitesi\)\s*/i, '').trim(),
    universityType: universityType(item.university),
    city: cityFor(item.university, item.faculty),
    faculty: item.faculty,
    program: name,
    language: /İngilizce/i.test(name) || codes.includes(22) ? 'English' : 'Turkish',
    ...scholarship,
    durationYears: numberOrNull(row[2]),
    scoreType: nullish(row[3]),
    quotas: {
      general: numberOrNull(row[4]),
      valedictorian: numberOrNull(row[5]),
      meb: numberOrNull(row[6]),
      martyrVeteran: numberOrNull(row[7]),
      women34: numberOrNull(row[8]),
    },
    specialConditions: codes,
    closingRank2025,
    minimumScore2025: historyStatus === 'closing-rank' ? numberOrNull(row[11]) : null,
    historyStatus,
    accreditation: nullish(row[17]),
    facultyStaff: {
      professor: numberOrNull(row[12]),
      associateProfessor: numberOrNull(row[13]),
      doctorFacultyMember: numberOrNull(row[14]),
      instructor: numberOrNull(row[15]),
    },
    tus: { tt1: numberOrNull(row[18]), tt2: numberOrNull(row[19]), ktp: numberOrNull(row[20]) },
    annualTuition: null,
    source: xlsName,
    sourceRow: xlsRow,
    sourcePage: pdfAudit.programPages[code] ?? null,
    warnings,
  };
  if (!program.city) suspicious.push({ programCode: code, issue: 'city-unavailable', xlsRow });
  if (program.durationYears !== 6 || program.scoreType !== 'SAY') suspicious.push({ programCode: code, issue: 'medicine-shape', xlsRow });
  programs.push(program);
}

const uniqueCodes = new Set(programs.map((program) => program.programCode));
const usedConditionCodes = [...new Set(programs.flatMap((program) => program.specialConditions))].sort((a, b) => a - b);
const missingConditionCodes = usedConditionCodes.filter((code) => !pdfAudit.conditions[String(code)]?.text);
const usedConditions = Object.fromEntries(usedConditionCodes.map((code) => [code, pdfAudit.conditions[String(code)]]));
const pdfMisses = programs.filter((program) => program.sourcePage === null).map((program) => program.programCode);

const counts = {
  table4MedicineRows: medicineRows.length,
  eligiblePrograms: programs.length,
  excludedPrograms: excluded.length,
  excludedKktcCitizenOnly: excluded.filter((item) => item.reasonCode === 'kktc-citizen-only').length,
  excludedMilitaryMinistry: excluded.filter((item) => item.reasonCode === 'military-ministry-intake').length,
  public: programs.filter((program) => program.universityType === 'public').length,
  foundation: programs.filter((program) => program.universityType === 'foundation').length,
  trnc: programs.filter((program) => program.universityType === 'trnc').length,
  withClosingRank: programs.filter((program) => program.closingRank2025 !== null).length,
  newWithoutHistory: programs.filter((program) => program.historyStatus === 'new').length,
  unfilled2025: programs.filter((program) => program.historyStatus === 'unfilled').length,
  accredited: programs.filter((program) => program.accreditation !== null).length,
};

const validation = {
  schemaVersion: 1,
  generatedAt: '2026-07-31T00:00:00.000+03:00',
  valid: medicineRows.length === 242 && programs.length === 225 && uniqueCodes.size === programs.length
    && excluded.length === 17 && missingConditionCodes.length === 0 && pdfMisses.length === 0,
  counts,
  invariants: {
    uniqueProgramCodes: uniqueCodes.size === programs.length,
    allMedicineSixYearSay: programs.every((program) => program.durationYears === 6 && program.scoreType === 'SAY'),
    excludedRestrictedRows: excluded.length === 17,
    allProgramCodesFoundInPdf: pdfMisses.length === 0,
    allUsedConditionCodesExplained: missingConditionCodes.length === 0,
    nullsAreNotZero: programs.filter((program) => program.historyStatus !== 'closing-rank').every((program) => program.closingRank2025 === null),
  },
  skipped: excluded,
  suspicious,
  missingConditionCodes,
  pdfMisses,
};

const xlsHash = await sha256(xlsPath);
const pdfHash = await sha256(pdfPath);
const manifest = {
  schemaVersion: 1,
  datasetVersion: '2026.07.31-final-guide',
  generatedAt: validation.generatedAt,
  primarySource: { file: xlsName, sha256: xlsHash, sheet: sheetName, range: workbook.Sheets[sheetName]['!ref'] },
  validationSource: { file: pdfName, sha256: pdfHash, pages: pdfAudit.pdfPages },
  counts,
  formulas: { candidateAdvantage: 'closingRank2025 - candidateRank' },
  conditionCodes: usedConditionCodes,
};

await writeFile(path.join(outputDir, 'medicine-programs-2026.json'), JSON.stringify(programs, null, 2) + '\n');
await writeFile(path.join(outputDir, 'conditions-2026.json'), JSON.stringify(usedConditions, null, 2) + '\n');
await writeFile(path.join(outputDir, 'excluded-2026.json'), JSON.stringify(excluded, null, 2) + '\n');
await writeFile(path.join(outputDir, 'validation-2026.json'), JSON.stringify(validation, null, 2) + '\n');
await writeFile(path.join(outputDir, 'manifest-2026.json'), JSON.stringify(manifest, null, 2) + '\n');

if (!validation.valid) throw new Error(`Generated dataset failed validation: ${JSON.stringify(validation.invariants)}`);
console.log(`Wrote ${programs.length} eligible programs; excluded ${excluded.length}; PDF misses ${pdfMisses.length}.`);
