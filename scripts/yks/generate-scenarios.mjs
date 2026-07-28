#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const programs = JSON.parse(fs.readFileSync(path.join(root, 'src/data/yks/programs.json'), 'utf8'));
const lineage = JSON.parse(fs.readFileSync(path.join(root, 'src/data/yks/lineage.json'), 'utf8'));
const programByCode = new Map(programs.map((program) => [program.code, program]));
const lineageByCode = new Map(lineage.map((program) => [program.code, program]));

const bandLabel = {
  strong: 'Güçlü',
  realistic: 'Gerçekçi',
  borderline: 'Sınırda',
  reach: 'Zayıf / erişim',
  speculative: 'Çok spekülatif',
};

const lists = [
  {
    id: 'balanced',
    title: 'Dengeli ana liste — istek sırası, devlet çekirdeği ve mali güvence',
    intro: 'Erişilmesi zor ama gerçekten istenen seçenekler üstte; ardından 26.000 çevresindeki devlet çekirdeği ve finansmanı ayrıca doğrulanacak vakıf seçenekleri gelir.',
    reachSummary: 'İlk bölüm, yerleşme ihtimali düşük olsa da istek değeri yüksek devlet ve burslu/indirimli programları içerir.',
    coreSummary: 'Orta bölüm 2025 kapanışları 23–26 bin bandındaki devlet programları ile güçlü yapısal eşleşmesi olan seçeneklerden oluşur.',
    safetySummary: 'Son bölüm, karşılaştırılabilir havuzu 26.000’in gerisinde kapanan vakıf programlarıdır; akademik güvenlik mali güvenlik anlamına gelmez.',
    financialAssumptions: 'Vakıf ücretleri yalnız 2026–2027 yıllık tutardır. İndirimlerin devamı ve ödeme planı kayıt öncesi yazılı doğrulanmalıdır.',
    omissions: 'Adayın şehir, eğitim dili ve azami bütçe tercihi bilinmediği için çok pahalı ücretli programların çoğu bu 24’e alınmadı; tamamı keşif ekranındadır.',
    codes: [
      '200910036', '203511514', '207610451', '103910364', '110210269', '111410405',
      '100610331', '108710112', '105010164', '106010188', '104310164', '111570309',
      '104510189', '105110136', '102310152', '100210168', '106110415', '103610101',
      '105910207', '100590061', '209410124', '201990552', '209210052', '203111166',
    ],
  },
  {
    id: 'budget',
    title: 'Bütçe odaklı alternatif — devlet ve tam burs önceliği',
    intro: 'Öğrenim ücreti riskini azaltır; ulaşım, barınma ve KKTC yaşam giderlerini ücretsiz eğitimle karıştırmaz.',
    reachSummary: 'Üstte, ücret ödemeden okunabilecek ve gerçekten istenen tam burslu seçenekler bulunur.',
    coreSummary: 'Ana gövde 26.000’e en yakın devlet programlarından oluşur.',
    safetySummary: 'KKTC tam burslu sınır seçenekleri akademik yedek olabilir; yaşam ve ulaşım bütçesi ayrıca hesaplanmalıdır.',
    financialAssumptions: 'Devlet programlarında öğrenim ücreti yazılmamıştır; tam burs 0 TL öğrenim ücreti olarak tutulur. Barınma, yemek ve ulaşım hariçtir.',
    omissions: 'Ücretli ve kısmi indirimli vakıf programları bütçe varsayımı nedeniyle listeden çıkarıldı; explorer’da görünmeye devam eder.',
    codes: [
      '201911094', '201990530', '210302061', '210402544', '206210697', '103910364',
      '110210269', '111410405', '110310144', '111091392', '100610331', '108710112',
      '105010164', '106010188', '104310164', '111570309', '104510189', '105110136',
      '102310152', '100210168', '105910207', '100590061', '300511522', '300710249',
    ],
  },
  {
    id: 'reach',
    title: 'Erişim odaklı alternatif — yüksek istek değeri üstte',
    intro: 'Liste, olasılıktan bağımsız istek sırasını korur. Zor seçenekleri üste yazmak alttaki seçeneklerin şansını azaltmaz.',
    reachSummary: 'Tam burslu ve talebi yüksek programlar ile daha önde kapatan devletler listenin üst bölümündedir.',
    coreSummary: 'Orta bölüm seçilmiş %50 indirimli programlar ve 23–26 bin devlet bandıdır.',
    safetySummary: 'Karşılaştırılabilir 2025 havuzu geride kapanan veya dolmayan yüksek ücretli programlar yalnız finansman mümkünse yedektir.',
    financialAssumptions: 'Yaklaşık 1,10 milyon TL/yıl üst sınırı varsayılır; tutarların her yıl değişeceği ve altı yıl boyunca sabit kalmayacağı kabul edilir.',
    omissions: 'Daha pahalı programlar ve adayın istemediği varsayılan bazı şehirler 24 sınırı nedeniyle dışarıda bırakıldı.',
    codes: [
      '201911094', '201990530', '210302061', '210402544', '200910036', '203511514',
      '207610451', '207650948', '202610157', '103910364', '110210269', '111410405',
      '100610331', '108710112', '105010164', '104510189', '105110136', '105910207',
      '100590061', '201990552', '209410124', '202391004', '209210052', '203111166',
    ],
  },
  {
    id: 'state-first',
    title: 'Devlet üniversitesi öncelikli alternatif — 24 sivil program',
    intro: 'Devlet tıp isteği belirleyiciyse, üstten alta gerçek istek sırasıyla düzenlenecek bir başlangıç iskeletidir.',
    reachSummary: 'İlk bölüm aday sırasının önünde kapatan fakat şehir/fakülte tercihi nedeniyle yazılabilecek devlet programlarıdır.',
    coreSummary: 'Orta bölüm 23–25 bin geçmiş kapanışlı devlet programlarıdır.',
    safetySummary: 'Ağrı sınırdadır; Bitlis ve Burdur gerçekten yeni olduğu için “güvenli” sayılmaz, yalnız yeni program belirsizliğiyle sonda yer alır.',
    financialAssumptions: 'Öğrenim ücreti yerine şehirler arası barınma ve ulaşım maliyeti belirleyici kabul edilmiştir.',
    omissions: 'Bütün vakıf ve KKTC programları bu senaryonun amacı gereği dışarıdadır; tam envanter explorer’dadır.',
    codes: [
      '103910364', '110210269', '111410405', '110310144', '111091392', '100610331',
      '108710112', '105010164', '106010188', '104310164', '111210046', '111570309',
      '104510189', '105110136', '107190123', '109090052', '102310152', '100210168',
      '106110415', '103610101', '105910207', '100590061', '107300269', '102100115',
    ],
  },
];

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function makeEntry(code, index) {
  const program = programByCode.get(code);
  const audit = lineageByCode.get(code);
  if (!program || !audit) throw new Error(`Unknown scenario programme: ${code}`);
  const predecessor = audit.history.comparablePredecessor
    ?? audit.history.exactCodeRows.find((row) => row.year === 2025)
    ?? null;
  return {
    position: index + 1,
    code,
    heading: `${program.university} ${program.programName}`,
    data: predecessor
      ? `${predecessor.year} karşılaştırma: ${predecessor.closingRank === null ? predecessor.filledStatus : formatNumber(predecessor.closingRank)} • 2026 kont. ${program.quota2026}`
      : `Güvenilir kapanış yok • 2026 kont. ${program.quota2026}`,
    reasoning: audit.placementAssessment.reason,
    probability: bandLabel[audit.placementAssessment.band],
    cost: program.type === 'state' ? 'Devlet programı; yaşam giderleri hariç' : audit.tuition.placementDiscount,
    firstYearListCost: audit.tuition.baseAnnualPayable === null
      ? null
      : audit.tuition.baseAnnualPayable === 0
        ? '0 TL — tam burs'
        : `${formatNumber(audit.tuition.baseAnnualPayable)} TL`,
    conditionalCost: audit.tuition.effectiveScenarios.find((scenario) => scenario.annualFee !== audit.tuition.baseAnnualPayable)?.label ?? null,
  };
}

const output = lists.map(({ codes, ...scenario }) => ({
  ...scenario,
  entries: codes.map(makeEntry),
}));

fs.writeFileSync(
  path.join(root, 'src/data/yks/scenarios.json'),
  `${JSON.stringify(output, null, 2)}\n`,
);

console.log(JSON.stringify(output.map(({ id, entries }) => ({ id, entries: entries.length })), null, 2));
