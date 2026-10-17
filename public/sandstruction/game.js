import * as T from "./vendor/three.module.js";
import {
  Terrain,
  N,
  SIZE,
  CELL,
  MATERIALS,
  clamp,
  random,
} from "./terrain.js?v=0.2.0";
import { MACHINES, machineModel, fleetIcon } from "./models.js?v=0.2.0";
import { stepVehicle } from "./physics.js?v=0.2.0";
import { plantForest } from "./nature.js?v=0.2.0";
const $ = (id) => document.getElementById(id),
  keys = new Set(),
  SAVE_KEY = "sandstruction-save-v2";
const LEGACY_KEY = "zemin-sandbox-v0.1",
  undoStack = [];
let workStarted = false,
  trackDistance = 0,
  atmosphere = 0,
  obstacles = [];
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
  orbiting = false,
  pointerX = 0,
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
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
$("world").appendChild(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(0xc8d8d2);
scene.fog = new T.Fog(0xc8d8d2, 75, 175);
const camera = new T.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 260);
const hemi = new T.HemisphereLight(0xf1f0dc, 0x647157, 2.3);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffedc1, 3.1);
sun.position.set(-30, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
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
const ground = new T.Mesh(
  terrainGeo,
  new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    flatShading: true,
    map: groundTexture(),
  }),
);
ground.receiveShadow = true;
scene.add(ground);
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
const dustGeo = new T.BoxGeometry(0.09, 0.09, 0.09),
  dustMat = new T.MeshStandardMaterial({ color: 0xc8ac72, roughness: 1 });
const particles = new T.InstancedMesh(dustGeo, dustMat, 160);
particles.instanceMatrix.setUsage(T.DynamicDrawUsage);
particles.frustumCulled = false;
scene.add(particles);
const dust = Array.from({ length: 160 }, () => ({
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
  ctx.fillText("SANDSTRUCTION / 0.2", 28, 207);
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
  const p = terrainGeo.attributes.position;
  const c = new T.Color(),
    patchColor = new T.Color(0xa6a47a),
    phase = random(terrain.seed)() * 20;
  for (let i = 0; i < p.count; i++) {
    p.setY(i, terrain.h[i]);
    const [x, z] = terrain.coord(i);
    const material = terrain.mat[i];
    if (material === 0) {
      const variation = Math.sin(x * 0.73 + z * 0.52) * 0.5 + 0.5;
      c.set(0x87936a).lerp(patchColor, variation * 0.45);
      if (Math.abs(x - 6 * Math.sin(z * 0.065 + phase)) < 3.6) c.set(0x999172);
    } else {
      c.set(MATERIALS[material].color);
      const v = Math.sin(x * 7.1 + z * 3.7) * 0.035;
      c.offsetHSL(0, 0, v - terrain.compact[i] * 0.07);
    }
    c.multiplyScalar(1 - terrain.marks[i] * 0.25);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  p.needsUpdate = true;
  terrainGeo.attributes.color.needsUpdate = true;
  terrainGeo.computeVertexNormals();
  terrainGeo.computeBoundingSphere();
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
      terrain.h[a],
      z,
      xx,
      terrain.h[b],
      zz,
      x,
      -3.5,
      z,
      xx,
      terrain.h[b],
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
    const x = state?.x ?? -32 + (i % 3) * 4.6,
      z = state?.z ?? 27 + Math.floor(i / 3) * 6;
    const v = {
      ...def,
      ...model,
      x: clamp(x, -45, 45),
      z: clamp(z, -45, 45),
      angle: state?.angle ?? -0.5,
      speed: 0,
      cargo: clamp(
        state?.cargo ?? (i === 0 || i === 4 ? def.capacity : 0),
        0,
        def.capacity,
      ),
      material: state?.material ?? (i === 4 ? 3 : 1),
      unload: state?.unload ?? false,
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
  keys.delete(" ");
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
  $("refillBtn").hidden = !["truck", "paver"].includes(v.id);
  $("modeBtn").hidden = !["loader", "shovel", "dozer"].includes(v.id);
  $("loadLabel").textContent = v.capacity ? "HAZNE YÜKÜ" : "İŞLENEN HACİM";
  updateMode();
  updateUI();
}
function updateMode() {
  const v = vehicles[selected];
  $("modeBtn").innerHTML =
    (v.unload ? "Boşaltma modu" : "Kazı modu") + " <span>X</span>";
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
          : 2.5;
  return {
    x: v.x - Math.sin(v.angle) * reach,
    z: v.z - Math.cos(v.angle) * reach,
  };
}
function spawnDust(x, z, material, count = 3) {
  particles.material.color.set(MATERIALS[material]?.color ?? 0x9b8461);
  for (let i = 0; i < count; i++) {
    const d = dust[dustCursor++ % dust.length];
    Object.assign(d, {
      x: x + (Math.random() - 0.5) * 1.5,
      z: z + (Math.random() - 0.5) * 1.5,
      y: terrain.sample(x, z) + 0.2,
      life: 0.35 + Math.random() * 0.45,
      vx: (Math.random() - 0.5) * 1.6,
      vz: (Math.random() - 0.5) * 1.6,
      vy: 1 + Math.random() * 2,
    });
  }
}
let warningAt = -10;
function operate(v, dt) {
  const p = toolPosition(v),
    id = v.id;
  let amount = 0;
  if (id === "truck") {
    amount = Math.min(v.cargo, 1.8 * dt);
    terrain.deposit(p.x, p.z, 1.55, amount, v.material);
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
    amount = v.unload
      ? terrain.level(p.x, p.z, 1.9, dt * 1.5)
      : terrain.push(
          p.x,
          p.z,
          v.angle,
          terrain.sample(v.x, v.z) + 0.12,
          dt * Math.max(0, v.speed) * 0.8,
        );
    stats.moved += amount;
  } else if (id === "roller") {
    amount = terrain.roll(p.x, p.z, 1.5, dt * 0.8);
    if (amount > 0) terrain.level(p.x, p.z, 1.1, dt * 0.08);
  } else if (id === "paver") {
    amount = terrain.ribbon(
      p.x,
      p.z,
      v.angle,
      3.1,
      1.2,
      Math.min(v.cargo, 0.28 * Math.abs(v.speed) * dt),
    );
    v.cargo -= amount;
  }
  if (amount > 0.00001) {
    changed = true;
    dirty = true;
    if (Math.random() < 0.65)
      spawnDust(p.x, p.z, v.id === "paver" ? 3 : v.material, 3);
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
      forward: keys.has("w") || keys.has("arrowup"),
      backward: keys.has("s") || keys.has("arrowdown"),
      left: keys.has("a") || keys.has("arrowleft"),
      right: keys.has("d") || keys.has("arrowright"),
      brake: keys.has("shift"),
    },
    terrain,
    [...vehicles, ...obstacles],
    dt,
  );
  if (motion.distance > 0) dirty = true;
  trackDistance += motion.distance;
  if (trackDistance > 0.22 && v.id !== "shovel") {
    trackDistance = 0;
    for (const side of [-1, 1])
      if (
        terrain.track(
          v.x + Math.cos(v.angle) * side * 0.95,
          v.z - Math.sin(v.angle) * side * 0.95,
          0.3,
        )
      )
        changed = true;
  }
  working = keys.has(" ") && started && !document.querySelector("dialog[open]");
  if (working && !workStarted) rememberWork();
  workStarted = working;
  if (working) operate(v, dt);
  if (keys.has("q")) cameraAngle += dt * 1.3;
  if (keys.has("e")) cameraAngle -= dt * 1.3;
  vehicles.forEach((m, i) => {
    m.group.position.y = T.MathUtils.damp(
      m.group.position.y,
      terrain.sample(m.x, m.z),
      12,
      dt,
    );
    m.group.position.x = m.x;
    m.group.position.z = m.z;
    for (const wheel of m.wheels) {
      const spin = wheel.userData.spin || wheel;
      spin.rotation.x -= (m.speed * dt) / (wheel.userData.radius || 0.67);
      if (wheel.userData.front) wheel.rotation.y = m.steer || 0;
    }
    m.group.rotation.y = m.angle;
    const dx = -Math.sin(m.angle),
      dz = -Math.cos(m.angle),
      front = terrain.sample(m.x + dx * 1.3, m.z + dz * 1.3),
      rear = terrain.sample(m.x - dx * 1.3, m.z - dz * 1.3),
      left = terrain.sample(m.x + dz * 0.8, m.z - dx * 0.8),
      right = terrain.sample(m.x - dz * 0.8, m.z + dx * 0.8);
    m.group.rotation.x = T.MathUtils.damp(
      m.group.rotation.x,
      clamp(Math.atan2(front - rear, 2.6), -0.38, 0.38),
      10,
      dt,
    );
    m.group.rotation.z = T.MathUtils.damp(
      m.group.rotation.z,
      clamp(Math.atan2(left - right, 1.6), -0.38, 0.38),
      10,
      dt,
    );
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
  toolRing.visible = started;
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
  lookTarget.set(v.x, terrain.sample(v.x, v.z) + 0.7, v.z);
  cameraTarget.lerp(lookTarget, instant ? 1 : 1 - Math.exp(-dt * 4));
  const dist = mapView ? 65 : cameraDistance;
  const desired = new T.Vector3(
    cameraTarget.x + Math.sin(cameraAngle) * dist * (mapView ? 0.12 : 0.78),
    cameraTarget.y + dist * (mapView ? 1.1 : 0.78),
    cameraTarget.z + Math.cos(cameraAngle) * dist * (mapView ? 0.12 : 0.78),
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
    dozer: "ZEMİN DÜZLENİYOR",
    roller: "MALZEME SIKIŞTIRILIYOR",
    paver: "ASFALT SERİLİYOR",
    shovel: v.unload ? "KÜREK BOŞALTILIYOR" : "KAZI YAPILIYOR",
  };
  $("workingText").textContent = action[v.id];
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3200);
}
function save(manual = false) {
  if (!started) return;
  try {
    const data = {
      version: 2,
      terrain: terrain.serialize(),
      vehicles: vehicles.map((v) => ({
        x: v.x,
        z: v.z,
        angle: v.angle,
        cargo: v.cargo,
        material: v.material,
        unload: v.unload,
      })),
      selected,
      stats,
      cameraAngle,
      cameraDistance,
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
      ![1, 2].includes(data.version) ||
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
    stats = {
      moved: Number.isFinite(data.stats?.moved) ? data.stats.moved : 0,
    };
    createVehicles(data.vehicles);
    selected = clamp(Math.trunc(data.selected) || 0, 0, 5);
    cameraAngle = Number.isFinite(data.cameraAngle) ? data.cameraAngle : 0.68;
    cameraDistance = clamp(data.cameraDistance || 19, 10, 40);
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
  terrain = new Terrain(seed);
  stats = { moved: 0 };
  undoStack.length = 0;
  workStarted = false;
  $("undoBtn").disabled = true;
  createVehicles();
  selected = 0;
  cameraAngle = 0.68;
  cameraDistance = 22;
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
  keys.clear();
  updateCamera(1, true);
  toast("WASD ile sür · SPACE ile çalıştır · 1–6 ile makine değiştir");
  save();
}
function clearKeys() {
  keys.clear();
  working = false;
  vehicles.forEach((v) => (v.speed = 0));
  workStarted = false;
}
function openDialog(id) {
  clearKeys();
  $(id).showModal();
}
function toggleMode() {
  const v = vehicles[selected];
  if (!["loader", "shovel", "dozer"].includes(v.id)) return;
  v.unload = !v.unload;
  updateMode();
  dirty = true;
  if (v.id === "dozer") {
    toast(
      v.unload
        ? "Tesviye modu · kot farkını azalt"
        : "İtme modu · SPACE basılıyken ileri sür",
    );
    return;
  }
  toast(
    v.unload
      ? "Boşaltma modu · SPACE basılı tut"
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
    ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) ||
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
  keys.add(k);
  if (e.repeat) return;
  if (/^[1-6]$/.test(k)) select(+k - 1);
  if (k === "tab") select((selected + 1) % 6);
  if (k === "x") toggleMode();
  if (k === "r") refill();
  if (k === "m") mapView = !mapView;
  if (k === "g") grid.visible = !grid.visible;
  if (k === "h") openDialog("helpDialog");
  if (k === "z") undoWork();
  if (k === "c") {
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
  if (e.button === 2) {
    orbiting = true;
    pointerX = e.clientX;
    renderer.domElement.setPointerCapture(e.pointerId);
  }
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (orbiting) {
    cameraAngle -= (e.clientX - pointerX) * 0.007;
    pointerX = e.clientX;
  }
});
renderer.domElement.addEventListener("pointerup", () => (orbiting = false));
renderer.domElement.addEventListener("pointercancel", () => (orbiting = false));
renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    cameraDistance = clamp(cameraDistance + e.deltaY * 0.025, 10, 40);
  },
  { passive: false },
);
document.querySelectorAll("[data-key]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!started) return;
    keys.add(b.dataset.key);
    b.setPointerCapture(e.pointerId);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(event, () => keys.delete(b.dataset.key));
});
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
$("mapBtn").onclick = () => (mapView = !mapView);
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
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
});
window.addEventListener("pagehide", () => {
  if (dirty) save();
});
buildFleetUI();
newWorld(3817);
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
  elapsed += dt;
  terrainTimer += dt;
  autoSaveElapsed += dt;
  if (started && !document.querySelector("dialog[open]")) drive(dt);
  else {
    working = false;
    if (engineGain)
      engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    vehicles.forEach((v) => {
      v.group.position.set(v.x, terrain.sample(v.x, v.z), v.z);
      v.group.rotation.y = v.angle;
    });
  }
  if (changed && terrainTimer > 0.055) {
    updateTerrain();
    terrainTimer = 0;
  }
  updateCamera(dt);
  for (let i = 0; i < dust.length; i++) {
    const p = dust[i];
    p.life -= dt;
    if (p.life > 0) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.vy -= 4 * dt;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.life * 1.5);
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
  tex.repeat.set(80, 80);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function rememberWork() {
  undoStack.push({
    h: terrain.h.slice(),
    mat: terrain.mat.slice(),
    compact: terrain.compact.slice(),
    marks: terrain.marks.slice(),
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
  terrain.h.set(prev.h);
  terrain.mat.set(prev.mat);
  terrain.compact.set(prev.compact);
  terrain.marks.set(prev.marks);
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
  renderer.toneMappingExposure = m.exposure;
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
  if(params.get("lang")==="en") {
    Object.assign(copy,{
      "404":["404 · NO ROAD HERE YET","Page not found.","But you found a construction site. Build something while you are here."],
      wip:["WIP · WORK IN PROGRESS","This page is being built.","A little sand. A few big machines. Build something while you wait."],
      unreachable:["THIS ROAD IS CURRENTLY CLOSED","Currently unreachable.","Building roads is allowed here. Pick a machine and make your own way."]
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
  cameraAngle = vCameraHeading();
  mapView = false;
};
$("zoomIn").onclick = () =>
  (cameraDistance = clamp(cameraDistance - 3, 10, 40));
$("zoomOut").onclick = () =>
  (cameraDistance = clamp(cameraDistance + 3, 10, 40));
