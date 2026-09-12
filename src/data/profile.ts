import type { Locale } from '../i18n/config';
import { projectPath, type AbsolutePath } from '../i18n/routes';

export interface ProfileFact {
  text: string;
  href?: AbsolutePath;
}

export interface ProfileMilestone {
  period: string;
  title: string;
  detail?: string;
  href?: AbsolutePath;
}

export interface ProfileLocale {
  statement: string;
  now: readonly ProfileFact[];
  path: readonly ProfileMilestone[];
  aim: string;
}

export const PROFILE = {
  en: {
    statement: '[[KAAN]]',
    now: [
      { text: 'Full-time founder candidate in the Sera Incubation Programme, Erciyes Teknopark (2026).' },
      {
        text: 'Building EcoReport (sustainability reporting).',
        href: projectPath('en', 'ecoreport'),
      },
      {
        text: 'Building SoruDepo (question bank for teachers).',
        href: projectPath('en', 'sorudepo'),
      },
    ],
    path: [
      {
        period: '2026',
        title: 'EcoReport accepted to stage 1 of TÜBİTAK BİGG.',
        href: projectPath('en', 'ecoreport'),
      },
      { period: '2026', title: 'Joined the Sera Incubation Programme.' },
      {
        period: '2026',
        title: 'B.Sc. Computer Engineering, Kayseri University.',
        detail: 'Senior thesis: CogniSpace.',
        href: projectPath('en', 'cognispace'),
      },
    ],
    aim: "Preparing for a master's degree in human–computer interaction.",
  },
  tr: {
    statement: '[[KAAN]]',
    now: [
      { text: "Erciyes Teknopark Sera Kuluçka Programı'nda tam zamanlı girişimci adayı (2026)." },
      {
        text: 'EcoReport (sürdürülebilirlik raporlama) üzerinde çalışıyor.',
        href: projectPath('tr', 'ecoreport'),
      },
      {
        text: 'SoruDepo (öğretmenler için soru deposu) üzerinde çalışıyor.',
        href: projectPath('tr', 'sorudepo'),
      },
    ],
    path: [
      {
        period: '2026',
        title: 'EcoReport TÜBİTAK BİGG 1. aşamaya kabul edildi.',
        href: projectPath('tr', 'ecoreport'),
      },
      { period: '2026', title: "Sera Kuluçka Programı'na katıldı." },
      {
        period: '2026',
        title: 'Kayseri Üniversitesi Bilgisayar Mühendisliği lisans.',
        detail: 'Bitirme projesi: CogniSpace.',
        href: projectPath('tr', 'cognispace'),
      },
    ],
    aim: 'İnsan-bilgisayar etkileşimi alanında yüksek lisansa hazırlanıyor.',
  },
} as const satisfies Record<Locale, ProfileLocale>;
