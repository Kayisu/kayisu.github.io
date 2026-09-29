import type { Dictionary } from '../types';

export const tr = {
  locale: 'tr',
  metadata: {
    landingTitle: 'Emre Kaan Ataş | Evren',
    landingDescription: 'Emre Kaan Ataş’ın projeleri.',
    aboutTitle: 'Emre Kaan Ataş | Hakkımda',
  },
  language: { switchTo: 'İngilizceye geç', shortTarget: 'EN' },
  nav: { about: 'Hakkımda' },
  project: {
    back: 'evren',
    what: 'ne',
    role: 'rol',
    year: 'yıl',
    links: 'bağ',
    demo: 'demo',
    code: 'kod',
    construction: 'yapım aşamasında',
  },
  profile: { now: 'Şimdi', path: 'Yol', aim: 'Amaç' },
  status: {
    done: 'tamamlandı',
    live: 'yayında',
    building: 'yapımda',
    parked: 'park',
    archived: 'arşiv',
    oneshot: 'tek atış',
  },
  accessibility: {
    projectList: 'Proje listesi',
    orbitInner: 'İç yörünge',
    orbitMiddle: 'Orta yörünge',
    orbitOuter: 'Dış yörünge',
    orbitComet: 'Kuyruklu yıldızlar',
    externalLink: 'Yeni sekmede açılır',
  },
  toy: { label: 'Oyuncak şantiye: kum alanında bir buldozer', hint: 'WASD / oklar ya da dokun: sür · çift dokun: kum yığ', reset: 'Düzle' },
  notFound: { message: 'Sayfa bulunamadı.', home: 'Ana sayfa' },
  contact: { email: 'E-posta', github: 'GitHub', linkedin: 'LinkedIn' },
} satisfies Dictionary;
