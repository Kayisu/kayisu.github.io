# Kendince

Standalone outfit workshop at https://kayisu.github.io/kendince/. Runtime files are in `public/kendince/` and Astro copies them unchanged into `dist/kendince/`. The canonical URL and document base use `/kendince/`; ES module files use `.js`. No server, AI, external runtime dependency, or framework island is required.

The catalog contains 36 first-party Mavi and LCW product page links and dated 2026-10-14 price observations. Prices and size stock are snapshots; shipping, coupons, and store campaigns are excluded. Images use their first-party product CDN URLs; fonts use Google Fonts. The application and product catalog are hosted in this repository. Each product retains source-image URLs.

Profile, wardrobe, saved outfits, taste feedback, and manual prices are stored only in browser localStorage (`kendince-v1`). No private user records are included in this repository. Storage on the original Sites domain does not automatically transfer to this GitHub Pages origin.

Rule-based pairing uses category, color, fit, occasion, weather, optional upper-size stock, and budget. Explicit feedback updates five preference axes. Custom wardrobe items participate at zero new spending. No market-wide cheapest-price or exact body-fit claim is made.

The static logic was verified through 48 budget/weather/style scenarios plus headless application-flow checks before transfer. GitHub Actions runs Astro/TypeScript checks, the full portfolio build, static route verification, and Pages deployment.
