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
  '/planet/earth/games/': '/sandstruction/',
  '/planet/earth/games/sandbox/': '/sandstruction/',
  '/tr/planet/earth/games/': '/sandstruction/',
};

const oldPlanets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
for (const planet of oldPlanets) {
  legacyRedirects[`/planet/${planet}/`] = '/en/';
  legacyRedirects[`/tr/planet/${planet}/`] = '/';
}

const projectSlugs = ['cognispace', 'ecoreport', 'sorudepo', 'yks-tercih-sihirbazi'];
for (const slug of projectSlugs) legacyRedirects[`/tr/projects/${slug}/`] = `/projects/${slug}/`;
// Sandcastle Sandbox was renamed Sandstruction.
legacyRedirects['/tr/projects/sandcastle-sandbox/'] = '/projects/sandstruction/';
legacyRedirects['/projects/sandcastle-sandbox/'] = '/projects/sandstruction/';
legacyRedirects['/en/projects/sandcastle-sandbox/'] = '/en/projects/sandstruction/';

// User page served from root (kayisu.github.io) → no `base` needed.
// Default `output: 'static'` exports a fully static site for GitHub Pages.
export default defineConfig({
  site: 'https://kayisu.github.io',
  integrations: [react()],
  redirects: legacyRedirects,
  // Pre-bundle the client:only scene deps at dev start; discovering them at runtime
  // re-optimises mid-session and leaves open pages with two React copies.
  vite: {
    optimizeDeps: {
      include: ['react', 'react-dom/client', 'three', '@react-three/fiber', '@react-three/drei'],
    },
  },
});
