# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio site for Emre Kaan Ataş, deployed as a GitHub Pages **user site** (`Kayisu.github.io`, served from the `main` branch root). The centerpiece is an interactive Three.js solar system. There is **no build step, no package manager, and no test suite** — files are served exactly as they sit in the repo root.

## Running locally

Open `index.html` with any static file server (the History API routing and ES module imports require `http://`, not `file://`):

```bash
python -m http.server 8000   # then visit http://localhost:8000
```

Three.js is loaded from the unpkg CDN via the `<script type="importmap">` in `index.html` (pinned to `three@0.160.0`); there are no local `node_modules`. Deploys happen automatically on push to `main`.

## Architecture

Three files do all the work:

- **`index.html`** — markup, the Three.js import map, and all UI panels (`#planet-info-panel`, `#planet-detail-view`, `.sim-controls`, profile card). UI elements are static in the DOM and toggled via the `.hidden` class from `script.js`.
- **`script.js`** — the entire application (ES module). Scene setup → planet creation → animation loop → routing → event wiring, top to bottom.
- **`style.css`** — all styling, including mobile responsiveness.

### Solar system model (`script.js`)

- `createPlanet(name, radius, distance, colorHex, textureUrl, type, desc, hasRing)` builds each body. Each planet mesh lives inside its own `THREE.Group` (`orbitGroup`); orbiting is done by rotating the group, axial spin by rotating the mesh. Orbital speed is derived from distance via a Kepler's-Third-Law approximation (`1/sqrt(distance) * 0.015`), not hardcoded.
- The 9 bodies (Mercury→Pluto) plus the Sun are registered in two arrays: `planets` (orbit/animation data) and `interactables` (everything raycastable). The Sun is added to `interactables` separately.
- `userData = { name, type, desc }` on each mesh is the single source of truth for the info panels and search — read it rather than duplicating planet data elsewhere.
- Textures are local under `./textures/` (one `.jpg` per body). Planets with a texture use `MeshBasicMaterial` (fully lit, no shading); the color fallback path uses `MeshStandardMaterial`. Background stars are a custom `ShaderMaterial` point cloud with a twinkle effect driven by a `time` uniform updated each frame.

### Camera & navigation

The animation loop (`animate()`) blends three control schemes that must coexist:
- **OrbitControls** with damping (`controls.update()` every frame).
- **Smooth follow/zoom**: `cameraFollowTarget` + `isCameraAnimating` drive a lerp toward a moving planet's world position. `smoothZoomTo(name)` starts it; clicking the panel close button clears it. Because planets move, the camera re-reads the world position each frame via `getPlanetWorldPos()`, which calls `scene.updateMatrixWorld(true)` before reading.
- **WASD** translation, applied only when `!isCameraAnimating`. Keyboard capture is suppressed while the search input is focused.

### Routing (the tricky part)

Client-side routing uses the History API (`/planet/<name>`, `/star/sun`) handled by `handleRoute()`/`navigateTo()`. Two redirect mechanisms keep GitHub Pages happy but currently **force a return to root on any deep link or refresh**:

- `404.html` is the rafgraph SPA hack — GitHub Pages serves it for unknown paths, and it re-encodes the path into a `/?/...` query and bounces to root.
- The inline script at the top of `index.html` then detects either that `/?/` query **or** a direct sub-path load and calls `window.location.replace('/')`.

Net effect: deep links and refreshes land on the homepage, not the requested planet. The in-session `pushState` navigation (clicking Explore) works within a single page load. If you intend deep links to actually restore a planet view, both redirects above need to change — don't assume the routing is simply broken.

### UI behavior

- Profile card (`#main-content`) auto-hides after 2s of mouse inactivity (`resetHideTimer`), with a manual lock toggle (`isProfileLockedHidden`).
- Click handlers raycast against `interactables` but bail early when the click originated inside a UI panel (the `event.target.closest(...)` guards) — preserve these guards when adding click logic, or UI clicks will trigger planet selection.
- Speed control buttons set `globalSpeedMultiplier` (0/1/5/20), which scales every per-frame rotation.
