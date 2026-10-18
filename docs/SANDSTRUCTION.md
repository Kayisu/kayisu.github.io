# Sandstruction

**Sayfa yapılıyor. Sen de bir şeyler yap.**

Version **0.6.0**. A browser construction sandbox and a playable destination for unfinished or missing portfolio pages.

Serve `dist/` with a static HTTP server. No build or install required. Three.js r160 is vendored under MIT. Run `npm test` for terrain conservation, driving/collision, save migration, model geometry and entrypoint checks.

## Desktop road workshop in 0.6

Desktop rendering keeps the continuous cubic height surface but reconstructs material identity separately: sharpened cubic coverage, rounded shoulders, world-space sand/gravel/asphalt detail and compaction-sensitive asphalt relief/colour. Height smoothing no longer implies broad material-colour blur. Desktop render resolution has an 8.4-million-pixel budget; the mobile budget and existing colour path remain unchanged.

A fresh desktop world includes a 24 m damaged practice strip. An optional two-click road plan follows an endpoint grade and measures fill, grading, asphalt coverage and finishing from actual terrain cells. Guidance never paints or repairs the terrain. Existing saves keep their worlds; draw a guide in them or deliberately choose a new field to get the workshop. Plans are optional extra save data, with old saves still accepted.

Moving strip dumping, mass-conserving plane grading and a distance-metered nominal 10 cm asphalt pass lead into roller finishing. The dozer backfills low areas and pushes remaining material ahead. The work gear limits machine speed for controlled passes. The workshop helper parks the current machine and aligns the next tool with a stake, with centre/left/right lanes for wider roads and roller passes. Cargo stays finite; R refills it. Drive the working end beyond the final stake to finish the last patch.

O selects working-end/follow/free cameras. V switches material/compaction/grade inspection. B toggles work speed; F latches the tool. Pointer orbit and Q/E select free camera. The live probe reads the actual contact area's material, target-height difference and compaction. The sandbox remains fully freeform, with six machines, blade-width adjustment and stroke undo.

Tests include the full construction sequence using vehicle physics at 30 and 60 FPS, finite-cargo refills, settling and bulk-volume conservation, plus material masks, optional plan restoration, sloped grading, tool alignment and surface picking. Shader snippets compile with the available software OpenGL compiler; a real browser/WebGL visual and performance session was unavailable. This is a heightfield workshop, not a full layered-material or rigid-body simulator.

## Touch flow in 0.5

Coarse-pointer devices (including tablets and hybrids) and viewports up to 900 CSS pixels use the touch layout. A proportional joystick drives/steers, while separate held work/brake controls accept simultaneous pointers. Optional work lock frees a thumb for the camera. Pointer capture loss releases its owning control; window blur, backgrounding, resize, panel opening and machine selection reset held/locked actions. Keyboard controls stay available.

Machine selection, full tool controls, the map and settings move into scrollable native dialogs without duplicating their state. All controls remain reachable on portrait/landscape phones and tablets, including material/refill, blade width/height, sound, lighting, saving and surface quality. Touch targets are at least 44 CSS pixels. One-finger terrain drag orbits/tilts the camera; two-finger pinch zooms. Fullscreen is offered only where supported. Visual viewport sizing and safe-area padding accommodate browser bars, the keyboard and display cutouts. The welcome and help screens explain touch controls.

Mobile defaults use 512 surface subdivisions (256 for reported low memory/core counts), a bounded render-pixel budget, 1024 shadow maps and fewer visual tracers. The curved surface reconstruction remains active at every quality. An older desktop save cannot silently impose its high graphics setting on touch. Backgrounded frames skip simulation/rendering. Existing v1–v4 world saves remain compatible; optional camera/display fields do not change the terrain format.

Validation covers pointer ownership/cancellation, simultaneous controls, pinch transitions, analog vehicle input, portrait/landscape render budgets and actual DOM event bindings in a small harness. No device browser/WebGL session was available for visual QA; physical iOS/Android/tablet testing remains necessary before claiming universal device compatibility.

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

## 0.6.0 — Desktop road workshop

- Separate crisp material coverage and procedural sand/gravel/asphalt shading from the smooth height surface.
- Closer working-end camera, follow/free modes and a higher desktop render-pixel budget.
- Optional road plans, actual grade/compaction inspection and four measured construction stages.
- A fresh-world 24 m practice strip; restored worlds are preserved.
- Distance-metered strip dumping and asphalt laying; conservative cut/backfill/push grading.
- Work-speed limits, equipment latch, tool-to-stake placement and roller lane selection.
- Desktop road workbench, contact probe and task-specific help; mobile flow retained.
- Optional saved road/camera state, with v1–v4 worlds still readable.

## 0.5.0 — Mobile flow

- Responsive touch layout for phones/tablets in portrait and landscape, with safe-area/visual-viewport sizing.
- Analog joystick; independent work/brake fingers; optional work lock with lifecycle resets.
- One-finger camera orbit/tilt and two-finger pinch zoom.
- Scrollable machine, tool, map and settings sheets; all settings remain accessible.
- Bounded mobile render budget, light surface option, lower default shadows/visual particle count.
- Touch onboarding, supported-device fullscreen and dialog-local action feedback.
- Existing v1–v4 saves remain readable.

## 0.4.0 — 2026-10-18

Separated the display mesh from the simulation using GPU cubic B-spline height and color reconstruction, analytic surface normals, 512/768/1024 display detail and matching CPU terrain queries. Added 1.2–6.0 m blade width controls (U/I and buttons), blade/guide/footprint/obstacle integration, feathered blade edges and saved width. Increased wheel and grain curvature. Preserved existing worlds.

## 0.3.0 — 2026-10-18

Rebuilt material handling around a denser smooth heightfield and conservative loose-material flow. Asphalt starts uneven and becomes smoother through roller passes. Added a fixed dozer blade datum, J/K height control and a rectangular footprint. Expanded round visual grains from 160 to 2,000, added interpolated surface updates, analytic smooth normals and compaction-sensitive bump detail. Preserved v0.1/v0.2 worlds through resolution migration and packed browser saves. Added material-flow, roughness, volume, migration and interpolation checks.

## 0.2.0 — 2026-10-18

Renamed to Sandstruction. Added directional dozer pushing and grading, asphalt ribbons, acceleration/braking, vehicle/scenery collision, animated wheels, tire tracks, eight-stroke undo, stockpiles, camera recovery, surface grain, instanced vegetation, three lighting moods, signage and reason-aware 404/WIP/unreachable arrival copy. Legacy saves migrate on the same origin.

## 0.1.0 — 2026-10-18

First playable sandbox: terrain generation, six machines/tools, material deposition/excavation, grading, compaction, asphalt, minimap, orbit camera and local persistence. Mission mode is not included in this version.
