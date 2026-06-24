# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio for Emre Kaan Ataş, deployed as a GitHub Pages **user site**
(`kayisu.github.io`, served from root). It's an **Astro** static site whose
centerpiece is an interactive **React Three Fiber** solar system where the Sun +
9 bodies orbit and clicking one opens an info panel and zooms the camera. Static
content (profile, planet detail pages) ships **zero framework JS**; only the
solar-system island loads React + Three.js.

## Commands

```bash
npm install        # install deps
npm run dev        # dev server (http://localhost:4321)
npm run build      # static build to dist/
npm run preview    # serve the built dist/ locally
npx astro check    # type-check .astro/.tsx
```

There is no test suite. Deployment is automatic: pushing to `main` triggers
`.github/workflows/deploy.yml` (withastro/action → deploy-pages). The repo's
**Pages source must be set to "GitHub Actions"** in Settings → Pages (one-time,
done in the GitHub UI, not in code).

## Architecture

### The island boundary (this is the whole point of the Astro choice)
- `src/pages/index.astro` renders a static `ProfileCard.astro` plus
  `<SolarApp client:only="react" />`. **`client:only` is required** — the scene
  is WebGL and cannot be server-rendered. Everything interactive lives inside
  that one island; everything else is static HTML.
- The detail pages (`src/pages/planet/[name].astro`, `src/pages/star/sun.astro`,
  `src/pages/404.astro`) are pure static — **never** import the R3F components
  into them or you'll ship Three.js on pages that don't need it.

### Single source of truth
- `src/data/planets.ts` holds every body (`SUN`, `PLANETS`, `BODIES`) with
  radius/distance/color/texture/type/desc/href, plus `orbitalSpeed(distance)`
  (Kepler approximation `1/sqrt(distance)*0.015`) and `getBody(name)`. The scene,
  the info panel, the search box, and `getStaticPaths` for the per-planet pages
  all read from here. Add or change a body in this one file.
- The bodies are an **identity map**, not astronomy: each body's `type` is its
  **category label** (Core, Tools, Creative, Roots, Research, Ventures, Systems,
  Lab, Mind, Archive) and `desc` is its **identity tagline**. These two content
  fields are the only ones safe to edit — radius/distance/color/texture/name/
  hasRing/isStar are load-bearing for the R3F scene.

### Content model (projects)
- Projects live as plain markdown in `src/content/projects/*.md`, loaded by a
  `projects` content collection (Astro Content Layer `glob` loader) defined in
  `src/content.config.ts`. The collection is the easy-to-extend core: **adding a
  project = dropping one markdown file — no code changes.**
- Each file's frontmatter `planet` field assigns its **category** (which body it
  shows up under); the markdown body is the full write-up. Schema fields: `title`,
  `planet`, `summary` (required); `status`, `year`, `tags`, `role`, `repo`,
  `demo`, `featured` (optional).
- `BodyDetail.astro` queries the collection, filters by the current body's name,
  and renders project cards (sorted featured → year desc → title), or a tasteful
  empty state when a category has none. `src/pages/projects/[...slug].astro`
  renders each project as its own static page from the markdown body.
- The Sun (`/star/sun`) is the **Core / about-me** page — static prose, **not**
  project-driven (it never lists projects).

### Shared state
- `src/store/solarStore.ts` (zustand) is the bridge between the WebGL canvas and
  the DOM overlay UI (they're in one React tree but don't prop-drill):
  `speedMultiplier`, `selected` (info panel), `followTarget` + `isAnimating`
  (camera). `select(name)` opens the panel and starts the zoom; `close()` clears
  both. **In `useFrame`, read the store via `useSolarStore.getState()`** (not the
  hook) so per-frame reads don't trigger React re-renders.

### Solar-system components (`src/components/solar/`)
- `SolarApp.tsx` — island root: `<Canvas>` + `CameraRig` + the DOM overlay
  (`SimControls`, `InfoPanel`).
- `Scene.tsx` — lights + a tilted, slowly-spinning "universe" `<group>` holding
  `Stars`, `Sun`, and a `Planet` per entry in `PLANETS`.
- `Planet.tsx` — orbit `<group>` (revolves) wrapping the mesh (spins); faint
  orbit-line; optional Saturn ring. Each mesh gets `name={body.name}`.
- `CameraRig.tsx` — drei `OrbitControls` (`makeDefault`) + smooth follow/zoom +
  WASD, ported from the original `animate()` loop. It locates the focused body
  with `scene.getObjectByName(followTarget)` — **that name tag is load-bearing**;
  removing `name` from a mesh breaks camera follow.
- `Stars.tsx` — shader-based twinkling starfield (shaders copied verbatim from
  the pre-migration `script.js`).

### Routing
- Per-body pages are real pre-rendered static routes (`getStaticPaths` over
  `PLANETS`). Deep links and refresh work natively — there is **no** SPA redirect
  hack (the old `404.html`/`index.html` redirects were deleted in the migration).
  `InfoPanel`'s "Explore" is a plain `<a href={body.href}>`.

### Gotchas
- TSX uses `className`; `.astro` files use `class`. Don't mix them up.
- `astro.config.mjs` sets `site` but no `base` (user page at root). If this ever
  becomes a project page, a `base` would be needed and all root-absolute paths
  (`/textures/...`, `href="/"`) would have to account for it.
- Textures live in `public/textures/` and are referenced as `/textures/*.jpg`.
