# Sandstruction

**Sayfa yapılıyor. Sen de bir şeyler yap.**

Version **0.2.0**. A browser construction sandbox and a playable destination for unfinished or missing portfolio pages.

Serve `dist/` with a static HTTP server. No build or install required. Three.js r160 is vendored under MIT. Run `npm test` for terrain conservation, driving/collision, save migration, model geometry and entrypoint checks.

## Controls

WASD/arrows: drive. Space: work. 1–6/Tab: change machine. X: dig/unload or push/grade. R: sandbox refill. Shift: brake. Z: undo the last continuous tool stroke (eight retained). Q/E or right drag: orbit. Wheel or +/−: zoom. C: camera behind machine. M: overhead. G: grid. H: help.

## Included

Six tools: dump truck, loader, dozer, roller, asphalt paver and hand shovel. Finite cargo, sand/gravel/earth selection and unlimited sandbox refills. Excavation, transport, directional pushing, grading, compaction and wide asphalt ribbons. Acceleration, reverse, braking, surface traction and simple vehicle/rock/container collisions. Animated wheels, damped terrain following, tire tracks and eight-stroke undo. Procedural terrain grain, instanced vegetation, fleet markings, construction signage and three lighting moods. Seeded world generation, minimap and local save/resume.

## Hosting and fallbacks

Public route: https://kayisu.github.io/sandstruction/

The old `/planet/earth/games/sandbox/` route redirects to the new game. Arrival parameters `reason=404`, `reason=wip` or `reason=unreachable` select the welcome copy. Optional `from` is rendered as plain text. Portfolio 404, explicit WIP/unreachable entries and WIP projects redirect to the game; empty categories offer a link. A server outage cannot be intercepted when the site itself cannot load.

v0.1 saves migrate on the same origin. Sites and GitHub Pages are different origins and therefore keep separate browser saves.

## Simulation boundaries

Original prototype; no commercial assets or game binaries were used. Terrain is a heightfield with a dominant surface material, not discrete grains or full strata. Mixed bucket contents use one dominant material. Collision bodies are circles, not full rigid bodies. Some scenery is decorative. Water is visual with no fluid simulation. Excavation floor: −3 m. Mission mode and an autonomous delivery vehicle are deferred.

# Changelog

## 0.2.0 — 2026-10-18

Renamed to Sandstruction. Added directional dozer pushing and grading, asphalt ribbons, acceleration/braking, vehicle/scenery collision, animated wheels, tire tracks, eight-stroke undo, stockpiles, camera recovery, surface grain, instanced vegetation, three lighting moods, signage and reason-aware 404/WIP/unreachable arrival copy. Legacy saves migrate on the same origin.

## 0.1.0 — 2026-10-18

First playable sandbox: terrain generation, six machines/tools, material deposition/excavation, grading, compaction, asphalt, minimap, orbit camera and local persistence. Mission mode is not included in this version.
