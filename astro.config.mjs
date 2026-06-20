// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// User page served from root (kayisu.github.io) → no `base` needed.
// Default `output: 'static'` exports a fully static site for GitHub Pages.
export default defineConfig({
  site: 'https://kayisu.github.io',
  integrations: [react()],
});
