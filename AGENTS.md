# Project architecture

## Universe and projects

- Turkish is the default locale: `/` is the Turkish universe and `/en/` is English.
- Every project is a planet. Its frontmatter status determines its orbit: `done` and `live` are inner, `building` is middle, `parked` and `archived` are outer, and `oneshot` is a comet.
- Project content is in `src/content/projects/{tr,en}/`, with schema in `src/content.config.ts`. Do not add a stored planet/category field.
- Project skins are defined in `src/data/palettes.ts`, keyed by `translationKey`. Builds must fail clearly when a project has no palette. `src/lib/projects.ts` validates palettes and parent references.
- `/projects/<slug>/` and `/en/projects/<slug>/` are static dossiers. `/about/` and `/en/about/` are static profile pages. The universe island exists only on `/` and `/en/`.
- `src/components/universe/` owns the canvas, scene interactions, and accessible project list. Keep its total line count within the brief's limit.
- The shared shell uses the dark Rubik system. Project pages pass their palette to `BaseLayout` so the font, colors, and radius cover the page and footer.
- `src/i18n/config.ts` and `src/i18n/routes.ts` own locale defaults, route equivalents, canonicals, and hreflang paths. Legacy redirects live in `astro.config.mjs`.

## Protected areas

- Keep YKS internals unchanged: `src/pages/yks/`, `src/components/yks/`, `src/store/yksStore.ts`, `src/styles/yks.css`, `tests/`, and `scripts/yks/`.
- Keep sandbox internals unchanged: `src/components/sandbox/`, `src/lib/sandbox/`, `src/store/sandboxStore.ts`, and `src/styles/sandbox.css`.
- `zustand` remains in use by YKS and sandbox.

Every code identifier, file, folder, script and enum value is English; Turkish only in user-facing text.

## Verification

Run `npx astro check`, `npm run build`, `npm run verify:build`, and `npm run test:yks` when a task requests full verification. Do not commit changes unless the user asks.
