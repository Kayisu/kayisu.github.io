/**
 * Ligature-loss repair table for the 2026 YKS medicine report.
 *
 * The source markdown is a DOCX -> MD conversion of a PDF whose font exposed
 * ligature glyphs that the converter could not map. Every affected pair lost its
 * SECOND character: `ti`/`tı`/`tt` collapsed to `t`, and `fi`/`fl`/`ft`/`fk`
 * collapsed to `f`. The loss is not reversible by regex (nothing marks where a
 * character was dropped), so every repair below is an explicit token rule
 * derived by auditing the document's full 1.732-token vocabulary.
 *
 * Digits are unaffected by the loss, so program codes, ranks, quotas and tuition
 * figures are intact and are never touched by these rules.
 */

/** Prose tokens. Applied with word boundaries, longest-first. */
export const PROSE_REPAIRS = {
  // Institution and place names
  Kafas: 'Kafkas',
  kafas: 'kafkas',
  Hitt: 'Hitit',
  İstnye: 'İstinye',
  istnye: 'istinye',
  Atlım: 'Atılım',
  Altnbaş: 'Altınbaş',
  Tnaztepe: 'Tınaztepe',
  Hacetepe: 'Hacettepe',
  Necmetn: 'Necmettin',
  Katp: 'Kâtip',
  Lefoşa: 'Lefkoşa',
  Nightngale: 'Nightingale',
  İhtsas: 'İhtisas',
  ihtsas: 'ihtisas',

  // Common vocabulary
  öğretm: 'öğretim',
  eğitm: 'eğitim',
  Eğitm: 'Eğitim',
  eğitmi: 'eğitimi',
  araştrma: 'araştırma',
  Araştrma: 'Araştırma',
  garant: 'garanti',
  garantsi: 'garantisi',
  ihtmal: 'ihtimal',
  ihtmali: 'ihtimali',
  ihtyaç: 'ihtiyaç',
  İhtyaç: 'İhtiyaç',
  Etket: 'Etiket',
  statk: 'statik',
  kritk: 'kritik',
  pratk: 'pratik',
  metnde: 'metinde',
  itbaren: 'itibaren',
  alternatf: 'alternatif',
  Alternatf: 'Alternatif',
  ayrınt: 'ayrıntı',
  afliye: 'afiliye',
  çif: 'çift',
  Çif: 'Çift',
  fyat: 'fiyat',
  fnansmanı: 'finansmanı',
  muafyet: 'muafiyet',
  istsnası: 'istisnası',
  istatstk: 'istatistik',
  belirtlmiyor: 'belirtilmiyor',
  bağlantsı: 'bağlantısı',
  sıkılaştrabilir: 'sıkılaştırabilir',
  kapatr: 'kapatır',
  coğraf: 'coğrafi',
  Bat: 'Batı',
  altya: 'altıya',
  Kayıtan: 'Kayıttan',
  tarafnda: 'tarafında',
  tarafndan: 'tarafından',
  satr: 'satır',
  satrında: 'satırında',
  satrındaki: 'satırındaki',
  satrlarda: 'satırlarda',
  satrları: 'satırları',
  sınıfa: 'sınıfta',
  sınıfan: 'sınıftan',
  sınıfar: 'sınıflar',
  sınıfarda: 'sınıflarda',
  sınıfn: 'sınıfın',
  sınıfnda: 'sınıfında',
  Sınıfnda: 'Sınıfında',
  ücretn: 'ücretin',
  ücretnden: 'ücretinden',
  ücretnin: 'ücretinin',
};

/**
 * `tp` is ambiguous: prose means `tıp` (medicine), URLs mean the ASCII `tip`.
 * Handled as a dedicated rule because the replacement depends on context.
 */
export const PROSE_TP = { from: 'tp', to: 'tıp' };

/** ASCII tokens that only ever appear inside URLs. */
export const URL_REPAIRS = {
  htps: 'https',
  tp: 'tip',
  tpfakultesi: 'tipfakultesi',
  egitm: 'egitim',
  egitme: 'egitime',
  yuksekogretm: 'yuksekogretim',
  yuksekihtsasuniversitesi: 'yuksekihtisasuniversitesi',
  atlim: 'atilim',
  Atlim: 'Atilim',
  altnbas: 'altinbas',
  tnaztepe: 'tinaztepe',
  kafas: 'kafkas',
  istnye: 'istinye',
  frsatlari: 'firsatlari',
  tanitm: 'tanitim',
  tanitmi: 'tanitimi',
  tanıtm: 'tanıtım',
  katl: 'katil',
  katlimla: 'katilimla',
  gerceklestrildi: 'gerceklestirildi',
  istatstk: 'istatistik',
};

/**
 * URLs whose path segments were also damaged by PDF line-wrapping, which joined
 * two words without their separating hyphen. Unlike ligature loss this is not
 * deterministically reversible, so these are surfaced as unverified rather than
 * guessed: the page renders them as plain text with a "link doğrulanmadı" note.
 */
export const AMBIGUOUS_URL_MARKERS = [
  'kilavuzununyayimlanmasi',
  'torenlehizmete',
  'uluslararasisaglik',
  'ucretlerburslar',
];
