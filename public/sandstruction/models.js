import * as T from "./vendor/three.module.js";
const material = (color, roughness = 0.8) =>
  new T.MeshStandardMaterial({ color, roughness });
const yellow = material(0xe4b843),
  dark = material(0x303a36),
  black = material(0x222a29),
  metal = material(0x9ca6a0),
  glass = material(0x577c7a, 0.3),
  orange = material(0xf09c39),
  cream = material(0xe9e3cd);
function box(g, x, y, z, w, h, d, m = yellow) {
  const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
  return o;
}
function cyl(g, x, y, z, r, len, m = black) {
  const o = new T.Mesh(new T.CylinderGeometry(r, r, len, 24), m);
  o.rotation.z = Math.PI / 2;
  o.position.set(x, y, z);
  o.castShadow = true;
  g.add(o);
  return o;
}
function wheel(g, x, z, r = 0.55) {
  const pivot = new T.Group(),
    o = new T.Group();
  pivot.position.set(x, r, z);
  pivot.add(o);
  g.add(pivot);
  pivot.userData.radius = r;
  pivot.userData.front = z < 0;
  pivot.userData.spin = o;
  cyl(o, 0, 0, 0, r, 0.35);
  cyl(o, Math.sign(x) * 0.19, 0, 0, r * 0.48, 0.035, metal);
  for (let j = 0; j < 12; j++) {
    const a = (j * Math.PI) / 6;
    const tread = box(
      o,
      0,
      Math.cos(a) * r,
      Math.sin(a) * r,
      0.39,
      0.08,
      0.16,
      dark,
    );
    tread.rotation.x = a;
  }
  return pivot;
}
function cab(g, x, y, z, w = 1.45) {
  box(g, x, y, z, w, 1.25, 1.45);
  box(g, x, y + 0.18, z - 0.03, w + 0.025, 0.77, 1.16, glass);
  box(g, x, y + 0.7, z, w + 0.2, 0.12, 1.65);
  box(g, x - w / 2, y + 0.15, z, 0.07, 1.05, 1.5);
  box(g, x + w / 2, y + 0.15, z, 0.07, 1.05, 1.5);
  box(g, x, y + 0.1, z - 0.75, w, 0.07, 0.06);
  box(g, x, y + 0.1, z + 0.75, w, 0.07, 0.06);
  box(g, x, y + 0.87, z, 0.12, 0.18, 0.18, orange);
}
function tracks(g) {
  for (const x of [-1.05, 1.05]) {
    box(g, x, 0.46, 0, 0.56, 0.75, 3.4, black);
    for (let j = 0; j < 7; j++)
      cyl(g, x, 0.47, -1.3 + j * 0.43, 0.31, 0.6, dark);
    for (let j = 0; j < 15; j++) {
      box(g, x, 0.08, -1.5 + j * 0.22, 0.65, 0.1, 0.13, metal);
      box(g, x, 0.86, -1.5 + j * 0.22, 0.65, 0.1, 0.13, dark);
    }
  }
}
function beam(g, a, b, width = 0.18, m = yellow) {
  const dir = new T.Vector3().subVectors(b, a);
  const o = new T.Mesh(new T.BoxGeometry(width, dir.length(), width), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
  o.castShadow = true;
  g.add(o);
  return o;
}
export const BLADE_MIN_WIDTH = 1.2,
  BLADE_MAX_WIDTH = 6,
  BLADE_DEFAULT_WIDTH = 3.2;
export function clampBladeWidth(value) {
  return Number.isFinite(value)
    ? Math.min(
        BLADE_MAX_WIDTH,
        Math.max(BLADE_MIN_WIDTH, Math.round(value * 5) / 5),
      )
    : BLADE_DEFAULT_WIDTH;
}
export const MACHINES = [
  {
    id: "truck",
    name: "Damperli kamyon",
    short: "Kamyon",
    code: "HAULER",
    role: "Taşı & dök",
    desc: "Malzemeyi taşı. İstediğin yere dök.",
    capacity: 12,
    max: 6,
    tool: "Basılı tut → arkaya malzeme dök",
  },
  {
    id: "loader",
    name: "Lastikli kepçe",
    short: "Kepçe",
    code: "LOADER",
    role: "Kaz & taşı",
    desc: "Kaz, taşı, başka bir yerde boşalt.",
    capacity: 3,
    max: 4.5,
    tool: "Basılı tut → öndeki zemini kaz",
  },
  {
    id: "dozer",
    name: "Paletli dozer",
    short: "Dozer",
    code: "DOZER",
    role: "Yay & düzle",
    desc: "Malzemeyi öne it. X ile tesviyeye geç.",
    capacity: 0,
    max: 3.2,
    tool: "Basılı tut ve ileri sür → malzemeyi it",
  },
  {
    id: "roller",
    name: "Yol silindiri",
    short: "Silindir",
    code: "ROLLER",
    role: "Sıkıştır",
    desc: "Dökülen malzemenin üstünden geç.",
    capacity: 0,
    max: 3.5,
    tool: "Basılı tut ve ilerle → malzemeyi sıkıştır",
  },
  {
    id: "paver",
    name: "Asfalt serici",
    short: "Asfalt serici",
    code: "PAVER",
    role: "Yolu bitir",
    desc: "Arkanda ince bir asfalt katmanı bırak.",
    capacity: 16,
    max: 2.8,
    tool: "Basılı tut ve ilerle → asfalt ser",
  },
  {
    id: "shovel",
    name: "El küreği",
    short: "Kürek",
    code: "BY HAND",
    role: "İnce işçilik",
    desc: "Bazen bir kürek yeter.",
    capacity: 0.22,
    max: 3,
    tool: "Basılı tut → öndeki zemini kaz",
  },
];
export function machineModel(id) {
  const g = new T.Group();
  const wheels = [],
    bladeParts = [];
  let moving = null,
    load = null,
    arm = null;
  if (id === "truck") {
    box(g, 0, 0.7, 0, 1.8, 0.35, 4.1, dark);
    for (const x of [-1, 1])
      for (const z of [-1.35, 0.8, 1.5]) wheels.push(wheel(g, x, z, 0.54));
    cab(g, 0, 1.62, -1.2, 1.6);
    box(g, 0, 1, -2, 1.8, 0.4, 0.35);
    for (const x of [-0.65, 0.65]) box(g, x, 1, -2.2, 0.3, 0.16, 0.08, cream);
    moving = new T.Group();
    moving.position.set(0, 1.13, 1.85);
    g.add(moving);
    box(moving, 0, 0, -1.1, 2, 0.13, 2.7);
    for (const x of [-0.99, 0.99]) box(moving, x, 0.48, -1.1, 0.12, 0.95, 2.7);
    box(moving, 0, 0.48, -2.4, 2, 0.95, 0.13);
    box(moving, 0, 0.3, 0.2, 2, 0.6, 0.12);
    load = box(moving, 0, 0.45, -1.1, 1.78, 0.5, 2.35, material(0xd7ba7c));
  } else if (id === "loader") {
    for (const x of [-1, 1])
      for (const z of [-1.05, 1.05]) wheels.push(wheel(g, x, z, 0.64));
    box(g, 0, 1, 0, 1.7, 0.6, 2.7);
    cab(g, 0, 1.9, 0.3);
    box(g, 0, 1.3, 1.2, 1.7, 0.55, 0.75);
    arm = new T.Group();
    g.add(arm);
    for (const x of [-0.68, 0.68]) {
      beam(
        arm,
        new T.Vector3(x, 1.4, -0.5),
        new T.Vector3(x, 0.55, -2.1),
        0.19,
      );
      beam(
        arm,
        new T.Vector3(x, 1.15, 0),
        new T.Vector3(x, 0.75, -1.5),
        0.09,
        metal,
      );
    }
    moving = new T.Group();
    moving.position.set(0, 0.38, -2.05);
    arm.add(moving);
    box(moving, 0, 0, -0.33, 2.25, 0.12, 1.1);
    box(moving, 0, 0.3, 0.16, 2.25, 0.65, 0.12);
    for (const x of [-1.1, 1.1]) box(moving, x, 0.24, -0.32, 0.1, 0.48, 1.1);
    load = box(moving, 0, 0.22, -0.33, 1.9, 0.33, 0.8, material(0x9b8461));
  } else if (id === "dozer") {
    tracks(g);
    box(g, 0, 1.1, 0.05, 1.8, 0.7, 2.5);
    cab(g, 0, 2, 0.6);
    box(g, 0, 1.37, -0.85, 1.7, 0.6, 0.9);
    box(g, 0.6, 1.9, -1, 0.12, 0.8, 0.12, black);
    moving = new T.Group();
    g.add(moving);
    const blade = box(moving, 0, 0.56, -2.05, 3.2, 0.9, 0.22, metal);
    blade.rotation.x = -0.18;
    bladeParts.push(blade, box(moving, 0, 0.14, -2.12, 3.2, 0.12, 0.3, dark));
    for (const x of [-0.8, 0.8])
      beam(
        moving,
        new T.Vector3(x, 0.7, 0.2),
        new T.Vector3(x, 0.45, -2),
        0.12,
      );
  } else if (id === "roller") {
    box(g, 0, 0.85, 0.3, 1.7, 0.4, 2.5);
    for (const x of [-0.9, 0.9]) wheels.push(wheel(g, x, 1, 0.6));
    cab(g, 0, 1.8, 0.7);
    const drumPivot = new T.Group();
    drumPivot.position.set(0, 0.67, -1.25);
    g.add(drumPivot);
    const drum = cyl(drumPivot, 0, 0, 0, 0.67, 2.3, metal);
    drumPivot.userData.radius = 0.67;
    drumPivot.userData.spin = drumPivot;
    wheels.push(drumPivot);
    for (const x of [-1.2, 1.2]) box(g, x, 0.75, -0.8, 0.15, 0.22, 1.35);
    box(g, 0, 1.17, -0.25, 1.6, 0.3, 0.6);
  } else if (id === "paver") {
    tracks(g);
    box(g, 0, 1, 0.2, 1.9, 0.7, 2.6);
    box(g, 0, 1.3, -1.3, 2.5, 0.18, 1.5);
    for (const x of [-1.2, 1.2]) box(g, x, 1.6, -1.3, 0.15, 0.65, 1.5);
    box(g, 0, 1.6, -2, 2.5, 0.65, 0.12);
    box(g, 0, 1.05, 0.55, 1.7, 0.4, 0.5);
    box(g, 0, 1.65, 0.6, 0.65, 0.8, 0.7, black);
    box(g, 0, 2.7, 0.5, 2.1, 0.13, 1.9);
    for (const x of [-0.85, 0.85]) box(g, x, 2, 0.65, 0.09, 1.3, 0.09);
    box(g, 0, 0.25, 2, 3.1, 0.35, 0.75, dark);
    load = box(g, 0, 1.55, -1.3, 2.2, 0.4, 1.25, black);
  } else {
    const body = box(g, 0, 1, 0, 0.48, 0.7, 0.3, material(0xdc803f));
    box(g, 0, 1.52, 0, 0.28, 0.32, 0.27, material(0xc39970));
    box(g, 0, 1.72, 0, 0.4, 0.1, 0.36, yellow);
    for (const x of [-0.16, 0.16]) {
      box(g, x, 0.43, 0, 0.16, 0.65, 0.2, dark);
      box(g, x, 0.1, -0.06, 0.2, 0.16, 0.35, black);
    }
    arm = new T.Group();
    g.add(arm);
    beam(
      arm,
      new T.Vector3(0.22, 1.16, -0.05),
      new T.Vector3(0.35, 0.9, -0.5),
      0.13,
      body.material,
    );
    beam(
      arm,
      new T.Vector3(0.35, 0.9, -0.4),
      new T.Vector3(0.35, 0.26, -1.05),
      0.05,
      cream,
    );
    moving = box(arm, 0.35, 0.16, -1.1, 0.35, 0.08, 0.45, metal);
    load = box(arm, 0.35, 0.24, -1.1, 0.3, 0.12, 0.34, material(0x9b8461));
  }
  if (id !== "shovel") {
    const headlamp = material(0xffefba);
    headlamp.emissive.set(0xffd78a);
    headlamp.emissiveIntensity = 0.45;
    for (const x of [-0.68, 0.68]) {
      box(g, x, 1, -1.85, 0.22, 0.15, 0.08, headlamp);
      box(g, x, 0.95, 1.76, 0.18, 0.12, 0.08, material(0xb94f35));
    }
    // Safety stripes and a painted fleet number, built as geometry.
    for (let j = 0; j < 5; j++) {
      const stripe = box(
        g,
        -0.7 + j * 0.32,
        1.08,
        1.78,
        0.12,
        0.28,
        0.025,
        dark,
      );
      stripe.rotation.z = -0.45;
    }
    for (const x of [-0.93, 0.93]) {
      box(g, x, 1.45, 0.45, 0.025, 0.35, 0.57, cream);
      box(g, x * 1.015, 1.45, 0.45, 0.025, 0.24, 0.08, dark);
    }
  }
  return { group: g, wheels, moving, load, arm, bladeParts };
}
export function treeModel(scale = 1) {
  const g = new T.Group();
  cyl(g, 0, 1, 0, 0.13, 2, material(0x756753)).rotation.z = 0;
  for (let j = 0; j < 3; j++) {
    const mesh = new T.Mesh(
      new T.ConeGeometry((1.2 - j * 0.24) * scale, 1.8 * scale, 7),
      material([0x4f6a4b, 0x607a52, 0x748559][j]),
    );
    mesh.position.y = (1.8 + j * 0.75) * scale;
    mesh.castShadow = true;
    g.add(mesh);
  }
  return g;
}
export function fleetIcon(id) {
  const paths = {
    truck:
      "M7 24h51v-4H7z M9 19V9h13v11 M25 8h29l-3 13H25z M12 11h7v6h-7z M15 25a5 5 0 1 0 .1 0 M42 25a5 5 0 1 0 .1 0 M53 25a5 5 0 1 0 .1 0",
    loader:
      "M13 25h28v-9H28V7H16v15 M18 10h7v8h-7z M35 17l13 8 7-9 6 14H46L32 23 M17 24a6 6 0 1 0 .1 0 M38 24a6 6 0 1 0 .1 0",
    dozer:
      "M8 25h35a5 5 0 0 1 0 10H8a5 5 0 0 1 0-10z M11 24V14h29v10 M22 14V5h13v19 M25 7h7v7 M42 26l12-5V13h7v21h-7v-7z",
    roller:
      "M8 24h30V13H25V5H12v19 M15 8h7v10h-7 M40 18h12l6 9 M15 24a6 6 0 1 0 .1 0 M48 22a8 8 0 1 0 .1 0",
    paver:
      "M9 27h38a4 4 0 0 1 0 8H9a4 4 0 0 1 0-8z M10 27V14h16v11h21v-7H31 M26 14V6h28 M30 6v19 M49 6v20 M50 29h11v5H49",
    shovel:
      "M28 5h10v5c0 5-10 5-10 0V5z M33 14v13 M26 27h14v5c0 10-14 10-14 0v-5z",
  };
  return `<svg viewBox="0 0 68 42" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]}"/></svg>`;
}
