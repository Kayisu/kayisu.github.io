# Repository guidance

## What this is

An Astro static portfolio for Emre Kaan Ataş, deployed as the GitHub Pages user site `kayisu.github.io`. The home page is a dark, interactive universe: each planet is a project and its orbit is derived from project status. Turkish is the default locale.

## Commands

```bash
npm run dev
npx astro check
npm run build
npm run verify:build
npm run test:yks
```

Deployment is handled by `.github/workflows/deploy.yml`; GitHub Pages must use the GitHub Actions source.

## Architecture

### Universe island

- `/` and `/en/` render the `UniverseApp` React Three Fiber island with `client:only="react"`. The canvas is decorative and interactive; the grouped project links remain keyboard accessible, and the page includes a visible no-script and canvas-error fallback.
- A project is a planet. Status determines its orbit: `done` and `live` are inner, `building` is middle, `parked` and `archived` are outer, and `oneshot` is a comet. Do not store an orbit or category in project frontmatter.
- `src/content/projects/{tr,en}/` is the project source. `src/content.config.ts` owns the schema and `src/lib/projects.ts` validates palette coverage and parent references.
- `src/data/palettes.ts` owns each project's colors, font, and corner radius. Every project translation key must resolve to a palette or the build fails.
- The scene receives serializable project props from the Astro page. Keep all canvas-only behavior in `src/components/universe/`; keep that directory within its line budget.

### Pages and localization

- `/` and `/en/` are the universe; `/projects/<slug>/` and `/en/projects/<slug>/` are static project dossiers; `/about/` and `/en/about/` are static profile pages.
- `/sandbox/` is the existing sandbox game page. `/yks/2026/tip-tercih/` is the standalone YKS tool. Keep their implementation directories and YKS data files isolated from universe changes.
- `src/i18n/config.ts` defines Turkish as the default with no prefix and English under `/en/`. `src/i18n/routes.ts` owns route construction, language equivalents, canonical paths, and alternate-language links.
- `src/layouts/BaseLayout.astro` owns shell metadata and typography. Project pages pass their palette to the layout so the skin covers the dossier and footer.
- Legacy URLs are generated from `redirects` in `astro.config.mjs`; keep those redirects covered by `scripts/verify-build.mjs`.

### Boundaries

- The YKS implementation is in `src/components/yks/`, `src/data/yks/`, `src/store/yksStore.ts`, `src/styles/yks.css`, `src/pages/yks/`, `tests/`, and `scripts/yks/`.
- Sandbox behavior is in `src/components/sandbox/`, `src/lib/sandbox/`, `src/store/sandboxStore.ts`, and `src/styles/sandbox.css`.
- `zustand` remains required by the YKS and sandbox stores.

Every code identifier, file, folder, script and enum value is English; Turkish only in user-facing text.

## Gotchas

- TSX uses `className`; Astro templates use `class`.
- Keep the root deployment base unset: this is a GitHub Pages user site.
- Content and metadata must remain static on project and profile pages; only the universe, YKS, and sandbox pages load React islands.
