import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../../public/sandstruction/vendor/three.module.js";
import { Terrain, N, SIZE, CELL } from "../../public/sandstruction/terrain.js";
import {
  splineWeights,
  splineDerivatives,
  sampleSpline,
  sampleSplineGradient,
} from "../../public/sandstruction/cubic-surface.js";
import { SurfaceField } from "../../public/sandstruction/surface-field.js";
import {
  configureSurfaceShader,
  SURFACE_QUALITIES,
} from "../../public/sandstruction/smooth-terrain.js";
import { machineModel, clampBladeWidth } from "../../public/sandstruction/models.js";
import { stepVehicle } from "../../public/sandstruction/physics.js";
const mass = (t) => t.h.reduce((s, h) => s + h * CELL * CELL, 0);
function flat() {
  const t = new Terrain();
  for (const name of ["h", "mat", "compact", "marks", "loose"]) t[name].fill(0);
  t.active = null;
  return t;
}
test("cubic weights form a positive partition and derivatives sum to zero", () => {
  for (let i = 0; i <= 100; i++) {
    const w = splineWeights(i / 100),
      d = splineDerivatives(i / 100);
    assert.ok(w.every((v) => v >= -1e-12));
    assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    assert.ok(Math.abs(d.reduce((a, b) => a + b, 0)) < 1e-12);
  }
});
test("reconstructed height and slope stay continuous at a stepped simulation cell", () => {
  const t = flat();
  for (let z = 0; z <= N; z++)
    for (let x = N / 2; x <= N; x++) t.h[t.index(x, z)] = 1;
  for (let k = -100; k <= 100; k++) {
    const h = t.sample(k * 0.01, 0);
    assert.ok(h >= -1e-12 && h <= 1 + 1e-12);
  }
  const a = sampleSplineGradient(t.h, -1e-6, 0, N, SIZE),
    b = sampleSplineGradient(t.h, 1e-6, 0, N, SIZE);
  assert.ok(Math.abs(a.height - b.height) < 0.00001);
  assert.ok(Math.abs(a.dx - b.dx) < 0.0001);
  const p = 0.07,
    epsilon = 0.00001,
    g = sampleSplineGradient(t.h, p, 0, N, SIZE),
    finite =
      (t.sample(p + epsilon, 0) - t.sample(p - epsilon, 0)) / (2 * epsilon);
  assert.ok(Math.abs(g.dx - finite) < 1e-6);
});
test("curved display reproduces planes and does not mutate simulation volume", () => {
  const t = flat();
  for (let i = 0; i < t.h.length; i++) {
    const [x, z] = t.coord(i);
    t.h[i] = 0.2 + x * 0.12 - z * 0.17;
  }
  const before = mass(t);
  for (const [x, z] of [
    [0, 0],
    [3.13, -4.19],
    [-11.2, 9.4],
  ]) {
    const p = sampleSplineGradient(t.h, x, z, N, SIZE);
    assert.ok(Math.abs(p.height - (0.2 + x * 0.12 - z * 0.17)) < 0.000001);
    assert.ok(Math.abs(p.dx - 0.12) < 0.000001);
    assert.ok(Math.abs(p.dz + 0.17) < 0.000001);
  }
  assert.equal(mass(t), before);
});
test("packed GPU field keeps displayed height continuous between updates", () => {
  const t = flat(),
    f = new SurfaceField();
  t.h.fill(1);
  f.update(t, 1, true);
  t.h.fill(2);
  f.update(t, 1, false);
  t.h.fill(3);
  f.update(t, 0.5, false);
  assert.equal(f.data[0], 1.5);
  assert.equal(f.data[1], 3);
  assert.equal(f.color[3], 255);
  assert.ok(f.color.every(Number.isFinite));
  const target = new Float32Array(t.h.length);
  for (let i = 0; i < target.length; i++) target[i] = f.data[i * 4 + 1];
  assert.equal(sampleSpline(target, 0, 0, N, SIZE), t.sample(0, 0));
});
test("surface shader hooks preserve Three normals, lighting and custom height/color stages", () => {
  const shader = {
    uniforms: {},
    vertexShader: T.ShaderLib.standard.vertexShader,
    fragmentShader: T.ShaderLib.standard.fragmentShader,
  };
  configureSurfaceShader(shader, { uTerrainBlend: { value: 1 } });
  assert.ok(shader.vertexShader.includes("objectNormal=ssTerrain.normal"));
  assert.ok(
    shader.vertexShader.indexOf("SS_Terrain ssTerrain=") <
      shader.vertexShader.indexOf("transformed.y=ssTerrain.height"),
  );
  assert.ok(shader.vertexShader.includes("#include <defaultnormal_vertex>"));
  assert.ok(
    shader.fragmentShader.includes("diffuseColor.rgb*=SS_color(vSurfaceGrid)"),
  );
  assert.ok(
    shader.fragmentShader.includes(
      "dHdxy_fwd()*mix(1.0,0.12,vSurfaceCompaction)",
    ),
  );
  assert.deepEqual(SURFACE_QUALITIES, [512, 768, 1024]);
});
test("dozer widths clamp safely, change the processed footprint and conserve mass", () => {
  assert.equal(clampBladeWidth(undefined), 3.2);
  assert.equal(clampBladeWidth(0.1), 1.2);
  assert.equal(clampBladeWidth(20), 6);
  const removed = [];
  for (const width of [1.2, 6]) {
    const t = flat();
    t.h.fill(0.5);
    t.loose.fill(0.5);
    t.mat.fill(2);
    const before = mass(t);
    removed.push(t.push(0, 0, 0, 0, 0.2, width));
    assert.ok(Math.abs(mass(t) - before) < 0.0005);
    const outside = t.nearest(width / 2 + 0.5, 0);
    assert.equal(t.h[outside], 0.5);
  }
  assert.ok(removed[1] > removed[0] * 3);
});
test("blade model changes width without stretching chassis or mounting beams", () => {
  const model = machineModel("dozer");
  assert.equal(model.bladeParts.length, 2);
  for (const width of [1.2, 3.2, 6]) {
    for (const part of model.bladeParts) {
      part.scale.x = width / 3.2;
      part.geometry.computeBoundingBox();
      const size = part.geometry.boundingBox.getSize(new T.Vector3());
      assert.ok(Math.abs(size.x * part.scale.x - width) < 1e-6);
    }
    assert.equal(model.group.scale.x, 1);
  }
});
test("wide dozer blade respects obstacles outside the narrow chassis", () => {
  const t = flat(),
    obstacle = { id: "rock", radius: 0.3, x: 2.1, z: -4 };
  const run = (width) => {
    const v = {
      id: "dozer",
      x: 0,
      z: 0,
      angle: 0,
      speed: 0,
      max: 3.2,
      bladeWidth: width,
    };
    for (let i = 0; i < 180; i++)
      stepVehicle(v, { forward: true }, t, [obstacle], 1 / 60);
    return v.z;
  };
  const narrow = run(1.2),
    wide = run(6);
  assert.ok(narrow < -4);
  assert.ok(wide > -2);
});
