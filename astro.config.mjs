// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

/** @type {Record<string, string>} */
const legacyRedirects = {
  '/tr/': '/',
  '/explore/': '/',
  '/tr/explore/': '/',
  '/star/sun/': '/en/about/',
  '/tr/star/sun/': '/about/',
  '/planet/earth/games/': '/sandbox/',
  '/planet/earth/games/sandbox/': '/sandbox/',
  '/tr/planet/earth/games/': '/sandbox/',
};

const oldPlanets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
for (const planet of oldPlanets) {
  legacyRedirects[`/planet/${planet}/`] = '/en/';
  legacyRedirects[`/tr/planet/${planet}/`] = '/';
}

const projectSlugs = ['cognispace', 'ecoreport', 'sorudepo', 'sandcastle-sandbox', 'yks-tercih-sihirbazi'];
for (const slug of projectSlugs) legacyRedirects[`/tr/projects/${slug}/`] = `/projects/${slug}/`;

// User page served from root (kayisu.github.io) → no `base` needed.
// Default `output: 'static'` exports a fully static site for GitHub Pages.
export default defineConfig({
  site: 'https://kayisu.github.io',
  integrations: [react()],
  redirects: legacyRedirects,
});
