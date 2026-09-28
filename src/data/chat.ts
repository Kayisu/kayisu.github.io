import type { Locale } from '../i18n/config';
import { PROFILE, type ProfileLocale } from './profile';
import { SITE } from './site';

/** Scripted assistant (v2): a fixed tree built at build time from repository data only. */
export interface ChatLine { text: string; href?: string; external?: boolean }
export interface ChatOption { label: string; target: string }
export interface ChatNode { lines: ChatLine[]; options: ChatOption[] }
export interface ChatUi {
  trigger: string; title: string; close: string; bubble: string;
  options: string; inputLabel: string; placeholder: string;
}
export interface ChatScript { ui: ChatUi; nodes: Record<string, ChatNode> }

/** Collection fields the tree may quote; anything absent is simply not offered. */
export interface ChatProject {
  id: string; title: string; summary: string; statusLabel: string; href: string;
  role?: string | undefined; year?: number | undefined; demo?: string | undefined; repo?: string | undefined;
}

interface ChatCopy {
  ui: ChatUi;
  greeting: string; home: string; moreProjects: string;
  ask: { now: string; projects: string; path: string; contact: string };
  intro: { now: string; projects: string; path: string; contact: string };
  field: { status: string; role: string; year: string; aim: string; email: string; page: string; demo: string; code: string };
}

const COPY = {
  tr: {
    ui: {
      trigger: 'Asistan', title: 'Asistan', close: 'Kapat', bubble: 'buradayım',
      options: 'Seçenekler', inputLabel: 'Serbest soru', placeholder: 'Serbest soru yakında',
    },
    greeting: "Merhaba. Emre Kaan'ın çalışmaları hakkında bilgi veren bir asistanım. Ne öğrenmek istersiniz?",
    home: 'Başa dön',
    moreProjects: 'Diğer projeler',
    ask: { now: 'Şu an ne üzerinde çalışıyor?', projects: 'Projeler', path: 'Geçmişi', contact: 'İletişim' },
    intro: {
      now: "Emre Kaan'ın güncel çalışmaları:",
      projects: 'Sitede yer alan projeler aşağıdadır. Hangisi hakkında bilgi almak istersiniz?',
      path: "Emre Kaan'ın geçmişi:",
      contact: "Emre Kaan'a aşağıdaki kanallardan ulaşılabilir:",
    },
    field: { status: 'Durum', role: 'Rol', year: 'Yıl', aim: 'Hedef', email: 'E-posta', page: 'Proje sayfası', demo: 'Demo', code: 'Kaynak kod' },
  },
  en: {
    ui: {
      trigger: 'Assistant', title: 'Assistant', close: 'Close', bubble: 'here',
      options: 'Options', inputLabel: 'Free question', placeholder: 'Free questions coming soon',
    },
    greeting: "Hello. I am an assistant that provides information about Emre Kaan's work. What would you like to know?",
    home: 'Back to start',
    moreProjects: 'Other projects',
    ask: { now: 'What is he working on now?', projects: 'Projects', path: 'Background', contact: 'Contact' },
    intro: {
      now: "Emre Kaan's current work:",
      projects: 'The projects on this site are listed below. Which one would you like to know about?',
      path: "Emre Kaan's background:",
      contact: 'Emre Kaan can be reached through the following channels:',
    },
    field: { status: 'Status', role: 'Role', year: 'Year', aim: 'Aim', email: 'Email', page: 'Project page', demo: 'Demo', code: 'Source code' },
  },
} as const satisfies Record<Locale, ChatCopy>;

export function buildChatScript(locale: Locale, projects: readonly ChatProject[]): ChatScript {
  const copy: ChatCopy = COPY[locale];
  const profile: ProfileLocale = PROFILE[locale];
  const home: ChatOption = { label: copy.home, target: 'root' };
  const link = (text: string, href?: string): ChatLine => (href ? { text, href } : { text });
  const external = (text: string, href: string): ChatLine => ({ text, href, external: true });
  const nodes: Record<string, ChatNode> = {
    now: {
      lines: [{ text: copy.intro.now }, ...profile.now.map((fact) => link(fact.text, fact.href))],
      options: [home],
    },
    projects: {
      lines: [{ text: copy.intro.projects }],
      options: [...projects.map((project) => ({ label: project.title, target: `project:${project.id}` })), home],
    },
    path: {
      lines: [
        { text: copy.intro.path },
        ...profile.path.map((step) => link(`${step.period} · ${step.title}${step.detail ? ` ${step.detail}` : ''}`, step.href)),
        { text: `${copy.field.aim}: ${profile.aim}` },
      ],
      options: [home],
    },
    contact: {
      lines: [
        { text: copy.intro.contact },
        { text: `${copy.field.email}: ${SITE.email}`, href: `mailto:${SITE.email}` },
        external('GitHub', SITE.github),
        external('LinkedIn', SITE.linkedin),
      ],
      options: [home],
    },
  };
  for (const project of projects) {
    nodes[`project:${project.id}`] = {
      lines: [
        { text: `${project.title}: ${project.summary}` },
        { text: `${copy.field.status}: ${project.statusLabel}.` },
        ...(project.role ? [{ text: `${copy.field.role}: ${project.role}.` }] : []),
        ...(project.year ? [{ text: `${copy.field.year}: ${project.year}.` }] : []),
        link(copy.field.page, project.href),
        ...(project.demo ? [external(copy.field.demo, project.demo)] : []),
        ...(project.repo ? [external(copy.field.code, project.repo)] : []),
      ],
      options: [{ label: copy.moreProjects, target: 'projects' }, home],
    };
  }
  const offered = (['now', 'projects', 'path', 'contact'] as const).filter((id) => nodes[id].lines.length > 1 || nodes[id].options.length > 1);
  nodes.root = { lines: [{ text: copy.greeting }], options: offered.map((id) => ({ label: copy.ask[id], target: id })) };
  return { ui: copy.ui, nodes };
}
