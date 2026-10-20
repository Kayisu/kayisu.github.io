import * as T from "./vendor/three.module.js";
import {
  Terrain,
  N,
  SIZE,
  CELL,
  MATERIALS,
  clamp,
  random,
} from "./terrain.js?v=0.7.0";
import {
  MACHINES,
  machineModel,
  fleetIcon,
  clampBladeWidth,
} from "./models.js?v=0.7.0";
import { stepVehicle } from "./physics.js?v=0.7.0";
import { TerrainSurface } from "./terrain-render.js?v=0.7.0";
import { SmoothTerrain, SURFACE_QUALITIES } from "./smooth-terrain.js?v=0.7.0";
import { plantForest } from "./nature.js?v=0.7.0";
import { initMobileUI, MOBILE_QUERY } from "./mobile-ui.js?v=0.7.0";
import { CameraGestures, renderProfile } from "./touch-input.js?v=0.7.0";
import { RoadPlan, prepareWorkshop } from "./road-plan.js?v=0.7.0";
import { RoadGuide, intersectTerrain } from "./road-guide.js?v=0.7.0";
import {
  ROAD_WORK_SPEED,
  ROAD_FILL_DEPTH,
  ROAD_ASPHALT_DEPTH,
  ROAD_SPREAD_WIDTH,
  roadPlacement,
} from "./road-work.js?v=0.7.0";
import { solveContact, sampleDisplayMesh } from "./vehicle-contact.js?v=0.7.0";
import { TireTracks } from "./tire-tracks.js?v=0.7.0";
import { initGameShell, finishBoot } from "./game-shell.js?v=0.7.0";
const shell = initGameShell();
const gestures = new CameraGestures();
let roadPlan = null,
  roadMeasure = null,
  planning = false,
  planDraft = null;
let equipmentLatched = false,
  workGear = true,
  cameraMode = 2,
  inspectionMode = 0,
  lastRoadUI = -1;
function isMobile() {
  return mobileUI?.touch ?? touchLayout;
}
function wantsWork() {
  return (
    keys.has(" ") || mobileUI?.input.work || (!isMobile() && equipmentLatched)
  );
}
let mobileUI;
const touchLayout = matchMedia(MOBILE_QUERY).matches;
function viewportSize() {
  return {
    width: Math.max(1, Math.round(window.visualViewport?.width || innerWidth)),
    height: Math.max(
      1,
      Math.round(window.visualViewport?.height || innerHeight),
    ),
  };
}
function currentProfile() {
  return renderProfile({
    ...viewportSize(),
    dpr: devicePixelRatio,
    touch: mobileUI?.touch ?? touchLayout,
    memory: navigator.deviceMemory ?? 8,
    cores: navigator.hardwareConcurrency ?? 8,
  });
}
const initialProfile = currentProfile();
const $ = (id) => document.getElementById(id),
  keys = new Set(),
  SAVE_KEY = "sandstruction-save-v2";
const LEGACY_KEY = "zemin-sandbox-v0.1",
  undoStack = [];
let workStarted = false,
  trackDistance = 0,
  atmosphere = 0,
  obstacles = [];
let settlingClock = 0,
  terrainInitialized = false;
const tireTracks = new TireTracks(touchLayout ? 768 : 1536);
const terrainBlend = { value: 1 };
let surfaceCache;
let terrain = new Terrain(3817),
  vehicles = [],
  selected = 0,
  started = false,
  changed = true,
  dirty = true,
  working = false,
  elapsed = 0,
  stats = { moved: 0 },
  cameraAngle = 0.68,
  cameraDistance = 22,
  mapView = false,
  cameraPitch = Math.PI / 4,
  toastTimer = 0,
  lastUI = 0,
  lastMap = 0,
  sound = false,
  audioCtx,
  engine,
  engineGain,
  autoSaveElapsed = 0;
let renderer;
try {
  renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
} catch (error) {
  $("error").hidden = false;
  $("error").textContent =
    "Bu cihazda 3D görüntü başlatılamadı. WebGL destekleyen güncel bir tarayıcıda donanım hızlandırmayı açıp tekrar dene.";
  const retry = document.createElement("button");
  retry.id = "bootRetry";
  retry.textContent = "Tekrar dene";
  retry.onclick = () => location.reload();
  $("error").append(retry);
  throw error;
}
renderer.setPixelRatio(initialProfile.pixelRatio);
renderer.setSize(viewportSize().width, viewportSize().height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
$("world").appendChild(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(0xc8d8d2);
scene.fog = new T.Fog(0xc8d8d2, 90, 190);
const roadGuide = new RoadGuide(scene);
const planningLine = new T.Line(
  new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
  new T.LineBasicMaterial({ color: 0xffd46a, depthTest: false }),
);
planningLine.visible = false;
planningLine.renderOrder = 10;
planningLine.frustumCulled = false;
scene.add(planningLine);
const camera = new T.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 260);
const hemi = new T.HemisphereLight(
  0xf1f0dc,
  0x647157,
  touchLayout ? 2.3 : 1.65,
);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffedc1, 3.1);
sun.position.set(-30, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(initialProfile.shadowSize, initialProfile.shadowSize);
Object.assign(sun.shadow.camera, {
  left: -58,
  right: 58,
  top: 58,
  bottom: -58,
  near: 1,
  far: 150,
});
sun.shadow.normalBias = 0.08;
sun.shadow.bias = -0.0001;
scene.add(sun);
const terrainGeo = new T.PlaneGeometry(SIZE, SIZE, N, N);
terrainGeo.rotateX(-Math.PI / 2);
const colors = new Float32Array(terrainGeo.attributes.position.count * 3);
terrainGeo.setAttribute("color", new T.BufferAttribute(colors, 3));
const previousHeights = new Float32Array(terrainGeo.attributes.position.count);
terrainGeo.setAttribute(
  "aPreviousHeight",
  new T.BufferAttribute(previousHeights, 1),
);
terrainGeo.setAttribute(
  "aCompaction",
  new T.BufferAttribute(terrain.compact, 1),
);
const ground = new T.Mesh(
  terrainGeo,
  new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: false,
    map: groundTexture(),
    bumpMap: groundTexture(),
    bumpScale: 0.035,
  }),
);
let fallbackTrackTexture;
ground.material.onBeforeCompile = (shader) => {
  shader.uniforms.uTireTracks = { value: fallbackTrackTexture };
  shader.uniforms.uTerrainBlend = terrainBlend;
  shader.vertexShader =
    "uniform float uTerrainBlend; attribute float aPreviousHeight; attribute float aCompaction; varying float vCompaction; varying vec2 vTrackUV;\n" +
    shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\n transformed.y=mix(aPreviousHeight,position.y,uTerrainBlend); vCompaction=aCompaction; vTrackUV=(position.xz+48.0)/96.0;",
  );
  shader.fragmentShader =
    "varying float vCompaction; varying vec2 vTrackUV; uniform sampler2D uTireTracks;\n" +
    shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    "#include <color_fragment>\n diffuseColor.rgb*=1.0-texture2D(uTireTracks,vTrackUV).r*.23;",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <roughnessmap_fragment>",
    "#include <roughnessmap_fragment>\n roughnessFactor *= mix(1.0,0.68,vCompaction);",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <normal_fragment_maps>",
    T.ShaderChunk.normal_fragment_maps.replace(
      "dHdxy_fwd()",
      "dHdxy_fwd()*mix(1.0,0.12,vCompaction)",
    ),
  );
};
ground.material.customProgramCacheKey = () => "sandstruction-smooth-ground-v03";
ground.receiveShadow = true;
scene.add(ground);
const smoothGround = renderer.capabilities.floatVertexTextures
  ? new SmoothTerrain(
      terrainBlend,
      groundTexture(),
      initialProfile.segments,
      !touchLayout,
      tireTracks,
    )
  : null;
if (smoothGround) {
  ground.visible = false;
  scene.add(smoothGround.mesh);
} else {
  fallbackTrackTexture = new T.DataTexture(
    tireTracks.data,
    tireTracks.resolution,
    tireTracks.resolution,
    T.RGBAFormat,
  );
  fallbackTrackTexture.minFilter = fallbackTrackTexture.magFilter =
    T.LinearFilter;
  fallbackTrackTexture.generateMipmaps = false;
  fallbackTrackTexture.needsUpdate = true;
}

let edges;
const edgeMat = new T.MeshStandardMaterial({
  color: 0x6d7259,
  roughness: 1,
  side: T.DoubleSide,
});
const grid = new T.GridHelper(SIZE, N, 0x697456, 0x9aab85);
grid.material.transparent = true;
grid.material.opacity = 0.2;
grid.position.y = 0.9;
grid.visible = false;
scene.add(grid);
const water = new T.Mesh(
  new T.PlaneGeometry(600, 600),
  new T.MeshStandardMaterial({
    color: 0x91aca0,
    roughness: 0.55,
    metalness: 0.1,
  }),
);
water.rotation.x = -Math.PI / 2;
water.position.y = -3.5;
scene.add(water);
const scenery = new T.Group();
scene.add(scenery);
const fleet = new T.Group();
scene.add(fleet);
const ring = new T.Mesh(
  new T.RingGeometry(1.5, 1.56, 48),
  new T.MeshBasicMaterial({
    color: 0xf1d169,
    side: T.DoubleSide,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  }),
);
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
scene.add(ring);
const toolRing = new T.Mesh(
  new T.RingGeometry(1.3, 1.34, 48),
  new T.MeshBasicMaterial({
    color: 0xf4d989,
    side: T.DoubleSide,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  }),
);
toolRing.rotation.x = -Math.PI / 2;
toolRing.visible = false;
scene.add(toolRing);
const guideGeometry = new T.BufferGeometry();
guideGeometry.setAttribute(
  "position",
  new T.Float32BufferAttribute(new Float32Array(12), 3),
);
const workGuide = new T.LineLoop(
  guideGeometry,
  new T.LineBasicMaterial({
    color: 0xf2cb69,
    depthTest: false,
    transparent: true,
    opacity: 0.8,
  }),
);
workGuide.frustumCulled = false;
workGuide.renderOrder = 8;
workGuide.visible = false;
scene.add(workGuide);
function updateWorkGuide(v) {
  const active = ["dozer", "roller", "paver"].includes(v.id);
  workGuide.visible = started && active;
  if (!active) return;
  const p = toolPosition(v),
    dx = -Math.sin(v.angle),
    dz = -Math.cos(v.angle),
    width = v.id === "roller" ? 2.2 : v.id === "dozer" ? v.bladeWidth : 3.1,
    depth = v.id === "dozer" ? 0.8 : 1.2,
    attr = guideGeometry.attributes.position;
  [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].forEach(([side, forward], i) => {
    const x = p.x + (dz * side * width) / 2 + (dx * forward * depth) / 2,
      z = p.z - (dx * side * width) / 2 + (dz * forward * depth) / 2,
      y =
        v.id === "dozer"
          ? v.bladeDatum + v.bladeOffset + 0.05
          : terrain.sample(x, z) + 0.06;
    attr.setXYZ(i, x, y, z);
  });
  attr.needsUpdate = true;
  workGuide.material.color.set(v.id === "roller" ? 0xa3c38b : 0xf2cb69);
}
const dustGeo = new T.IcosahedronGeometry(0.035, 1),
  dustMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
const particleCount = touchLayout ? 1000 : 2000;
const particles = new T.InstancedMesh(dustGeo, dustMat, particleCount);
particles.instanceMatrix.setUsage(T.DynamicDrawUsage);
particles.frustumCulled = false;
scene.add(particles);
const dust = Array.from({ length: particleCount }, () => ({
  life: 0,
  x: 0,
  y: -100,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
}));
let dustCursor = 0;
const dummy = new T.Object3D();
function box(parent, x, y, z, w, h, d, color) {
  const m = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    new T.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function disposeGroup(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.dispose();
    }
  });
  group.clear();
}
function rebuildScenery() {
  disposeGroup(scenery);
  const rng = random(terrain.seed + 719);
  obstacles = [];
  plantForest(scenery, terrain, rng);
  for (let i = 0; i < 36; i++) {
    const x = (rng() - 0.5) * 92,
      z = (rng() - 0.5) * 92;
    if ((x < -19 && z > 14) || Math.abs(x) < 11) continue;
    const mesh = new T.Mesh(
      new T.DodecahedronGeometry(0.4 + rng() * 0.8, 0),
      new T.MeshStandardMaterial({ color: 0x8c9383, flatShading: true }),
    );
    mesh.position.set(x, terrain.sample(x, z) + 0.15, z);
    mesh.scale.set(1.3, 0.6, 1);
    mesh.rotation.set(rng(), rng() * 6, rng());
    mesh.castShadow = true;
    scenery.add(mesh);
    obstacles.push({ x, z, id: "rock", radius: 0.65 });
  }
  // Small equipment yard: storage containers, gravel bins and safety markers.
  box(scenery, -39, 0.5, 34, 13, 0.18, 17, 0xa6a58c);
  for (let j = 0; j < 2; j++) {
    const x = -40 + j * 5;
    obstacles.push({ x, z: 40, id: "container", radius: 2.3 });
    box(scenery, x, 1.6, 40, 4, 2.3, 4.7, j ? 0x9a714f : 0x617b71);
    for (let k = 0; k < 8; k++)
      box(
        scenery,
        x - 1.85 + k * 0.52,
        1.65,
        37.61,
        0.055,
        2.1,
        0.03,
        0x536d63,
      );
    box(scenery, x, 2.79, 40, 4.1, 0.1, 4.8, 0xa4ab96);
  }
  for (let j = 0; j < 10; j++) {
    const cone = new T.Mesh(
      new T.ConeGeometry(0.22, 0.65, 8),
      new T.MeshStandardMaterial({ color: 0xdc8c42 }),
    );
    cone.position.set(-44 + j * 2.4, 0.78, 19);
    cone.castShadow = true;
    scenery.add(cone);
    box(scenery, -44 + j * 2.4, 0.48, 19, 0.5, 0.07, 0.5, 0x36423a);
  }
  for (let j = 0; j < 3; j++) {
    const tube = new T.Mesh(
      new T.TorusGeometry(0.7, 0.15, 8, 16),
      new T.MeshStandardMaterial({ color: 0x9ba394 }),
    );
    tube.position.set(-44 + j * 1.65, 1.16, 32);
    tube.castShadow = true;
    scenery.add(tube);
  }
  // Distant hills frame the playable field.
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const hill = new T.Mesh(
      new T.ConeGeometry(12 + rng() * 12, 8 + rng() * 12, 6),
      new T.MeshStandardMaterial({ color: 0x8c9e80, flatShading: true }),
    );
    hill.position.set(Math.sin(a) * 85, -3, Math.cos(a) * 85);
    scenery.add(hill);
  }
  const board = document.createElement("canvas");
  board.width = 512;
  board.height = 256;
  const ctx = board.getContext("2d");
  ctx.fillStyle = "#293f34";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#e7c45b";
  for (let i = 0; i < 12; i++) ctx.fillRect(i * 48, 0, 24, 12);
  ctx.font = "bold 31px Arial";
  ctx.fillText("WORK IN PROGRESS", 28, 72);
  ctx.font = "19px Arial";
  ctx.fillStyle = "#ece9db";
  ctx.fillText("MAKE YOUR OWN ROAD.", 28, 121);
  ctx.font = "bold 21px Arial";
  ctx.fillText("SANDSTRUCTION / 0.7.0", 28, 207);
  const face = new T.Mesh(
    new T.PlaneGeometry(5, 2.5),
    new T.MeshStandardMaterial({
      map: new T.CanvasTexture(board),
      roughness: 1,
    }),
  );
  face.position.set(-19, 3.6, 18);
  face.castShadow = true;
  scenery.add(face);
  for (const x of [-21, -17])
    box(scenery, x, 1.6, 18, 0.14, 3.7, 0.14, 0x6d7964);
}
function updateTerrain() {
  if (smoothGround) {
    smoothGround.update(terrain, !terrainInitialized);
    terrainInitialized = true;
  } else {
    const p = terrainGeo.attributes.position;
    if (!surfaceCache || surfaceCache.seed !== terrain.seed)
      surfaceCache = new TerrainSurface(terrain.seed);
    surfaceCache.write(
      terrain,
      p.array,
      colors,
      terrainGeo.attributes.normal.array,
      previousHeights,
      terrainBlend.value,
      !terrainInitialized,
    );
    terrainGeo.attributes.normal.needsUpdate = true;
    terrainInitialized = true;
    terrainBlend.value = 0;
    terrainGeo.attributes.aPreviousHeight.needsUpdate = true;
    terrainGeo.attributes.aCompaction.array = terrain.compact;
    terrainGeo.attributes.aCompaction.needsUpdate = true;
    p.needsUpdate = true;
    terrainGeo.attributes.color.needsUpdate = true;
    terrainGeo.computeBoundingSphere();
  }
  if (edges) {
    scene.remove(edges);
    edges.geometry.dispose();
  }
  const verts = [],
    border = [];
  for (let x = 0; x <= N; x++) border.push(terrain.index(x, 0));
  for (let z = 1; z <= N; z++) border.push(terrain.index(N, z));
  for (let x = N - 1; x >= 0; x--) border.push(terrain.index(x, N));
  for (let z = N - 1; z > 0; z--) border.push(terrain.index(0, z));
  for (let j = 0; j < border.length; j++) {
    const a = border[j],
      b = border[(j + 1) % border.length],
      [x, z] = terrain.coord(a),
      [xx, zz] = terrain.coord(b);
    verts.push(
      x,
      terrain.sample(x, z),
      z,
      xx,
      terrain.sample(xx, zz),
      zz,
      x,
      -3.5,
      z,
      xx,
      terrain.sample(xx, zz),
      zz,
      xx,
      -3.5,
      zz,
      x,
      -3.5,
      z,
    );
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  edges = new T.Mesh(geo, edgeMat);
  scene.add(edges);
  scenery.userData.refreshNature?.();
  changed = false;
}
function createVehicles(saved) {
  disposeGroup(fleet);
  vehicles = MACHINES.map((def, i) => {
    const model = machineModel(def.id);
    const state = saved?.[i];
    const workshop = !state && roadPlan;
    const x = state?.x ?? (workshop ? (i === 0 ? -3 : 7) : -32 + (i % 3) * 4.6),
      z =
        state?.z ??
        (workshop
          ? i === 0
            ? 11.5
            : 24 - i * 5.4
          : 27 + Math.floor(i / 3) * 6);
    const v = {
      ...def,
      ...model,
      x: clamp(x, -45, 45),
      z: clamp(z, -45, 45),
      angle: state?.angle ?? (workshop ? 0 : -0.5),
      speed: 0,
      cargo: clamp(
        state?.cargo ?? (i === 0 || i === 4 ? def.capacity : 0),
        0,
        def.capacity,
      ),
      material: state?.material ?? (i === 4 ? 3 : 1),
      unload: state?.unload ?? (workshop && (i === 0 || i === 2)),
      bladeOffset: Number.isFinite(state?.bladeOffset)
        ? clamp(state.bladeOffset, -0.35, 0.55)
        : workshop
          ? 0
          : 0.05,
      bladeDatum: terrain.sample(x, z),
      bladeWidth: clampBladeWidth(state?.bladeWidth),
    };
    fleet.add(v.group);
    return v;
  });
}
function buildFleetUI() {
  $("fleet").innerHTML = MACHINES.map(
    (d, i) =>
      `<button data-machine="${i}" aria-label="${i + 1}: ${d.name}" title="${d.name} (${i + 1})"><span class="number">0${i + 1}</span>${fleetIcon(d.id)}<span class="fleet-name">${d.short}</span><span class="fleet-role">${d.role}</span></button>`,
  ).join("");
  $("fleet")
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => select(+b.dataset.machine)));
}
function select(i) {
  clearKeys();
  vehicles.forEach((v) => {
    v.lastTrack = null;
  });
  if ($("fleetSheet").open) $("fleetSheet").close();
  workStarted = false;
  selected = i;
  vehicles.forEach((v) => (v.speed = 0));
  document.querySelectorAll("[data-machine]").forEach((b, j) => {
    b.classList.toggle("active", j === i);
    b.setAttribute("aria-pressed", j === i ? "true" : "false");
  });
  const v = vehicles[i];
  $("machineCode").textContent = `0${i + 1} / ${v.code}`;
  $("machineName").textContent = v.name;
  $("machineDesc").textContent = v.desc;
  $("materialRow").hidden = v.id !== "truck";
  $("bladePanel").hidden = v.id !== "dozer";
  $("refillBtn").hidden = !["truck", "paver"].includes(v.id);
  $("loadLabel").textContent = v.capacity ? "HAZNE YÜKÜ" : "İŞLENEN HACİM";
  updateMode();
  updateDesktopButtons();
  updateUI();
}
function updateMode() {
  const v = vehicles[selected];
  $("modeBtn").hidden = !["loader", "shovel", "dozer", "truck"].includes(v.id);
  mobileUI?.machineChanged(v);
  $("modeBtn").innerHTML =
    (v.unload ? "Boşaltma modu" : "Kazı modu") + " <span>X</span>";
  if (v.id === "truck")
    $("modeBtn").innerHTML =
      (v.unload ? "Şerit dökümü" : "Yığın dökümü") + " <span>X</span>";
  if (v.id === "dozer")
    $("modeBtn").innerHTML =
      (v.unload ? "Tesviye modu" : "İtme modu") + " <span>X</span>";
  $("actionHint").textContent = ["loader", "shovel"].includes(v.id)
    ? v.unload
      ? "Basılı tut → hazneyi öne boşalt"
      : "Basılı tut → öndeki zemini kaz"
    : v.id === "dozer" && v.unload
      ? "Basılı tut → kot farkını azalt"
      : v.tool;
  document
    .querySelectorAll("[data-material]")
    .forEach((b) =>
      b.classList.toggle("selected", +b.dataset.material === v.material),
    );
}
function toolPosition(v) {
  const reach =
    v.id === "truck"
      ? -2.5
      : v.id === "paver"
        ? -2.1
        : v.id === "shovel"
          ? 1.1
          : v.id === "roller"
            ? 1.25
            : v.id === "dozer"
              ? 2.05
              : 2.3;
  return {
    x: v.x - Math.sin(v.angle) * reach,
    z: v.z - Math.cos(v.angle) * reach,
  };
}
function spawnDust(
  x,
  z,
  material,
  count = 10,
  sourceHeight = 0,
  pouring = false,
) {
  const color = new T.Color(MATERIALS[material]?.color ?? 0x9b8461);
  for (let i = 0; i < count; i++) {
    const slot = dustCursor++ % dust.length,
      d = dust[slot];
    const spread = pouring ? 0.35 : 1.2;
    Object.assign(d, {
      x: x + (Math.random() - 0.5) * spread,
      z: z + (Math.random() - 0.5) * spread,
      y: terrain.sample(x, z) + Math.max(0.12, sourceHeight),
      life: pouring ? 1.6 : 0.7,
      vx: (Math.random() - 0.5) * (pouring ? 0.6 : 1.6),
      vz: (Math.random() - 0.5) * (pouring ? 0.6 : 1.6),
      vy: pouring ? -0.5 : 1.3 + Math.random(),
      scale: 0.45 + Math.random() * 0.85,
      pouring,
      landed: false,
    });
    particles.setColorAt(
      slot,
      color.clone().multiplyScalar(0.82 + Math.random() * 0.32),
    );
  }
  if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
}
let warningAt = -10;
function operate(v, dt, distance = 0) {
  const p = toolPosition(v),
    id = v.id;
  let amount = 0;
  if (id === "truck") {
    if (v.unload) {
      amount = terrain.spreadLayer(
        p.x,
        p.z,
        v.angle,
        ROAD_SPREAD_WIDTH,
        1.1,
        Math.min(v.cargo, ROAD_SPREAD_WIDTH * ROAD_FILL_DEPTH * distance),
        v.material,
      );
    } else {
      amount = Math.min(v.cargo, 1.8 * dt);
      terrain.deposit(p.x, p.z, 1.55, amount, v.material);
    }
    v.cargo -= amount;
  } else if (id === "loader" || id === "shovel") {
    const rate = id === "shovel" ? 0.22 : 1.25,
      r = id === "shovel" ? 0.85 : 1.5;
    if (v.unload) {
      amount = Math.min(v.cargo, rate * dt);
      terrain.deposit(p.x, p.z, r, amount, v.material);
      v.cargo -= amount;
    } else {
      const result = terrain.dig(
        p.x,
        p.z,
        r,
        Math.min(v.capacity - v.cargo, rate * dt),
      );
      amount = result.volume;
      if (v.cargo < 0.01) v.material = result.material;
      v.cargo += amount;
    }
  } else if (id === "dozer") {
    if (v.unload) {
      const alongRoad = roadPlan?.contains(p.x, p.z, 2);
      amount = terrain.bladeGrade(
        p.x,
        p.z,
        v.angle,
        v.bladeDatum + v.bladeOffset,
        distance * 1.6,
        v.bladeWidth,
        alongRoad ? roadPlan.slope * roadPlan.dx : 0,
        alongRoad ? roadPlan.slope * roadPlan.dz : 0,
      );
    } else {
      amount = v.unload
        ? terrain.grade(
            p.x,
            p.z,
            v.angle,
            v.bladeDatum + v.bladeOffset,
            dt * Math.abs(v.speed) * 1.8,
            v.bladeWidth,
          )
        : terrain.push(
            p.x,
            p.z,
            v.angle,
            v.bladeDatum + v.bladeOffset,
            dt * Math.max(0, v.speed) * 0.8,
            v.bladeWidth,
          );
    }
    stats.moved += amount;
  } else if (id === "roller") {
    amount = terrain.finish(p.x, p.z, v.angle, 2.2, 1.3, dt * 2.4);
  } else if (id === "paver") {
    amount = terrain.spreadLayer(
      p.x,
      p.z,
      v.angle,
      ROAD_SPREAD_WIDTH,
      1.1,
      Math.min(v.cargo, ROAD_SPREAD_WIDTH * ROAD_ASPHALT_DEPTH * distance),
      3,
    );
    v.cargo -= amount;
  }
  if (amount > 0.00001) {
    if (id !== "roller")
      tireTracks.erase(
        p.x,
        p.z,
        id === "dozer" ? v.bladeWidth * 0.55 : id === "shovel" ? 0.5 : 1.6,
      );
    changed = true;
    dirty = true;
    const pouring =
      id === "truck" ||
      ((id === "loader" || id === "shovel") && v.unload) ||
      id === "paver";
    if (id !== "roller")
      spawnDust(
        p.x,
        p.z,
        id === "paver" ? 3 : v.material,
        Math.min(30, Math.max(4, Math.ceil(amount * 450))),
        id === "truck"
          ? 1.5
          : id === "loader"
            ? 0.65
            : id === "paver"
              ? 0.35
              : 0.25,
        pouring,
      );
  } else if (elapsed - warningAt > 4) {
    warningAt = elapsed;
    if (
      v.capacity &&
      v.cargo < 0.01 &&
      (v.id === "truck" || v.id === "paver" || v.unload)
    )
      toast(
        v.id === "truck" || v.id === "paver"
          ? "Hazne boş. R ile yeniden doldur."
          : "Hazne boş. X ile kazı moduna geç.",
      );
    else if (v.capacity && v.cargo >= v.capacity - 0.01 && !v.unload)
      toast("Hazne dolu. X ile boşaltma moduna geç.");
    else if (id === "dozer")
      toast("Bıçak kotu J/K ile ayarlanır. SPACE basılıyken ileri sür.");
    else if (id === "paver")
      toast("Asfalt şeridi için SPACE basılıyken ilerle.");
    else if (id === "roller")
      toast("Silindir dökülmüş kum, çakıl ve asfalt üzerinde çalışır.");
  }
}
function drive(dt) {
  const v = vehicles[selected];
  const motion = stepVehicle(
    v,
    {
      throttle:
        keys.has("w") ||
        keys.has("arrowup") ||
        keys.has("s") ||
        keys.has("arrowdown")
          ? Number(keys.has("w") || keys.has("arrowup")) -
            Number(keys.has("s") || keys.has("arrowdown"))
          : (mobileUI?.input.throttle ?? 0),
      steer:
        keys.has("a") ||
        keys.has("arrowleft") ||
        keys.has("d") ||
        keys.has("arrowright")
          ? Number(keys.has("a") || keys.has("arrowleft")) -
            Number(keys.has("d") || keys.has("arrowright"))
          : (mobileUI?.input.steer ?? 0),
      brake: keys.has("shift") || mobileUI?.input.brake,
      speedLimit: workGear && wantsWork() ? ROAD_WORK_SPEED[v.id] : undefined,
    },
    terrain,
    [...vehicles, ...obstacles],
    dt,
  );
  if (motion.distance > 0) dirty = true;
  trackDistance += motion.distance;
  if (v.id !== "shovel" && motion.distance > 0) {
    const axle = v.id === "truck" ? 1.5 : v.id === "roller" ? 1 : 0;
    const width = ["dozer", "paver"].includes(v.id) ? 0.5 : 0.32;
    const points = [-1, 1].map((side) => ({
      x: v.x + Math.cos(v.angle) * side * 0.98 + Math.sin(v.angle) * axle,
      z: v.z - Math.sin(v.angle) * side * 0.98 + Math.cos(v.angle) * axle,
    }));
    if (v.lastTrack && trackDistance >= 0.1) {
      points.forEach((p, i) => {
        const old = v.lastTrack[i],
          cell = terrain.nearest(p.x, p.z);
        const strength = terrain.mat[cell] === 3 ? 0.2 : 0.68;
        tireTracks.stroke(
          old.x,
          old.z,
          p.x,
          p.z,
          width,
          strength,
          v.trackPhase || 0,
        );
        if (terrain.track(p.x, p.z, 0.2)) changed = true;
      });
      v.trackPhase = (v.trackPhase || 0) + trackDistance;
      trackDistance = 0;
      v.lastTrack = points;
    } else if (!v.lastTrack) v.lastTrack = points;
  }
  working = wantsWork() && canPlay();
  if (working && !workStarted) {
    rememberWork();
    v.bladeDatum = terrain.sample(v.x, v.z);
  }
  if (!working) v.bladeDatum = terrain.sample(v.x, v.z);
  const bladePoint = toolPosition(v);
  if (
    v.id === "dozer" &&
    v.unload &&
    roadPlan?.contains(bladePoint.x, bladePoint.z, 2)
  )
    v.bladeDatum = roadPlan.heightAt(bladePoint.x, bladePoint.z);
  workStarted = working;
  if (working) operate(v, dt, motion.distance);
  if (!isMobile() && (keys.has("q") || keys.has("e")) && cameraMode !== 2) {
    cameraMode = 2;
    updateDesktopButtons();
  }
  if (keys.has("q")) cameraAngle += dt * 1.3;
  if (keys.has("e")) cameraAngle -= dt * 1.3;
  vehicles.forEach((m, i) => {
    for (const wheel of m.wheels) {
      const spin = wheel.userData.spin || wheel;
      spin.rotation.x -= (m.speed * dt) / (wheel.userData.radius || 0.67);
      if (wheel.userData.front) wheel.rotation.y = m.steer || 0;
    }
    if (m.load) {
      m.load.visible = m.cargo > 0.005;
      m.load.scale.y = Math.max(0.02, m.cargo / (m.capacity || 1));
      m.load.material.color.set(MATERIALS[m.material].color);
    }
    if (m.moving && m.id === "truck")
      m.moving.rotation.x = T.MathUtils.damp(
        m.moving.rotation.x,
        i === selected && working ? 0.48 : 0,
        4,
        dt,
      );
    for (const part of m.bladeParts) part.scale.x = m.bladeWidth / 3.2;
    if (m.id === "dozer" && m.moving)
      m.moving.position.y = clamp(
        m.bladeDatum + m.bladeOffset - m.group.position.y - 0.11,
        -0.55,
        0.7,
      );
    if (m.arm && m.id === "loader")
      m.arm.rotation.x = T.MathUtils.damp(
        m.arm.rotation.x,
        m.unload ? -0.2 : working ? 0.08 : 0,
        4,
        dt,
      );
    if (m.arm && m.id === "shovel")
      m.arm.rotation.x =
        i === selected && working ? Math.sin(elapsed * 9) * 0.23 : 0;
  });
  const pos = toolPosition(v);
  toolRing.visible = started && !["dozer", "roller", "paver"].includes(v.id);
  updateWorkGuide(v);
  toolRing.position.set(pos.x, terrain.sample(pos.x, pos.z) + 0.08, pos.z);
  toolRing.scale.setScalar(v.id === "shovel" ? 0.6 : 1);
  toolRing.material.opacity = working ? 0.85 : 0.28;
  ring.position.set(v.x, terrain.sample(v.x, v.z) + 0.07, v.z);
  ring.visible = started;
  ring.scale.setScalar(v.id === "shovel" ? 0.5 : 1);
  if (engineGain) {
    const moving = Math.abs(v.speed) / v.max;
    engine.frequency.setTargetAtTime(
      v.id === "shovel" ? 25 : 35 + moving * 35 + (working ? 8 : 0),
      audioCtx.currentTime,
      0.15,
    );
    engineGain.gain.setTargetAtTime(
      sound && started && v.id !== "shovel" ? 0.014 + moving * 0.012 : 0,
      audioCtx.currentTime,
      0.2,
    );
  }
}
const cameraTarget = new T.Vector3(-29, 0, 26),
  lookTarget = new T.Vector3();
function updateCamera(dt, instant = false) {
  const v = vehicles[selected];
  const focus = v;
  lookTarget.set(focus.x, terrain.sample(focus.x, focus.z) + 0.65, focus.z);
  if (!isMobile() && cameraMode === 1 && !mapView) {
    cameraAngle = T.MathUtils.damp(cameraAngle, v.angle + 0.12, 3, dt);
    cameraPitch = T.MathUtils.damp(cameraPitch, 0.61, 3, dt);
  }
  roadGuide.group.visible =
    !!roadPlan && !isMobile() && started && shell.state.hud;
  cameraTarget.lerp(lookTarget, instant ? 1 : 1 - Math.exp(-dt * 4));
  const dist = mapView ? 65 : cameraDistance;
  const horizontal = mapView ? 0.12 : Math.cos(cameraPitch) * 1.1,
    vertical = mapView ? 1.1 : Math.sin(cameraPitch) * 1.1;
  const desired = new T.Vector3(
    cameraTarget.x + Math.sin(cameraAngle) * dist * horizontal,
    cameraTarget.y + dist * vertical,
    cameraTarget.z + Math.cos(cameraAngle) * dist * horizontal,
  );
  desired.y = Math.max(
    desired.y,
    terrain.sample(clamp(desired.x, -47, 47), clamp(desired.z, -47, 47)) + 5,
  );
  camera.position.lerp(desired, instant ? 1 : 1 - Math.exp(-dt * 5));
  camera.lookAt(cameraTarget);
}
function drawMinimap() {
  const c = $("minimap").getContext("2d"),
    w = 192,
    scale = w / (N + 1),
    img = c.createImageData(w, w);
  const palette = [
    [137, 151, 104],
    [213, 186, 126],
    [139, 150, 148],
    [65, 74, 73],
  ];
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const i = terrain.index(Math.floor((x / w) * N), Math.floor((y / w) * N)),
        p = palette[terrain.mat[i]],
        shade = clamp(0.88 + terrain.h[i] * 0.045, 0.65, 1.2),
        j = (y * w + x) * 4;
      img.data[j] = p[0] * shade;
      img.data[j + 1] = p[1] * shade;
      img.data[j + 2] = p[2] * shade;
      img.data[j + 3] = 255;
    }
  c.putImageData(img, 0, 0);
  c.fillStyle = "#e0dbc0";
  c.fillRect(6, 131, 45, 46);
  vehicles.forEach((v, i) => {
    const x = ((v.x + 48) / 96) * w,
      y = ((v.z + 48) / 96) * w;
    c.fillStyle = i === selected ? "#f6dc83" : "#2f493c";
    c.beginPath();
    c.arc(x, y, i === selected ? 4 : 2.2, 0, Math.PI * 2);
    c.fill();
    if (i === selected) {
      c.strokeStyle = "#263d2e";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - Math.sin(v.angle) * 9, y - Math.cos(v.angle) * 9);
      c.stroke();
    }
  });
  c.fillStyle = "#f3f1e7";
  c.font = "bold 10px Arial";
  c.fillText("N", 179, 13);
}
function updateUI() {
  const v = vehicles[selected];
  mobileUI?.readout(
    Math.abs(v.speed * 3.6).toFixed(0),
    (v.capacity ? v.cargo : stats.moved).toFixed(1),
  );
  $("speed").innerHTML =
    Math.abs(v.speed * 3.6).toFixed(0) + "<span>km/sa</span>";
  $("load").innerHTML =
    (v.capacity ? v.cargo : stats.moved).toFixed(v.id === "shovel" ? 2 : 1) +
    "<span>m³</span>";
  $("loadBar").style.width =
    (v.capacity ? (v.cargo / v.capacity) * 100 : 100) + "%";
  $("ground").innerHTML =
    Math.round(terrain.compact[terrain.nearest(v.x, v.z)] * 100) +
    "<span>%</span>";
  $("coords").textContent = `X ${v.x.toFixed(0)} · Z ${v.z.toFixed(0)}`;
  $("workingBanner").hidden = !working;
  const action = {
    truck: MATERIALS[v.material].name.toUpperCase() + " DÖKÜLÜYOR",
    loader: v.unload ? "HAZNE BOŞALTILIYOR" : "KAZI YAPILIYOR",
    dozer: v.unload ? "TESVİYE · SABİT KOT" : "İTME · SABİT KOT",
    roller: "MALZEME SIKIŞTIRILIYOR",
    paver: "ASFALT SERİLİYOR",
    shovel: v.unload ? "KÜREK BOŞALTILIYOR" : "KAZI YAPILIYOR",
  };
  $("workingText").textContent = action[v.id];
  const contact = toolPosition(v),
    cell = terrain.nearest(contact.x, contact.z),
    comp = terrain.compact[cell];
  $("surfaceStatus").textContent =
    terrain.mat[cell] === 0
      ? "Zemin: toprak"
      : `${MATERIALS[terrain.mat[cell]].name} · ${comp < 0.25 ? "gevşek / pürüzlü" : comp < 0.8 ? "işleniyor" : "sıkıştırılmış / düzgün"}`;
  updateRoadUI();
  if (!isMobile()) {
    const delta = roadPlan?.contains(contact.x, contact.z, 1)
      ? terrain.sample(contact.x, contact.z) -
        roadPlan.heightAt(contact.x, contact.z) -
        (terrain.mat[cell] === 3 ? 0.1 : 0)
      : null;
    $("probeMaterial").textContent =
      MATERIALS[terrain.mat[cell]].name +
      (terrain.mat[cell] === 3
        ? comp < 0.85
          ? " · gevşek"
          : " · bitmiş"
        : "");
    $("probeCompact").textContent = "Sıkışma: %" + Math.round(comp * 100);
    $("probeGrade").textContent =
      delta === null
        ? "Kot: serbest"
        : Math.abs(delta) < 0.075
          ? "Kot: uygun"
          : (delta > 0 ? "Yüksek +" : "Eksik ") +
            Math.round(delta * 100) +
            " cm";
    $("probeHint").textContent =
      v.id === "dozer"
        ? roadPlan?.contains(contact.x, contact.z, 2) && v.unload
          ? "Bıçak yol kotunu izliyor · J/K ile ince ayar"
          : "X ile tesviyeye geç · J/K bıçak kotu"
        : v.id === "roller"
          ? "İkinci şeridi de geç · hedef %85 ve üzeri"
          : v.id === "paver"
            ? "10 cm serim · dalgaları silindir bitirir"
            : v.id === "truck"
              ? v.unload
                ? "Şerit dökümü · ilerle ve çalıştır · R doldur"
                : "Yığın dökümü · X ile şeride geç"
              : v.tool;
    $("equipmentBtn").setAttribute("aria-pressed", String(working));
  }
  $("bladeWidth").textContent = v.bladeWidth.toFixed(1) + " m";
  $("bladeHeight").textContent =
    (v.bladeOffset >= 0 ? "+" : "") + v.bladeOffset.toFixed(2) + " m";
}
function toast(message) {
  const dialog = document.querySelector("dialog[open]");
  if (dialog) {
    let notice = dialog.querySelector(".dialog-feedback");
    if (!notice) {
      notice = document.createElement("p");
      notice.className = "dialog-feedback";
      notice.setAttribute("role", "status");
      dialog.append(notice);
    }
    notice.textContent = message;
  }
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3200);
}
function save(manual = false) {
  if (!started) return;
  try {
    const data = {
      version: 4,
      tireTracks: tireTracks.serialize(),
      terrain: terrain.serialize(true),
      vehicles: vehicles.map((v) => ({
        x: v.x,
        z: v.z,
        angle: v.angle,
        cargo: v.cargo,
        material: v.material,
        unload: v.unload,
        bladeOffset: v.bladeOffset,
        bladeWidth: v.bladeWidth,
      })),
      selected,
      stats,
      cameraAngle,
      cameraDistance,
      cameraPitch,
      roadPlan: roadPlan?.serialize(),
      cameraMode,
      displayTouch: mobileUI?.touch ?? touchLayout,
      surfaceQuality: smoothGround?.segments,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    dirty = false;
    const stamp = new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    $("saveStatus").textContent = "Bu tarayıcıya kaydedildi · " + stamp;
    if (manual) toast("Sahan bu tarayıcıya kaydedildi.");
  } catch (error) {
    $("saveStatus").textContent =
      "Kayıt yapılamadı · tarayıcı depolamasını kontrol et";
    if (manual)
      toast("Kayıt yapılamadı. Tarayıcı depolaması dolu veya kapalı olabilir.");
  }
}
function load() {
  try {
    const raw =
      localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (
      ![1, 2, 3, 4].includes(data.version) ||
      !Array.isArray(data.vehicles) ||
      data.vehicles.length !== 6 ||
      !data.vehicles.every(
        (v) =>
          ["x", "z", "angle", "cargo"].every((k) => Number.isFinite(v[k])) &&
          Number.isInteger(v.material) &&
          v.material >= 0 &&
          v.material <= 3,
      )
    )
      throw Error("Kayıt geçersiz");
    terrain = Terrain.restore(data.terrain);
    tireTracks.restore(data.tireTracks);
    terrainInitialized = false;
    stats = {
      moved: Number.isFinite(data.stats?.moved) ? data.stats.moved : 0,
    };
    let restoredRoad = null;
    try {
      restoredRoad = RoadPlan.restore(data.roadPlan);
    } catch {}
    setRoad(restoredRoad);
    cameraMode = data.cameraMode === 1 ? 1 : 2;
    createVehicles(data.vehicles);
    selected = clamp(Math.trunc(data.selected) || 0, 0, 5);
    cameraAngle = Number.isFinite(data.cameraAngle) ? data.cameraAngle : 0.68;
    cameraDistance = clamp(data.cameraDistance || 19, 10, 40);
    cameraPitch = Number.isFinite(data.cameraPitch)
      ? clamp(data.cameraPitch, 0.35, 1.2)
      : Math.PI / 4;
    if (smoothGround && SURFACE_QUALITIES.includes(data.surfaceQuality)) {
      smoothGround.setQuality(
        (mobileUI?.touch ?? touchLayout) && data.displayTouch !== true
          ? Math.min(data.surfaceQuality, initialProfile.segments)
          : data.surfaceQuality,
      );
      updateQualityLabel();
    }
    rebuildScenery();
    changed = true;
    select(selected);
    $("seedLabel").textContent = "SAHA " + terrain.seed;
    return true;
  } catch (e) {
    toast("Eski kayıt okunamadı. Yeni bir sahayla başlıyoruz.");
    return false;
  }
}
function newWorld(seed) {
  cancelPlanning();
  terrain = new Terrain(seed);
  tireTracks.clear();
  setRoad(prepareWorkshop(terrain));
  terrainInitialized = false;
  settlingClock = 0;
  stats = { moved: 0 };
  undoStack.length = 0;
  workStarted = false;
  $("undoBtn").disabled = true;
  createVehicles();
  selected = 0;
  cameraAngle = 0.68;
  cameraDistance = isMobile() ? 22 : 15;
  cameraPitch = isMobile() ? Math.PI / 4 : 0.61;
  cameraMode = 2;
  mapView = false;
  rebuildScenery();
  updateTerrain();
  select(0);
  $("seedLabel").textContent = "SAHA " + terrain.seed;
  dirty = true;
  updateCamera(1, true);
  drawMinimap();
}
function start(resume) {
  if (resume) load();
  started = true;
  document.body.classList.add("playing");
  $("overlay").hidden = true;
  clearKeys();
  updateCamera(1, true);
  toast(
    mobileUI?.touch
      ? "Sol çubukla sür · sağdan çalıştır · araziyi sürükleyerek kamerayı döndür"
      : "WASD sür · SPACE çalıştır · X şerit/yığın · F ekipmanı açık tut",
  );
  save();
}
function canPlay() {
  return (
    started &&
    !planning &&
    !document.hidden &&
    !document.querySelector("dialog[open]")
  );
}
function clearKeys() {
  keys.clear();
  mobileUI?.reset();
  gestures.reset();
  equipmentLatched = false;
  $("equipmentBtn").setAttribute("aria-pressed", "false");
  $("equipmentBtn").innerHTML = "Ekipmanı aç <kbd>F</kbd>";
  if (engineGain)
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
  working = false;
  vehicles.forEach((v) => (v.speed = 0));
  workStarted = false;
}
function openDialog(id) {
  cancelPlanning();
  clearKeys();
  document.querySelectorAll("dialog[open]").forEach((d) => {
    if (d.id !== id) d.close();
  });
  const notice = $(id).querySelector(".dialog-feedback");
  if (notice) notice.textContent = "";
  if (!$(id).open) $(id).showModal();
}
function toggleMode() {
  const v = vehicles[selected];
  if (!["loader", "shovel", "dozer", "truck"].includes(v.id)) return;
  v.unload = !v.unload;
  updateMode();
  dirty = true;
  if (v.id === "truck") {
    toast(
      v.unload
        ? "Şerit dökümü · çalıştırırken ileri sür"
        : "Yığın dökümü · durarak dök",
    );
    return;
  }
  if (v.id === "dozer") {
    toast(
      v.unload
        ? "Tesviye modu · kot farkını azalt"
        : mobileUI?.touch
          ? "İtme modu · çalıştırırken ileri sür"
          : "İtme modu · SPACE basılıyken ileri sür",
    );
    return;
  }
  toast(
    v.unload
      ? mobileUI?.touch
        ? "Boşaltma modu · sağdaki düğmeyle çalıştır"
        : "Boşaltma modu · SPACE basılı tut"
      : mobileUI?.touch
        ? "Kazı modu · sağdaki düğmeyle çalıştır"
        : "Kazı modu · SPACE basılı tut",
  );
}
function refill() {
  const v = vehicles[selected];
  if (!["truck", "paver"].includes(v.id)) return;
  v.cargo = v.capacity;
  dirty = true;
  toast(
    "Sandbox deposu → " +
      v.capacity +
      " m³ " +
      MATERIALS[v.material].name.toLocaleLowerCase("tr-TR"),
  );
}
document.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) ||
    document.querySelector("dialog[open]")
  )
    return;
  if (
    [" ", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.key,
    )
  )
    e.preventDefault();
  if (!started) return;
  const k = e.key.toLowerCase();
  if (planning) {
    if (k === "escape") cancelPlanning();
    return;
  }
  keys.add(k);
  if (e.repeat) return;
  if (/^[1-6]$/.test(k)) select(+k - 1);
  if (k === "tab") select((selected + 1) % 6);
  if (k === "x") toggleMode();
  if (k === "r") refill();
  if (k === "j") adjustBlade(-0.05);
  if (k === "k") adjustBlade(0.05);
  if (k === "u") adjustWidth(-0.2);
  if (k === "i") adjustWidth(0.2);
  if (k === "m") mapView = !mapView;
  if (!isMobile()) {
    if (k === "p") shell.toggle("hud");
    if (k === "o") cycleWorkCamera();
    if (k === "v") cycleInspection();
    if (k === "b") toggleWorkGear();
    if (k === "f") toggleEquipment();
    if (k === "escape") openDialog("menuSheet");
  }
  if (k === "g") grid.visible = !grid.visible;
  if (k === "h") openDialog("helpDialog");
  if (k === "z") undoWork();
  if (k === "c") {
    if (!isMobile()) {
      cameraMode = 2;
      cameraPitch = 0.61;
      updateDesktopButtons();
    }
    cameraAngle = vCameraHeading();
    mapView = false;
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", clearKeys);
document.addEventListener("visibilitychange", () => {
  clearKeys();
  if (document.hidden && dirty) save();
});
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (planning && !isMobile() && e.button === 0) {
    placeRoadPoint(e);
    return;
  }
  if (!canPlay() || (e.pointerType === "mouse" && ![0, 2].includes(e.button)))
    return;
  e.preventDefault();
  if (!isMobile()) {
    cameraMode = 2;
    updateDesktopButtons();
  }
  gestures.start(e.pointerId, e.clientX, e.clientY);
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (planning && planDraft) {
    previewRoadPoint(e);
    return;
  }
  if (!canPlay()) return;
  const delta = gestures.move(e.pointerId, e.clientX, e.clientY);
  if (!delta) return;
  cameraAngle += delta.yaw;
  cameraPitch = clamp(cameraPitch + delta.pitch, 0.35, 1.2);
  cameraDistance = clamp(cameraDistance * delta.zoom, 10, 40);
  dirty = true;
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  renderer.domElement.addEventListener(event, (e) => gestures.end(e.pointerId));
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (canPlay())
      cameraDistance = clamp(cameraDistance + e.deltaY * 0.025, 10, 40);
  },
  { passive: false },
);
$("startBtn").onclick = () => start(false);
$("continueBtn").onclick = () => start(true);
$("helpBtn").onclick = () => openDialog("helpDialog");
$("newBtn").onclick = () => {
  $("seedInput").value = terrain.seed;
  openDialog("newDialog");
};
$("saveBtn").onclick = () => save(true);
$("modeBtn").onclick = toggleMode;
$("refillBtn").onclick = refill;
$("mapBtn").onclick = () => {
  mapView = !mapView;
  if ($("mapSheet").open) $("mapSheet").close();
};
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
document
  .querySelectorAll("dialog")
  .forEach((d) => d.addEventListener("close", clearKeys));
$("randomBtn").onclick = () =>
  ($("seedInput").value = 1 + Math.floor(Math.random() * 999999));
$("generateBtn").onclick = () => {
  const n = Number($("seedInput").value);
  if (!Number.isInteger(n) || n < 1 || n > 999999) {
    toast("1–999999 arasında bir saha numarası gir.");
    return;
  }
  newWorld(n);
  $("newDialog").close();
  started = true;
  document.body.classList.add("playing");
  $("overlay").hidden = true;
  save();
  toast("Saha " + n + " hazır. Baştan inşa et.");
};
document.querySelectorAll("[data-material]").forEach(
  (b) =>
    (b.onclick = () => {
      const v = vehicles[selected];
      v.material = +b.dataset.material;
      updateMode();
      dirty = true;
      toast("Sandbox yükü: " + MATERIALS[v.material].name);
    }),
);
$("soundBtn").onclick = () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      engine = audioCtx.createOscillator();
      engine.type = "sawtooth";
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 160;
      engineGain = audioCtx.createGain();
      engineGain.gain.value = 0;
      engine.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(audioCtx.destination);
      engine.start();
    }
    audioCtx.resume();
    sound = !sound;
    $("soundBtn").textContent = sound ? "SES AÇIK" : "SES KAPALI";
    $("soundBtn").setAttribute("aria-label", sound ? "Sesi kapat" : "Sesi aç");
  } catch {
    toast("Bu tarayıcıda ses başlatılamadı.");
  }
};
function resizeViewport() {
  const { width, height } = viewportSize();
  document.documentElement.style.setProperty("--app-width", width + "px");
  document.documentElement.style.setProperty("--app-height", height + "px");
  document.documentElement.style.setProperty(
    "--viewport-top",
    (window.visualViewport?.offsetTop || 0) + "px",
  );
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(currentProfile().pixelRatio);
  renderer.setSize(width, height);
  if (isMobile() && planning) cancelPlanning();
  updateDesktopButtons();
  hemi.intensity = isMobile() ? 2.3 : 1.65;
  setAtmosphere(atmosphere);
  if (vehicles.length) updateMode();
}
let resizeFrame = 0;
function scheduleResize() {
  clearKeys();
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(resizeViewport);
}
window.addEventListener("resize", scheduleResize);
window.visualViewport?.addEventListener("resize", scheduleResize);
window.visualViewport?.addEventListener("scroll", scheduleResize);
window.addEventListener("pagehide", () => {
  clearKeys();
  if (dirty) save();
});
mobileUI = initMobileUI({
  canPlay,
  clearInput: clearKeys,
  openDialog,
  onLayout: resizeViewport,
});
buildFleetUI();
newWorld(3817);
updateDesktopButtons();
setAtmosphere(0);
applyArrivalContext();
try {
  $("continueBtn").hidden = !(
    localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEY)
  );
} catch {}
let previous = performance.now(),
  terrainTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (document.hidden) return;
  elapsed += dt;
  terrainTimer += dt;
  autoSaveElapsed += dt;
  if (canPlay()) drive(dt);
  else {
    working = false;
    if (engineGain)
      engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
  }
  if (canPlay()) {
    settlingClock += dt;
    while (settlingClock >= 1 / 30) {
      if (terrain.settle(1 / 30) > 0.0000001) changed = dirty = true;
      settlingClock -= 1 / 30;
    }
  }
  if (changed && terrainTimer > 1 / 30) {
    updateTerrain();
    terrainTimer = 0;
  }
  terrainBlend.value = T.MathUtils.damp(terrainBlend.value, 1, 42, dt);
  // Resolve against the exact visible interpolated surface, after terrain updates.
  for (const v of vehicles) {
    const sample = smoothGround
      ? (x, z) => smoothGround.field.sample(x, z, terrainBlend.value)
      : (x, z) =>
          sampleDisplayMesh(
            terrainGeo.attributes.position.array,
            previousHeights,
            terrainBlend.value,
            x,
            z,
            N,
            SIZE,
          );
    const teleported =
      !v.contact || Math.hypot(v.x - v.contactX, v.z - v.contactZ) > 2;
    v.contact = solveContact(v, sample, dt, teleported ? null : v.contact);
    v.contactX = v.x;
    v.contactZ = v.z;
    v.group.position.set(v.x, v.contact.y, v.z);
    v.group.rotation.set(v.contact.pitch, v.angle, v.contact.roll, "YXZ");
  }
  if (elapsed - (frame.trackUpload || 0) > 0.08) {
    smoothGround?.updateTracks();
    if (fallbackTrackTexture && tireTracks.dirty) {
      fallbackTrackTexture.needsUpdate = true;
      tireTracks.dirty = false;
    }
    frame.trackUpload = elapsed;
  }
  updateCamera(dt);
  for (let i = 0; i < dust.length; i++) {
    const p = dust[i];
    p.life -= dt;
    if (p.life > 0) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.vy -= 9.8 * dt;
      const floor = terrain.sample(p.x, p.z) + 0.025;
      if (p.y < floor) {
        p.y = floor;
        p.vy = 0;
        p.vx *= 0.7;
        p.vz *= 0.7;
        if (!p.landed) {
          p.landed = true;
          p.life = Math.min(p.life, 0.3);
        }
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar((p.scale || 1) * Math.min(1, p.life * 4));
    } else dummy.scale.setScalar(0);
    dummy.updateMatrix();
    particles.setMatrixAt(i, dummy.matrix);
  }
  particles.instanceMatrix.needsUpdate = true;
  if (elapsed - lastUI > 0.12) {
    updateUI();
    lastUI = elapsed;
  }
  if (elapsed - lastMap > 0.35) {
    drawMinimap();
    lastMap = elapsed;
  }
  if (autoSaveElapsed > 30) {
    if (dirty) save();
    autoSaveElapsed = 0;
  }
  water.material.color.offsetHSL(0, 0, Math.sin(elapsed * 0.5) * 0.00002);
  renderer.render(scene, camera);
  if (document.body.classList.contains("booting")) finishBoot();
}
requestAnimationFrame(frame);

function groundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d"),
    img = ctx.createImageData(128, 128),
    rng = random(115);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 218 + rng() * 37;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(160, 160);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function rememberWork() {
  undoStack.push({
    tireTracks: tireTracks.serialize(),
    h: terrain.h.slice(),
    mat: terrain.mat.slice(),
    compact: terrain.compact.slice(),
    marks: terrain.marks.slice(),
    loose: terrain.loose.slice(),
    cargo: vehicles.map((v) => ({ cargo: v.cargo, material: v.material })),
    moved: stats.moved,
  });
  if (undoStack.length > 8) undoStack.shift();
  $("undoBtn").disabled = false;
}
function undoWork() {
  clearKeys();
  const prev = undoStack.pop();
  if (!prev) {
    toast("Henüz geri alınacak bir işlem yok.");
    return;
  }
  tireTracks.restore(prev.tireTracks);
  terrain.h.set(prev.h);
  terrain.mat.set(prev.mat);
  terrain.compact.set(prev.compact);
  terrain.marks.set(prev.marks);
  terrain.loose.set(prev.loose);
  terrain.active = null;
  dust.forEach((p) => (p.life = 0));
  vehicles.forEach((v, i) => Object.assign(v, prev.cargo[i]));
  stats.moved = prev.moved;
  changed = dirty = true;
  $("undoBtn").disabled = !undoStack.length;
  toast("Son çalışma geri alındı.");
}
function vCameraHeading() {
  return vehicles[selected].angle;
}
function setAtmosphere(index) {
  atmosphere = index % 3;
  const moods = [
    {
      sky: 0xc8d8d2,
      sun: 0xffedc1,
      power: 3.1,
      pos: [-30, 55, 20],
      exposure: 1.18,
      label: "SABAH",
    },
    {
      sky: 0xd9d3be,
      sun: 0xffbf79,
      power: 3.5,
      pos: [-42, 24, 15],
      exposure: 1.06,
      label: "ALTIN SAAT",
    },
    {
      sky: 0xaab9c4,
      sun: 0xe6efff,
      power: 1.2,
      pos: [-25, 70, -20],
      exposure: 1.16,
      label: "BULUTLU",
    },
  ];
  const m = moods[atmosphere];
  scene.background.set(m.sky);
  scene.fog.color.set(m.sky);
  sun.color.set(m.sun);
  sun.intensity = m.power;
  sun.position.set(...m.pos);
  renderer.toneMappingExposure = m.exposure * (isMobile() ? 1 : 0.86);
  $("lightBtn").textContent = m.label;
}
function applyArrivalContext() {
  const params = new URLSearchParams(location.search),
    reason = params.get("reason");
  const copy = {
    404: [
      "404 · BURADA HENÜZ BİR YOL YOK",
      "Sayfa bulunamadı.",
      "Ama bir şantiye buldun. Madem buradasın, bir şeyler inşa et.",
    ],
    wip: [
      "WIP · İNŞAAT DEVAM EDİYOR",
      "Bu sayfa yapılıyor.",
      "Beklerken sen de bir şeyler inşa et. İş makineleri emrinde.",
    ],
    unreachable: [
      "YOL ŞU AN KAPALI",
      "Şimdilik ulaşılamıyor.",
      "Burada yol yapmak serbest. Bir makine seç, kendi yolunu aç.",
    ],
  };
  if (params.get("lang") === "en") {
    Object.assign(copy, {
      404: [
        "404 · NO ROAD HERE YET",
        "Page not found.",
        "But you found a construction site. Build something while you are here.",
      ],
      wip: [
        "WIP · WORK IN PROGRESS",
        "This page is being built.",
        "A little sand. A few big machines. Build something while you wait.",
      ],
      unreachable: [
        "THIS ROAD IS CURRENTLY CLOSED",
        "Currently unreachable.",
        "Building roads is allowed here. Pick a machine and make your own way.",
      ],
    });
  }
  if (!copy[reason]) return;
  const [tag, title, description] = copy[reason];
  $("arrivalBadge").textContent = tag;
  $("welcomeTitle").textContent = title;
  $("welcomeDescription").textContent = description;
  $("arrivalPath").hidden = false;
  const path = params.get("from") || "";
  $("arrivalPath").textContent = path.slice(0, 140);
  $("routeContext").hidden = false;
  $("routeContext").textContent = tag;
}
$("undoBtn").onclick = undoWork;
$("lightBtn").onclick = () => setAtmosphere(atmosphere + 1);
$("cameraBtn").onclick = () => {
  if (!isMobile()) {
    cameraMode = 2;
    cameraPitch = 0.61;
    updateDesktopButtons();
  }
  cameraAngle = vCameraHeading();
  mapView = false;
};
$("zoomIn").onclick = () =>
  (cameraDistance = clamp(cameraDistance - 3, 10, 40));
$("zoomOut").onclick = () =>
  (cameraDistance = clamp(cameraDistance + 3, 10, 40));

function adjustBlade(delta) {
  const v = vehicles[selected];
  if (v.id !== "dozer") return;
  v.bladeOffset = clamp(v.bladeOffset + delta, -0.35, 0.55);
  dirty = true;
  updateUI();
}
$("bladeDown").onclick = () => adjustBlade(-0.05);
$("bladeUp").onclick = () => adjustBlade(0.05);

function adjustWidth(delta) {
  const v = vehicles[selected];
  if (v.id !== "dozer") return;
  v.bladeWidth = clampBladeWidth(v.bladeWidth + delta);
  dirty = true;
  updateUI();
}
$("widthDown").onclick = () => adjustWidth(-0.2);
$("widthUp").onclick = () => adjustWidth(0.2);
function updateQualityLabel() {
  const labels = {
    256: "Hafif",
    512: "Dengeli",
    768: "Pürüzsüz",
    1024: "En yüksek",
  };
  $("qualityBtn").textContent =
    "Yüzey: " + (labels[smoothGround?.segments] || "Uyumlu");
}
$("qualityBtn").hidden = !smoothGround;
$("qualityBtn").onclick = () => {
  if (!smoothGround) return;
  const i = SURFACE_QUALITIES.indexOf(smoothGround.segments);
  smoothGround.setQuality(
    SURFACE_QUALITIES[(i + 1) % SURFACE_QUALITIES.length],
  );
  dirty = true;
  updateQualityLabel();
};
updateQualityLabel();

function setRoad(plan) {
  roadPlan = plan;
  roadMeasure = null;
  lastRoadUI = -1;
  roadGuide.setPlan(plan);
  smoothGround?.setRoad(plan);
  if (plan) {
    $("roadWidth").value = String(plan.width);
    roadGuide.update(terrain, inspectionMode === 2);
  }
  dirty = true;
}
function updateRoadUI(force = false) {
  if (isMobile()) return;
  if (!force && elapsed - lastRoadUI < 0.4) return;
  lastRoadUI = elapsed;
  roadMeasure = roadPlan?.measure(terrain) || null;
  $("roadSummary").textContent = roadPlan
    ? `${roadPlan.length.toFixed(0)} m × ${roadPlan.width.toFixed(1)} m · ${roadMeasure.missing.toFixed(1)} m³ dolgu eksiği`
    : "Arazide iki nokta seçerek kendi hattını çiz.";
  const stages = $("roadStages").querySelectorAll("[data-stage]");
  stages.forEach((el, i) => {
    const amount = roadMeasure?.ratios[i] || 0;
    el.querySelector("output").textContent = roadMeasure
      ? "%" + Math.round(amount * 100)
      : "—";
    el.querySelector("em").style.width = amount * 100 + "%";
    el.classList.toggle("current", i === roadMeasure?.stage);
  });
  $("roadStations").innerHTML = (roadMeasure?.stations || [])
    .map(
      (v) =>
        `<i style="background:${v > 0.9 ? "#8fba93" : v > 0.2 ? "#bcaa64" : "#3b4d40"}"></i>`,
    )
    .join("");
  const advice = [
    "Kamyonla çukurları doldur. Şerit dökümü için X; yük bitince R.",
    "Dozerle tesviye yap. Bıçak hat kotunu izler; fazlalık öne taşınır.",
    "Asfalt sericiyle yavaşça ilerle. Arkandaki gevşek katmanı izle.",
    "Silindirle iki kenarı da geç. Sıkışma görünümü eksik yerleri gösterir.",
    "Yol hazır. Üzerinden sür, yeni bir hat çiz veya serbestçe devam et.",
  ];
  $("roadAdvice").textContent = roadMeasure
    ? advice[roadMeasure.stage]
    : "Kılavuz olmadan da bütün makineler kullanılabilir.";
  const machine = roadMeasure ? [0, 2, 4, 3, 3][roadMeasure.stage] : 0;
  $("prepareMachineBtn").textContent = MACHINES[machine].short + " hazırla ↗";
  for (const id of [
    "prepareMachineBtn",
    "roadStartBtn",
    "roadEndBtn",
    "clearRoadBtn",
  ]) {
    $(id).disabled = !roadPlan;
  }
  if (roadPlan) roadGuide.update(terrain, inspectionMode === 2);
}
function updateDesktopButtons() {
  $("workCameraBtn").innerHTML =
    (cameraMode === 1 ? "Otomatik takip açık" : "Serbest kamera") +
    " <kbd>O</kbd>";
  $("inspectionBtn").innerHTML =
    "Görünüm: " +
    ["Malzeme", "Sıkışma", "Kot"][inspectionMode] +
    " <kbd>V</kbd>";
  $("workGearBtn").innerHTML =
    (workGear ? "İş vitesi açık" : "Serbest sürüş") + " <kbd>B</kbd>";
  $("workGearBtn").setAttribute("aria-pressed", String(workGear));
  $("equipmentBtn").innerHTML =
    (equipmentLatched ? "Ekipmanı kapat" : "Ekipmanı aç") + " <kbd>F</kbd>";
  $("equipmentBtn").setAttribute("aria-pressed", String(equipmentLatched));
  if (smoothGround) {
    smoothGround.uniforms.uDesktopDetail.value = isMobile() ? 0 : 1;
    smoothGround.uniforms.uInspection.value = isMobile() ? 0 : inspectionMode;
  }
}
function cycleWorkCamera() {
  cancelPlanning();
  cameraMode = cameraMode === 1 ? 2 : 1;
  mapView = false;

  updateDesktopButtons();
}
function cycleInspection() {
  inspectionMode = (inspectionMode + 1) % 3;
  updateDesktopButtons();
  updateRoadUI(true);
  toast(
    [
      "Malzeme görünümü",
      "Sıkışma: turuncu gevşek · yeşil sıkışmış",
      "Kot: mavi eksik · turuncu fazla · yeşil uygun",
    ][inspectionMode],
  );
}
function toggleWorkGear() {
  workGear = !workGear;
  updateDesktopButtons();
}
function toggleEquipment() {
  if (!canPlay()) return;
  equipmentLatched = !equipmentLatched;
  updateDesktopButtons();
}
function cancelPlanning() {
  if (planning) mapView = false;
  planning = false;
  planDraft = null;
  planningLine.visible = false;
  document.body.classList.remove("planning");
  $("planRoadBtn").textContent = "＋ Hat çiz";
}
function pointerTerrain(e) {
  const r = renderer.domElement.getBoundingClientRect(),
    raycaster = new T.Raycaster();
  raycaster.setFromCamera(
    new T.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      1 - ((e.clientY - r.top) / r.height) * 2,
    ),
    camera,
  );
  return intersectTerrain(raycaster.ray, terrain);
}
function placeRoadPoint(e) {
  const p = pointerTerrain(e);
  if (!p) {
    toast("Saha içinde bir nokta seç.");
    return;
  }
  if (!planDraft) {
    planDraft = { ...p, h: p.h + 0.18 };
    toast("Şimdi bitişi seç · 6–60 m · ESC iptal");
    return;
  }
  try {
    setRoad(
      new RoadPlan(
        planDraft,
        { ...p, h: p.h + 0.18 },
        Number($("roadWidth").value),
      ),
    );
    cancelPlanning();
    mapView = false;
    cameraMode = 2;
    updateRoadUI(true);
    toast("Hat çizildi. Arazi değişmedi; çalışmaya başlayabilirsin.");
  } catch (error) {
    toast(error.message);
  }
}
function previewRoadPoint(e) {
  const p = pointerTerrain(e);
  if (!p) return;
  const positions = planningLine.geometry.attributes.position;
  positions.setXYZ(0, planDraft.x, planDraft.h + 0.1, planDraft.z);
  positions.setXYZ(1, p.x, p.h + 0.28, p.z);
  positions.needsUpdate = true;
  planningLine.visible = true;
}
function alignToRoad(atEnd = false) {
  if (!roadPlan) return false;
  clearKeys();
  cancelPlanning();
  const v = vehicles[selected],
    placement = roadPlacement(roadPlan, v, atEnd, Number($("roadLane").value));
  const { x, z, angle } = placement;
  if (
    Math.abs(x) > 45 ||
    Math.abs(z) > 45 ||
    [...vehicles, ...obstacles].some(
      (o) => o !== v && Math.hypot(x - o.x, z - o.z) < 1.5 + (o.radius ?? 1.45),
    )
  ) {
    toast("Bu konum dolu veya sınır dışında. Diğer uç/şeridi seç.");
    return false;
  }
  v.lastTrack = null;
  v.x = x;
  v.z = z;
  v.angle = angle;
  v.speed = 0;
  v.bladeDatum = placement.datum;
  if (v.id === "dozer") {
    v.unload = true;
    v.bladeOffset = 0;
  }
  if (v.id === "truck") v.unload = true;
  mapView = false;
  cameraMode = 2;
  cameraDistance = 15;
  cameraAngle = angle + 0.85;
  updateMode();
  updateDesktopButtons();
  updateCamera(1, true);
  dirty = true;
  return true;
}
$("planRoadBtn").onclick = () => {
  if (planning) {
    cancelPlanning();
    return;
  }
  clearKeys();
  planning = true;
  planDraft = null;
  mapView = true;
  document.body.classList.add("planning");
  $("planRoadBtn").textContent = "Çizimi iptal et";
  toast("Arazide yolun başlangıcına tıkla · ESC iptal");
};
$("clearRoadBtn").onclick = () => {
  cancelPlanning();
  setRoad(null);
  updateRoadUI(true);
  toast("Kılavuz kaldırıldı. Yaptığın yol arazide duruyor.");
};
$("roadWidth").onchange = () => {
  if (roadPlan) {
    setRoad(
      new RoadPlan(roadPlan.start, roadPlan.end, Number($("roadWidth").value)),
    );
    updateRoadUI(true);
  }
};
$("roadStartBtn").onclick = () => alignToRoad(false);
$("roadEndBtn").onclick = () => alignToRoad(true);
$("prepareMachineBtn").onclick = () => {
  if (!roadPlan) return;
  clearKeys();
  const previous = selected,
    old = vehicles[previous],
    before = { x: old.x, z: old.z, angle: old.angle };
  let parking = null;
  for (const x of [7, 11, 15])
    for (let z = 24; z >= -24; z -= 5.4) {
      if (
        !parking &&
        ![...vehicles, ...obstacles].some(
          (o) =>
            o !== old &&
            Math.hypot(x - o.x, z - o.z) < 1.5 + (o.radius ?? 1.45),
        )
      )
        parking = { x, z };
    }
  if (!parking) {
    toast("Park alanı dolu. Makineleri elle yerleştirebilirsin.");
    return;
  }
  Object.assign(old, parking, { angle: 0 });
  roadMeasure = roadPlan.measure(terrain);
  const i = [0, 2, 4, 3, 3][roadMeasure.stage];
  select(i);
  if (alignToRoad(false)) {
    const next = vehicles[i];
    if (next.capacity) next.cargo = next.capacity;
    toast(next.name + " hazır · SPACE çalıştır · WASD sür");
  } else {
    Object.assign(old, before);
    select(previous);
  }
};
$("workCameraBtn").onclick = cycleWorkCamera;
$("inspectionBtn").onclick = cycleInspection;
$("workGearBtn").onclick = toggleWorkGear;
$("equipmentBtn").onclick = toggleEquipment;

$("desktopHelpBtn").onclick = () => openDialog("helpDialog");
