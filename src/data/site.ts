/** Repository-backed identity and public contact details used across the site. */
export const SITE = {
  name: 'Emre Kaan Ataş',
  shortName: 'Kayisu',
  url: 'https://kayisu.github.io',
  email: 'emre-atas-01@hotmail.com',
  github: 'https://github.com/Kayisu/',
  linkedin: 'https://www.linkedin.com/in/emrekaanatas/',
} as const;

export type SiteConfig = typeof SITE;
