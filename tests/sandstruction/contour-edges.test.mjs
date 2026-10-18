import test from "node:test";
import assert from "node:assert/strict";
import { Terrain, N, SIZE } from "../../public/sandstruction/terrain.js";
import { sampleSpline, sampleSplineGradient } from "../../public/sandstruction/cubic-surface.js";
import {
  sampleContourGradient,
  shoulderCoverage,
} from "../../public/sandstruction/contour-surface.js";
import { SurfaceField } from "../../public/sandstruction/surface-field.js";
import { sharpenCoverage } from "../../public/sandstruction/road-material.js";

test("diagonal legacy cuts lose the cell-period shoulder shading without resampling saved terrain", () => {
  for (const slope of [0.2, 0.45, 0.8, 1.3]) {
    const t = new Terrain();
    for (let i = 0; i < t.h.length; i++) {
      const [x, z] = t.coord(i);
      t.h[i] = x > slope * z ? 1 : 0;
    }
    const snapshot = t.h.slice(),
      noise = [];
    for (const sampler of [sampleSplineGradient, sampleContourGradient]) {
      let tangent = 0,
        normal = 0;
      for (let z = -10; z < 10; z += 0.031) {
        const p = sampler(t.h, slope * z, z, N, SIZE);
        tangent += (p.dx * slope + p.dz) ** 2;
        normal += (p.dx - p.dz * slope) ** 2;
        assert.ok(p.height >= 0 && p.height <= 1);
      }
      noise.push(Math.sqrt(tangent / normal));
    }
    assert.ok(
      noise[1] < noise[0] * 0.42,
      `Grid ripple should fall by at least 58%, slope ${slope}`,
    );
    assert.deepEqual(t.h, snapshot);
  }
});

test("filtered GPU heights and normals match live CPU contact queries, including every map edge", () => {
  const t = new Terrain(57),
    f = new SurfaceField();
  t.deposit(0, 0, 1.2, 5, 1);
  const before = t.serialize(true);
  f.update(t, 1, true);
  const display = new Float32Array(t.h.length);
  for (let i = 0; i < display.length; i++) display[i] = f.data[4 * i + 1];
  for (const [x, z] of [
    [0, 0],
    [0.17, -0.29],
    [3.12, -5.91],
    [-48, -48],
    [-47.96, 48],
    [48, 2.71],
    [2, -48],
    [65, -70],
  ]) {
    const cpu = sampleContourGradient(t.h, x, z, N, SIZE),
      gpu = sampleSplineGradient(display, x, z, N, SIZE);
    assert.ok(
      Math.abs(t.sample(x, z) - sampleSpline(display, x, z, N, SIZE)) < 1e-6,
    );
    assert.ok(Math.abs(cpu.dx - gpu.dx) < 1e-6);
    assert.ok(Math.abs(cpu.dz - gpu.dz) < 1e-6);
  }
  assert.deepEqual(t.serialize(true), before);
});

test("rounded coverage keeps the road centre solid and confines colour transition to the shoulder", () => {
  const t = new Terrain(),
    f = new SurfaceField();
  t.mat.fill(0);
  t.compact.fill(0);
  for (let i = 0; i < t.h.length; i++) {
    const [x] = t.coord(i);
    if (Math.abs(x) < 1.6) t.mat[i] = 3;
  }
  f.update(t, 1, true);
  const asphalt = (x) => {
    const i = t.nearest(x, 0) * 4,
      raw = f.coverage[i + 2] / 255;
    return sharpenCoverage([1 - raw, raw])[1];
  };
  assert.equal(asphalt(0), 1);
  assert.ok(asphalt(1.125) > 0.98);
  assert.ok(asphalt(2.25) < 0.001);
  for (let d = 0; d <= 6; d += 0.03) {
    const a = shoulderCoverage(d, 4.2),
      b = shoulderCoverage(d + 0.03, 4.2);
    assert.ok(a >= b);
    assert.ok(Math.abs(a - b) < 0.045);
  }
});
