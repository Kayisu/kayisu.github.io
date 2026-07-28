import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const auditPath = process.argv[2];
if (!auditPath) {
  throw new Error('Usage: node scripts/yks/generate-lineage.mjs <normalized-audit.json>');
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const programs = readJson(resolve(root, 'src/data/yks/programs.json'));
const foundations = readJson(resolve(root, 'src/data/yks/foundations.json'));
const audit = readJson(resolve(auditPath));

const guide2025 = new Map(audit.guides['2025'].map((row) => [row.code, row]));
const guide2024 = new Map(audit.guides['2024'].map((row) => [row.code, row]));
const guide2023 = new Map(audit.guides['2023'].map((row) => [row.code, row]));
const current2026 = new Map(audit.current2026.map((row) => [row.code, row]));
const programByCode = new Map(programs.map((row) => [row.code, row]));
const foundationByUniversity = new Map(foundations.map((row) => [row.university, row]));
const foundationSourceId = new Map(
  foundations.map((row, index) => [
    row.university,
    row.university === 'İstanbul Medipol Üniversitesi Uluslararası Tıp Fakültesi'
      ? 'V15'
      : `V${index > 15 ? index : index + 1}`,
  ]),
);

const predecessorOverrides = {
  '202900206': {
    status: 'comparable_predecessor',
    confidence: 'medium',
    code: '202910763',
    closingRank: 18493,
    note: '2025’te aynı fakültedeki 7 kişilik program İngilizce ve bursluydu; 2026’da aynı kontenjan Türkçe yeni kod altında açıldı.',
    transformation: 'İngilizce → Türkçe ve yeni kod; burs kategorisi ile kontenjan aynı.',
    assessment: 'reach',
  },
  '202900213': {
    status: 'comparable_predecessor',
    confidence: 'medium',
    code: '202990302',
    closingRank: null,
    note: '2025’te aynı fakültedeki 46 kişilik İngilizce %50 programına 35 kişi yerleşti; 2026’da aynı kontenjan Türkçe yeni kod altında.',
    transformation: 'İngilizce → Türkçe ve yeni kod; 2025 havuzu dolmadı.',
    assessment: 'strong',
  },
  '209210052': {
    status: 'comparable_predecessor',
    confidence: 'high',
    code: '209210054',
    closingRank: 33458,
    note: '2026 ücretli 76 kişilik havuzun doğrudan karşılığı, 2025’te 76 kişilik %50 indirimli 209210054 koduydu ve 33.458’de kapandı.',
    transformation: '%50 indirimli → ücretli; 76 kişilik havuz korunuyor. Ücretli kod 2023–2024’te küçük kontenjanla da aktifti.',
    assessment: 'strong',
  },
  '209210049': {
    status: 'comparable_predecessor',
    confidence: 'high',
    code: '209210051',
    closingRank: null,
    note: '2025 İngilizce %50 indirimli 76 kişilik havuza yalnız 59 aday yerleşti; tam dolmadığı için resmî kapanış sırası yok. 2026’da aynı büyüklükteki havuz ücretli koda taşındı.',
    transformation: '%50 indirimli → ücretli; 76 kişilik havuz korunuyor ve 2025 havuzu dolmadı.',
    assessment: 'strong',
  },
  '200900346': {
    status: 'analogous_program_only',
    confidence: 'medium',
    code: '200910027',
    closingRank: 6232,
    note: 'İngilizce burslu hat 2026’da ilk kez ayrı kodla sunuluyor; en yakın analog aynı fakültenin 2025 Türkçe burslu programı.',
    transformation: 'Yeni İngilizce hat; Türkçe program yalnız analogdur.',
    assessment: 'reach',
  },
  '200900353': {
    status: 'analogous_program_only',
    confidence: 'medium',
    code: '200910036',
    closingRank: 28868,
    note: 'İngilizce %50 hat 2026’da ilk kez ayrı kodla sunuluyor; en yakın analog aynı fakültenin 2025 Türkçe %50 programıdır.',
    transformation: 'Yeni İngilizce hat; Türkçe program yalnız analogdur.',
    assessment: 'borderline',
  },
  '201990545': {
    status: 'comparable_predecessor',
    confidence: 'medium',
    code: '201911085',
    closingRank: null,
    note: '2025 Türkçe havuz 75 ücretli + 23 %25 indirimli koltuğa ayrılmıştı; ücretli koda yalnız 9 aday yerleşti. 2026’da 99 koltuk %50 indirimli tek havuzda toplandı.',
    transformation: '75 ücretli + 23 %25 → 99 %50; kategori daha cazip, toplam havuz yaklaşık sabit.',
    relatedCodes: ['201911119'],
    assessment: 'realistic',
  },
  '203111166': {
    status: 'comparable_predecessor',
    confidence: 'high',
    code: '203110292',
    closingRank: 47837,
    note: '2026 ücretli kodun aynı-kod 2025 kapanışı yok; eşdeğer 170 kişilik havuz 2025’te %50 indirimliydi ve 47.837’de kapandı.',
    transformation: '%50 indirimli → ücretli; 170 kişilik havuz korunuyor. Ücretli kod 2023’te 3 koltukla aktifti.',
    assessment: 'strong',
  },
  '203101284': {
    status: 'comparable_predecessor',
    confidence: 'high',
    code: '203190974',
    closingRank: 49259,
    note: '2026 İngilizce ücretli kodun aynı-kod 2025 kapanışı yok; eşdeğer 68 kişilik havuz 2025’te %50 indirimliydi ve 49.259’da kapandı.',
    transformation: '%50 indirimli → ücretli; 68 kişilik havuz korunuyor.',
    assessment: 'strong',
  },
  '203101291': {
    status: 'comparable_predecessor',
    confidence: 'low',
    code: '203110477',
    closingRank: 38,
    note: 'Uluslararası Tıp Fakültesi 2025’te 10 burslu koltuktu; 2026’da 3 burslu + 7 ücretli olarak bölündü. Burslu kapanış sırası, ücretli talebi için doğrudan tahmin değildir.',
    transformation: '10 burslu → 3 burslu + 7 ücretli; kategori değişimi karşılaştırılabilirliği zayıflatıyor.',
    assessment: 'speculative',
  },
  '210403237': {
    status: 'comparable_predecessor',
    confidence: 'high',
    code: '210402551',
    closingRank: null,
    note: '2025’te 85 ücretli koltuğun yalnız 24’ü doldu; 2026’da 1 ücretli + 84 %50 indirimli olarak yeniden yapılandırıldı.',
    transformation: '85 ücretli → 1 ücretli + 84 %50; kategori daha cazip, toplam havuz sabit.',
    assessment: 'realistic',
  },
  '102100115': {
    status: 'genuinely_new',
    confidence: 'high',
    code: null,
    closingRank: null,
    note: '2023–2025 ÖSYM Tablo-4 tıp satırlarında güvenilir bir önceki program bulunamadı.',
    transformation: '2026’da ilk öğrenci alımı.',
    assessment: 'speculative',
  },
  '107300269': {
    status: 'genuinely_new',
    confidence: 'high',
    code: null,
    closingRank: null,
    note: 'Üniversitenin resmî duyurusu ve ÖSYM tabloları 2026’yı ilk öğrenci alımı olarak gösteriyor.',
    transformation: '2026’da ilk öğrenci alımı.',
    assessment: 'speculative',
  },
  '103100444': {
    status: 'analogous_program_only',
    confidence: 'medium',
    code: '103110557',
    closingRank: 7447,
    note: 'İngilizce hat 2026’da yeni; aynı fakültenin 2025 Türkçe Tıp programı yalnız talep analoğu olarak kullanılabilir.',
    transformation: 'Ayrı İngilizce hat ve yeni kod.',
    assessment: 'reach',
  },
};

const bandOrder = ['strong', 'realistic', 'borderline', 'reach', 'speculative'];
function exactHistoricalRows(code, currentRank) {
  const result = [];
  const row2025 = guide2025.get(code);
  const row2024 = guide2024.get(code);
  const row2023 = guide2023.get(code);
  if (row2025) {
    result.push({
      year: 2025,
      code,
      programName: row2025.programName,
      scholarshipType: row2025.scholarshipType,
      language: row2025.language,
      quota: row2025.quota,
      placed: row2025.placement?.placed ?? null,
      filled: row2025.placement?.filled ?? null,
      filledStatus: row2025.placement?.filled === true ? 'filled' : row2025.placement?.filled === false ? 'unfilled' : 'unknown',
      closingRank: currentRank,
      closingScore: row2025.placement?.minScore ?? null,
      sourceIds: ['OSYM-2025-RESULTS', 'OSYM-2026-GUIDE'],
    });
  }
  if (row2024) {
    result.push({
      year: 2024,
      code,
      programName: row2024.programName,
      scholarshipType: row2024.scholarshipType,
      language: row2024.language,
      quota: row2024.quota,
      placed: null,
      filled: null,
      filledStatus: 'unknown',
      closingRank: row2025?.previousYearClosingRank ?? null,
      closingScore: null,
      sourceIds: ['OSYM-2024-GUIDE', 'OSYM-2025-GUIDE'],
    });
  }
  if (row2023) {
    result.push({
      year: 2023,
      code,
      programName: row2023.programName,
      scholarshipType: row2023.scholarshipType,
      language: row2023.language,
      quota: row2023.quota,
      placed: null,
      filled: null,
      filledStatus: 'unknown',
      closingRank: row2024?.previousYearClosingRank ?? null,
      closingScore: null,
      sourceIds: ['OSYM-2023-GUIDE', 'OSYM-2024-GUIDE'],
    });
  }
  return result;
}

function programTypeLabel(type) {
  if (type === 'state') return 'Devlet';
  if (type === 'foundation') return 'Vakıf';
  return 'KKTC / yurt dışı';
}

function baseAssessment(rank, exactRow, program, historyStatus) {
  if (rank != null) {
    if (rank >= 36_000) return 'strong';
    if (rank >= 28_000) return 'realistic';
    if (rank >= 24_000) return 'borderline';
    return 'reach';
  }
  if (exactRow?.filled === false) {
    return program.scholarship === 'full' ? 'realistic' : 'strong';
  }
  if (historyStatus === 'genuinely_new' || historyStatus === 'analogous_program_only') {
    return 'speculative';
  }
  return 'speculative';
}

function moveBand(band, delta) {
  const index = bandOrder.indexOf(band);
  return bandOrder[Math.max(0, Math.min(bandOrder.length - 1, index + delta))];
}

function assessmentReason(program, history, rank) {
  const predecessor = history.comparablePredecessor;
  if (history.status === 'genuinely_new') {
    return `2026’da ilk kez öğrenci alıyor; ${program.quota2026} kişilik kontenjan ve şehir talebi dışında doğrudan kapanış verisi yok.`;
  }
  if (history.status === 'analogous_program_only') {
    return `${predecessor?.year ?? 2025} analoğu ${predecessor?.closingRank ? `${predecessor.closingRank.toLocaleString('tr-TR')} sıralamasında kapandı` : 'doğrudan kapanış vermiyor'}; dil veya program ayrışması nedeniyle tahmin belirsiz.`;
  }
  if (predecessor && history.status === 'comparable_predecessor') {
    return history.explanation;
  }
  if (rank != null) {
    const margin = rank - 26_000;
    return `Aynı kodun 2025 kapanışı ${rank.toLocaleString('tr-TR')}; aday lehine marj ${margin >= 0 ? margin.toLocaleString('tr-TR') : '−' + Math.abs(margin).toLocaleString('tr-TR')} sıra. 2026 kontenjanı ve talep değişebilir.`;
  }
  const exact = history.exactCodeRows[0];
  if (exact?.filled === false) {
    return `Aynı kod 2025’te ${exact.placed}/${exact.quota} doldu; program dolmadığı için resmî kapanış sırası yok. 26.000 sırası tıp için 50.000 barajını sağlıyor.`;
  }
  return `${programTypeLabel(program.type)} programında güvenilir bir 2025 kapanış sırası yayımlanmadı; sınıflandırma yapısal sinyallerle sınırlı.`;
}

function tuitionFor(program) {
  const foundation = foundationByUniversity.get(program.university);
  const discount = program.scholarship === 'full'
    ? 1
    : program.scholarship === 'half'
      ? 0.5
      : program.scholarship === 'quarter'
        ? 0.25
        : 0;
  const basePayable = program.scholarship === 'full' ? 0 : program.estimatedPayment;
  const listedAnnualFee = basePayable == null || program.scholarship === 'full'
    ? null
    : Math.round(basePayable / (1 - discount));
  const preferenceRate = basePayable && program.conditionalPreferenceCost != null
    ? 1 - (program.conditionalPreferenceCost / basePayable)
    : null;
  let candidateAdmissionBenefitEligibility = 'Rütbe eşiğine bağlı doğrulanmış bir giriş desteği yok.';
  if (program.university.startsWith('Biruni')) {
    candidateAdmissionBenefitEligibility = '26.000 sırası, ilan edilen ilk 30.000 eşiğini sağlar; 1. tercih koşulu ayrıca gerekir.';
  } else if (program.university.startsWith('Demiroğlu')) {
    candidateAdmissionBenefitEligibility = '26.000 sırası, ilan edilen 25.000 üst sınırını sağlamaz.';
  } else if (program.university.includes('Medipol')) {
    candidateAdmissionBenefitEligibility = '26.000 sırası, ilk 1.000 derece desteklerini sağlamaz.';
  } else if (program.university.startsWith('Bezm-İ')) {
    candidateAdmissionBenefitEligibility = '26.000 sırası, ilan edilen ilk 10.000 aylık destek eşiğini sağlamaz.';
  }
  const amountStatus = program.type === 'state'
    ? 'not_applicable'
    : program.scholarship === 'full'
      ? 'free_full_scholarship'
      : basePayable == null
        ? 'not_published'
        : 'known';
  return {
    listedAnnualFee,
    currency: 'TRY',
    vatIncluded: program.type === 'foundation' && listedAnnualFee != null ? true : null,
    amountStatus,
    placementDiscount: program.scholarship,
    baseAnnualPayable: basePayable,
    preferenceDiscount: {
      rate: preferenceRate,
      description: foundation?.preferenceDiscount ?? 'Program bazında doğrulanmış tercih indirimi yok.',
    },
    successDiscount: foundation?.academicScholarship ?? 'Program bazında doğrulanmış giriş başarı bursu yok.',
    candidateAdmissionBenefitEligibility,
    combinedDiscount: preferenceRate == null
      ? 'Birleşme hesabı yayımlanmadı veya bu program için uygulanmıyor.'
      : 'Gösterilen koşullu tutar tercih indiriminin ÖSYM kategorisi sonrası kalan tutara uygulanmasıyla hesaplandı; yazılı teyit gerekir.',
    effectiveScenarios: [
      {
        id: 'osym-category',
        label: 'ÖSYM program kategorisi',
        annualFee: basePayable,
        status: amountStatus,
      },
      ...(program.conditionalPreferenceCost != null
        ? [{
            id: 'confirmed-preference',
            label: 'Yayımlanan tercih koşulu sağlanırsa',
            annualFee: program.conditionalPreferenceCost,
            status: 'conditional',
          }]
        : []),
    ],
    cashPaymentDiscount: foundation?.extraBenefits?.includes('Peşin')
      ? 'Peşin ödeme indirimi yayımlanmış; oran ve birleşme sırası kod bazında teyit edilmeli.'
      : 'Program bazında yayımlanmış peşin ödeme oranı bu çalışmada doğrulanmadı.',
    installmentOptions: program.type === 'foundation'
      ? 'Taksit sayısı ve ödeme planı üniversiteden kod bazında yazılı alınmalı.'
      : 'Uygulanmaz.',
    continuationRules: program.scholarship && program.scholarship !== 'paid'
      ? 'ÖSYM bursu/indirimi, kılavuz koşul 21 uyarınca hazırlıkta bir yıl ve programın normal süresi boyunca devam ve derslere katılım koşuluyla kesilmez.'
      : 'Ücret ve üniversite kaynaklı indirimler her akademik yıl yeniden ilan edilebilir.',
    recalculatedAnnually: program.type === 'foundation' ? true : null,
    preparationCoverage: program.language === 'en'
      ? 'Zorunlu hazırlık ücreti ve indirim kapsamı üniversitenin program koşuluna göre uygulanır; kod bazında teyit edilmeli.'
      : 'Zorunlu İngilizce hazırlık yok veya uygulanmıyor.',
    sourceIds: program.type === 'foundation'
      ? ['OSYM-2026-GUIDE', foundationSourceId.get(program.university)].filter(Boolean)
      : ['OSYM-2026-GUIDE'],
  };
}

const lineages = programs.map((program) => {
  const override = predecessorOverrides[program.code];
  const exactRows = exactHistoricalRows(program.code, program.closingRank2025);
  const current = current2026.get(program.code);
  const status = override?.status ?? 'exact_code_match';
  const confidence = override?.confidence ?? 'high';
  const predecessorSource = override?.closingRank != null
    ? program.code === '202900206'
      ? 'SECONDARY-ALTINBAS-2025'
      : program.code === '209210052'
        ? 'SECONDARY-ANKARA-MEDIPOL-2025'
        : program.code === '203111166' || program.code === '203101284'
          ? 'SECONDARY-ISTANBUL-MEDIPOL-2025'
          : 'OSYM-2026-GUIDE'
    : null;
  const predecessorRow = override?.code ? guide2025.get(override.code) : null;
  const predecessor = override?.code
    ? {
        year: 2025,
        code: override.code,
        programName: predecessorRow?.programName
          ?? programByCode.get(override.code)?.programName
          ?? 'Tıp',
        scholarshipType: predecessorRow?.scholarshipType
          ?? programByCode.get(override.code)?.scholarship
          ?? null,
        language: predecessorRow?.language
          ?? programByCode.get(override.code)?.language
          ?? null,
        quota: predecessorRow?.quota ?? null,
        placed: predecessorRow?.placement?.placed ?? null,
        filled: predecessorRow?.placement?.filled ?? null,
        filledStatus: predecessorRow?.placement?.filled === true ? 'filled' : predecessorRow?.placement?.filled === false ? 'unfilled' : 'unknown',
        closingRank: override.closingRank,
        closingScore: predecessorRow?.placement?.minScore ?? null,
        sourceIds: ['OSYM-2025-GUIDE', 'OSYM-2025-RESULTS', predecessorSource].filter(Boolean),
      }
    : null;
  const relatedRows = (override?.relatedCodes ?? [])
    .map((code) => guide2025.get(code))
    .filter(Boolean)
    .map((row) => ({
      year: 2025,
      code: row.code,
      programName: row.programName,
      scholarshipType: row.scholarshipType,
      language: row.language,
      quota: row.quota,
      placed: row.placement?.placed ?? null,
      filled: row.placement?.filled ?? null,
      filledStatus: row.placement?.filled === true ? 'filled' : row.placement?.filled === false ? 'unfilled' : 'unknown',
      closingRank: null,
      closingScore: row.placement?.minScore ?? null,
      sourceIds: ['OSYM-2025-GUIDE', 'OSYM-2025-RESULTS'],
    }));
  const history = {
    status,
    confidence,
    exactCodeRows: exactRows,
    comparablePredecessor: predecessor,
    olderRows: relatedRows,
    transformationNote: override?.transformation ?? '2026 kodu 2025’te aynı program, dil ve burs kategorisiyle aktiftir.',
    explanation: override?.note ?? (
      exactRows[0]?.filled === false
        ? `Aynı kod 2025’te ${exactRows[0].placed}/${exactRows[0].quota} doldu; resmî kapanış sırası oluşmadı.`
        : '2026 programı için aynı kodlu 2025 satırı doğrudan tarihsel eşleşmedir.'
    ),
  };
  const rank = predecessor?.closingRank ?? program.closingRank2025;
  const exact2025 = exactRows.find((row) => row.year === 2025);
  const base = override?.assessment ?? baseAssessment(rank, exact2025, program, status);
  const optimisticDelta = (
    override?.transformation?.includes('→ ücretli')
    || (exact2025?.quota != null && program.quota2026 > exact2025.quota)
  ) ? -1 : 0;
  const pessimisticDelta = (
    override?.transformation?.includes('→ %50')
    || status === 'genuinely_new'
    || status === 'analogous_program_only'
  ) ? 1 : (base === 'borderline' ? 1 : 0);
  const reason = assessmentReason(program, history, rank);
  const placementAssessment = {
    candidateRank: 26000,
    band: base,
    reason,
    optimistic: {
      band: moveBand(base, optimisticDelta),
      reason: optimisticDelta < 0
        ? 'Daha yüksek kontenjan veya daha az sübvansiyonlu kategori talebi aday lehine azaltırsa.'
        : '2025 talep düzeni ve 2026 kontenjanı büyük ölçüde korunursa.',
    },
    base: {
      band: base,
      reason,
    },
    pessimistic: {
      band: moveBand(base, pessimisticDelta),
      reason: pessimisticDelta > 0
        ? 'Daha cazip burs/dil yapısı, düşük ücret veya yeni-program ilgisi talebi yükseltirse.'
        : 'Şehir ve tıp talebi güçlenip kapanış adaya karşı birkaç bin sıra öne gelirse.',
    },
  };
  return {
    code: program.code,
    currentProgram: {
      code: program.code,
      university: program.university,
      faculty: current?.faculty ?? (
        program.university.includes('Uluslararası Tıp Fakültesi')
          ? 'Uluslararası Tıp Fakültesi'
          : 'Tıp Fakültesi'
      ),
      programName: program.programName,
      language: program.language,
      scholarshipType: program.scholarship,
      quota: program.quota2026,
      specialConditions: current?.specialConditions ?? [],
    },
    history,
    placementAssessment,
    tuition: tuitionFor(program),
    evidenceIds: [...new Set([
      'OSYM-2026-GUIDE',
      ...exactRows.flatMap((row) => row.sourceIds),
      ...(predecessor?.sourceIds ?? []),
    ])],
  };
});

function categoryMigrations() {
  const years = {
    2023: audit.guides['2023'].filter((row) => row.code.startsWith('2')),
    2024: audit.guides['2024'].filter((row) => row.code.startsWith('2')),
    2025: audit.guides['2025'].filter((row) => row.code.startsWith('2')),
    2026: audit.current2026.filter((row) => row.universityType === 'VAKIF'),
  };
  const pairs = [[2023, 2024], [2024, 2025], [2025, 2026]];
  const result = [];
  for (const [fromYear, toYear] of pairs) {
    const from = years[fromYear];
    const to = years[toYear];
    const key = (row) => `${row.university}|${row.language}`;
    const keys = new Set([...from.map(key), ...to.map(key)]);
    for (const poolKey of keys) {
      const fromRows = from.filter((row) => key(row) === poolKey);
      const toRows = to.filter((row) => key(row) === poolKey);
      if (!fromRows.length || !toRows.length) continue;
      const set = (rows) => rows.map((row) => row.scholarshipType).sort().join(',');
      if (set(fromRows) === set(toRows)) continue;
      result.push({
        fromYear,
        toYear,
        university: fromRows[0].university,
        language: fromRows[0].language,
        fromPrograms: fromRows.map((row) => ({
          code: row.code,
          scholarshipType: row.scholarshipType,
          quota: row.quota,
        })),
        toPrograms: toRows.map((row) => ({
          code: row.code,
          scholarshipType: row.scholarshipType,
          quota: row.quota,
        })),
        sourceIds: [
          `OSYM-${fromYear}-GUIDE`,
          `OSYM-${toYear}-GUIDE`,
        ],
      });
    }
  }
  return result;
}

const currentAudit = lineages
  .filter((entry) => entry.history.status !== 'exact_code_match')
  .map((entry) => {
    const current = entry.currentProgram;
    const prior = entry.history.comparablePredecessor;
    return {
      university: current.university,
      faculty: current.faculty,
      programLanguage: current.language,
      currentCode: current.code,
      currentStatus: current.scholarshipType,
      currentQuota: current.quota,
      predecessorYear: prior?.year ?? null,
      predecessorCode: prior?.code ?? null,
      predecessorStatus: prior?.scholarshipType ?? null,
      predecessorQuota: prior?.quota ?? null,
      predecessorClosingRank: prior?.closingRank ?? null,
      predecessorFilled: prior?.filled ?? null,
      transformation: entry.history.transformationNote,
      historyStatus: entry.history.status,
      confidence: entry.history.confidence,
      sourceIds: entry.evidenceIds,
    };
  });

writeFileSync(
  resolve(root, 'src/data/yks/lineage.json'),
  JSON.stringify(lineages, null, 2) + '\n',
);
writeFileSync(
  resolve(root, 'src/data/yks/migration-audit.json'),
  JSON.stringify({
    generatedAt: '2026-07-28',
    currentAudit,
    historicalCategoryMigrations: categoryMigrations(),
  }, null, 2) + '\n',
);

const assessmentCounts = Object.fromEntries(
  bandOrder.map((band) => [
    band,
    lineages.filter((row) => row.placementAssessment.band === band).length,
  ]),
);
const historyCounts = Object.fromEntries(
  [
    'exact_code_match',
    'comparable_predecessor',
    'older_reopened_history',
    'analogous_program_only',
    'genuinely_new',
    'no_reliable_history',
  ].map((status) => [
    status,
    lineages.filter((row) => row.history.status === status).length,
  ]),
);
console.log(JSON.stringify({
  programs: lineages.length,
  assessmentCounts,
  historyCounts,
  migrations: currentAudit.length,
  historicalCategoryMigrations: categoryMigrations().length,
}, null, 2));
