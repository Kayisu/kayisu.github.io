# Sandstruction

**Sayfa yapılıyor. Sen de bir şeyler yap.**

Version **0.4.0**. A browser construction sandbox and a playable destination for unfinished or missing portfolio pages.

Serve `dist/` with a static HTTP server. No build or install required. Three.js r160 is vendored under MIT. Run `npm test` for terrain conservation, driving/collision, save migration, model geometry and entrypoint checks.

## Curved surfaces and blade width in 0.4

The 256-cell simulation now drives a separate GPU-rendered cubic B-spline surface. Geometry and material colors are reconstructed continuously; the default desktop display uses 768 subdivisions, while 512 and 1024 are available from the Surface control. Height and analytic slope use the same reconstruction on CPU and GPU, keeping wheels and tools aligned with the visible terrain. Render subdivision changes do not resample or modify the saved simulation. A CPU compatibility path remains for devices without float vertex textures.

The dozer blade can be adjusted from 1.2 to 6.0 metres using U/I or its buttons. Visible blade panels, the rectangular guide, excavation/grading footprints, obstacle checks and saved state use the same width. Tool edges are feathered to avoid hard cut stamps. Wheels and the visual grains have rounder geometry.

## Material flow in 0.3

The surface is now 256 × 256 cells (37.5 cm spacing, 66,049 vertices). Loose material relaxes down slopes without changing bulk volume. Asphalt is laid with uneven aggregate thickness; roller passes reduce height variation and increase compaction. The dozer captures a fixed blade datum at the beginning of a stroke; J/K and on-screen buttons adjust blade height, and a rectangular guide shows the footprint. A 2,000-instance visual grain pool replaces cube chips. Smooth vertex normals, fine bump texture, feathered material colors and interpolated mesh updates reduce faceting and stepping. Tightly bounded updates avoid running granular relaxation over the whole map. The visible grains are tracers; mass lives in the conservative heightfield and loose-layer channels.

Dense saves use binary-encoded typed arrays and migrate the previous 112-cell worlds.

## Controls

WASD/arrows: drive. Space: work. 1–6/Tab: change machine. X: dig/unload or push/grade. J/K: lower/raise dozer blade. U/I: narrower/wider blade. R: sandbox refill. Shift: brake. Z: undo the last continuous tool stroke (eight retained). Q/E or right drag: orbit. Wheel or +/−: zoom. C: camera behind machine. M: overhead. G: grid. H: help.

## Included

Six tools: dump truck, loader, dozer, roller, asphalt paver and hand shovel. Finite cargo, sand/gravel/earth selection and unlimited sandbox refills. Excavation, transport, directional pushing, grading, compaction and wide asphalt ribbons. Acceleration, reverse, braking, surface traction and simple vehicle/rock/container collisions. Animated wheels, damped terrain following, tire tracks and eight-stroke undo. Procedural terrain grain, instanced vegetation, fleet markings, construction signage and three lighting moods. Seeded world generation, minimap and local save/resume.

## Hosting and fallbacks

Public route: https://kayisu.github.io/sandstruction/

The old `/planet/earth/games/sandbox/` route redirects to the new game. Arrival parameters `reason=404`, `reason=wip` or `reason=unreachable` select the welcome copy. Optional `from` is rendered as plain text. Portfolio 404, explicit WIP/unreachable entries and WIP projects redirect to the game; empty categories offer a link. A server outage cannot be intercepted when the site itself cannot load.

v0.1–v0.3 saves migrate on the same origin. Sites and GitHub Pages are different origins and therefore keep separate browser saves.

## Simulation boundaries

Original prototype; no commercial assets or game binaries were used. Terrain is a heightfield with a dominant surface material, not discrete grains or full strata. Mixed bucket contents use one dominant material. Collision bodies are circles, not full rigid bodies. Some scenery is decorative. Water is visual with no fluid simulation. Excavation floor: −3 m. Mission mode and an autonomous delivery vehicle are deferred.

# Changelog

## 0.4.0 — 2026-10-18

Separated the display mesh from the simulation using GPU cubic B-spline height and color reconstruction, analytic surface normals, 512/768/1024 display detail and matching CPU terrain queries. Added 1.2–6.0 m blade width controls (U/I and buttons), blade/guide/footprint/obstacle integration, feathered blade edges and saved width. Increased wheel and grain curvature. Preserved existing worlds.

## 0.3.0 — 2026-10-18

Rebuilt material handling around a denser smooth heightfield and conservative loose-material flow. Asphalt starts uneven and becomes smoother through roller passes. Added a fixed dozer blade datum, J/K height control and a rectangular footprint. Expanded round visual grains from 160 to 2,000, added interpolated surface updates, analytic smooth normals and compaction-sensitive bump detail. Preserved v0.1/v0.2 worlds through resolution migration and packed browser saves. Added material-flow, roughness, volume, migration and interpolation checks.

## 0.2.0 — 2026-10-18

Renamed to Sandstruction. Added directional dozer pushing and grading, asphalt ribbons, acceleration/braking, vehicle/scenery collision, animated wheels, tire tracks, eight-stroke undo, stockpiles, camera recovery, surface grain, instanced vegetation, three lighting moods, signage and reason-aware 404/WIP/unreachable arrival copy. Legacy saves migrate on the same origin.

## 0.1.0 — 2026-10-18

First playable sandbox: terrain generation, six machines/tools, material deposition/excavation, grading, compaction, asphalt, minimap, orbit camera and local persistence. Mission mode is not included in this version.
