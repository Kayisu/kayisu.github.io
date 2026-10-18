import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../../public/sandstruction/vendor/three.module.js";
import { Terrain, CELL } from "../../public/sandstruction/terrain.js";
import { RoadPlan, prepareWorkshop } from "../../public/sandstruction/road-plan.js";
import {
  ROAD_WORK_SPEED,
  ROAD_FILL_DEPTH,
  ROAD_ASPHALT_DEPTH,
  ROAD_SPREAD_WIDTH,
  roadPlacement,
} from "../../public/sandstruction/road-work.js";
import { RoadGuide, intersectTerrain } from "../../public/sandstruction/road-guide.js";
import { sharpenCoverage } from "../../public/sandstruction/road-material.js";
import { SurfaceField } from "../../public/sandstruction/surface-field.js";
import { stepVehicle } from "../../public/sandstruction/physics.js";
import { MACHINES } from "../../public/sandstruction/models.js";
import { renderProfile } from "../../public/sandstruction/touch-input.js";
const mass = (t) => t.h.reduce((s, h) => s + h * CELL * CELL, 0);
function flat() {
  const t = new Terrain();
  for (const name of ["h", "mat", "compact", "loose", "marks"]) t[name].fill(0);
  t.active = null;
  return t;
}

test("material identities sharpen independently of smooth heights and compaction reaches the GPU", () => {
  const w = sharpenCoverage([0.8, 0.2, 0, 0]);
  assert.ok(w[0] > 0.999);
  assert.equal(w[2], 0);
  assert.deepEqual(sharpenCoverage([0.5, 0.5, 0, 0]), [0.5, 0.5, 0, 0]);
  const t = flat(),
    f = new SurfaceField();
  t.mat[0] = 1;
  t.mat[1] = 2;
  t.mat[2] = 3;
  t.compact[2] = 0.85;
  const h = t.h.slice();
  f.update(t, 1, true);
  assert.deepEqual(t.h, h);
  assert.deepEqual(
    [...f.material.slice(0, 12)],
    [255, 0, 0, 0, 0, 255, 0, 0, 0, 0, 255, 217],
  );
});

test("plans measure real terrain without changing it and survive optional save restoration", () => {
  const t = new Terrain(3817),
    p = prepareWorkshop(t),
    saved = t.serialize(true);
  assert.equal(p.measure(t).stage, 0);
  assert.ok(p.measure(t).missing > 20);
  const restored = RoadPlan.restore(JSON.parse(JSON.stringify(p.serialize())));
  assert.deepEqual(restored.measure(t), p.measure(t));
  assert.deepEqual(t.serialize(true), saved);
  assert.equal(RoadPlan.restore(null), null);
  for (const end of [
    { x: 0, z: 0, h: 0 },
    { x: 90, z: 0, h: 0 },
    { x: 6, z: 0, h: NaN },
  ])
    assert.throws(() => new RoadPlan({ x: 0, z: 0, h: 0 }, end));
  const slope = new RoadPlan(
    { x: 1, z: 2, h: 0.2 },
    { x: 21, z: 2, h: 1.2 },
    4.4,
  );
  assert.equal(slope.heightAt(11, 2), 0.7);
  assert.equal(slope.contains(11, 4), true);
  assert.equal(slope.contains(11, 5), false);
});

test("spread passes conserve material and converge across different frame steps", () => {
  const passes = [];
  for (const step of [0.025, 0.05]) {
    const t = flat(),
      before = mass(t);
    let volume = 0;
    for (let a = 0; a < 12 - 1e-8; a += step) {
      const v = 3.2 * 0.1 * step;
      volume += t.spreadLayer(0, -a, 0, 3.2, 1.1, v, 3);
    }
    assert.ok(Math.abs(mass(t) - before - volume) < 0.00002);
    passes.push(t);
    const beforeStop = t.serialize(true);
    assert.equal(t.spreadLayer(0, 0, 0, 3.2, 1.1, 0, 3), 0);
    assert.deepEqual(t.serialize(true), beforeStop);
  }
  let sum = 0,
    count = 0;
  for (let i = 0; i < passes[0].h.length; i++)
    if (passes[0].mat[i] === 3) {
      sum += Math.abs(passes[0].h[i] - passes[1].h[i]);
      count++;
    }
  assert.ok(
    sum / count < 0.002,
    "Different frame steps should not stamp visible transverse ridges",
  );
});

test("fixed sloped grading conserves volume and leaves low ground unchanged without a source", () => {
  const t = flat();
  t.h.fill(0.3);
  t.loose.fill(0.3);
  t.mat.fill(2);
  const before = mass(t);
  for (let z = 2; z >= -10; z -= 0.03)
    t.bladeGrade(0, z, 0, 0.1 - z * 0.006, 0.048, 3.2, 0, -0.006);
  assert.ok(Math.abs(mass(t) - before) < 0.001);
  for (let z = 0; z >= -8; z -= 1)
    assert.ok(Math.abs(t.h[t.nearest(0, z)] - (0.1 - z * 0.006)) < 0.015);
  const empty = flat(),
    snapshot = empty.serialize(true);
  assert.equal(empty.bladeGrade(0, 0, 0, 1, 0.1), 0);
  assert.deepEqual(empty.serialize(true), snapshot);
});

test("tool contact aligns with either stake and roller lanes cover both shoulders", () => {
  const p = new RoadPlan({ x: 4, z: 10, h: 0.5 }, { x: -8, z: -14, h: 1.1 });
  for (const def of MACHINES)
    for (const end of [false, true]) {
      const v = { ...def, bladeWidth: 3.2 },
        q = roadPlacement(p, v, end, 0),
        reach = {
          truck: -2.5,
          loader: 2.3,
          dozer: 2.05,
          roller: 1.25,
          paver: -2.1,
          shovel: 1.1,
        }[v.id];
      const contact = p.local(
        q.x - Math.sin(q.angle) * reach,
        q.z - Math.cos(q.angle) * reach,
      );
      assert.ok(Math.abs(contact.side) < 1e-9);
      assert.ok(Math.abs(contact.along - (end ? p.length : 0)) < 1e-9);
    }
  const left = roadPlacement(p, { id: "roller" }, false, -1),
    right = roadPlacement(p, { id: "roller" }, false, 1);
  assert.ok(
    Math.abs(Math.hypot(left.x - right.x, left.z - right.z) - 1) < 1e-9,
  );
});

test("work speed limits actual travel and removing the limit restores free driving", () => {
  const t = flat(),
    v = { id: "truck", x: 0, z: 15, angle: 0, max: 6, speed: 0 };
  for (let i = 0; i < 120; i++)
    stepVehicle(v, { forward: true, speedLimit: 1.4 }, t, [], 1 / 60);
  assert.ok(v.speed <= 1.4);
  const limited = v.speed;
  for (let i = 0; i < 120; i++)
    stepVehicle(v, { forward: true }, t, [], 1 / 60);
  assert.ok(v.speed > limited * 2);
});

test("the workshop completes through driving, finite cargo refills, grading, paving and two roller lanes", () => {
  for (const fps of [30, 60]) {
    const t = new Terrain(3817),
      p = prepareWorkshop(t),
      dt = 1 / fps;
    let settling = 0,
      refills = 0,
      added = 0;
    const initialMass = mass(t);
    function pass(id, lane = 0) {
      const def = MACHINES.find((m) => m.id === id),
        v = {
          ...def,
          bladeWidth: 3.2,
          speed: 0,
          ...roadPlacement(p, { ...def, bladeWidth: 3.2 }, false, lane),
          cargo: def.capacity,
        };
      const reach = { truck: -2.5, dozer: 2.05, paver: -2.1, roller: 1.25 }[id];
      for (let frame = 0; frame < fps * 100; frame++) {
        const motion = stepVehicle(
          v,
          { forward: true, speedLimit: ROAD_WORK_SPEED[id] },
          t,
          [],
          dt,
        );
        const x = v.x - Math.sin(v.angle) * reach,
          z = v.z - Math.cos(v.angle) * reach;
        if (id === "truck" || id === "paver") {
          const need =
            ROAD_SPREAD_WIDTH *
            (id === "truck" ? ROAD_FILL_DEPTH : ROAD_ASPHALT_DEPTH) *
            motion.distance;
          if (v.cargo < need) {
            v.cargo = v.capacity;
            refills++;
          }
          const used = t.spreadLayer(
            x,
            z,
            v.angle,
            ROAD_SPREAD_WIDTH,
            1.1,
            Math.min(need, v.cargo),
            id === "truck" ? 1 : 3,
          );
          v.cargo -= used;
          added += used;
        } else if (id === "dozer")
          t.bladeGrade(
            x,
            z,
            v.angle,
            p.heightAt(x, z),
            motion.distance * 1.6,
            3.2,
          );
        else t.finish(x, z, v.angle, 2.2, 1.3, dt * 2.4);
        settling += dt;
        while (settling >= 1 / 30) {
          t.settle(1 / 30);
          settling -= 1 / 30;
        }
        if (p.local(x, z).along > p.length + 0.8) break;
        assert.ok(frame < fps * 100 - 1, "The machine must reach the end");
      }
      for (let i = 0; i < 60; i++) t.settle(1 / 30);
    }
    assert.equal(p.measure(t).stage, 0);
    pass("truck");
    assert.equal(p.measure(t).stage, 1);
    assert.ok(refills >= 2);
    pass("dozer");
    assert.equal(p.measure(t).stage, 2);
    pass("paver");
    assert.equal(p.measure(t).stage, 3);
    pass("roller", -1);
    pass("roller", 1);
    const done = p.measure(t);
    assert.equal(done.stage, 4);
    assert.ok(done.ratios[3] > 0.98);
    assert.ok(
      Math.abs(mass(t) - initialMass - added) < 0.003,
      "Grading, rolling and settling must not create or destroy bulk material",
    );
  }
});

test("road picking intersects the reconstructed surface and guide geometry remains finite", () => {
  const t = flat();
  t.h.fill(1);
  const hit = intersectTerrain(
    new T.Ray(new T.Vector3(2, 20, 3), new T.Vector3(0, -1, 0)),
    t,
  );
  assert.ok(Math.abs(hit.h - 1) < 1e-9);
  assert.equal(hit.x, 2);
  assert.equal(hit.z, 3);
  assert.equal(
    intersectTerrain(
      new T.Ray(new T.Vector3(2, 20, 3), new T.Vector3(0, 1, 0)),
      t,
    ),
    null,
  );
  const guide = new RoadGuide(new T.Scene());
  guide.setPlan(new RoadPlan({ x: 0, z: 10, h: 1 }, { x: 0, z: -10, h: 1 }));
  guide.update(t);
  assert.ok(
    [...guide.lines.geometry.attributes.position.array].every(Number.isFinite),
  );
  assert.equal(guide.markers.children.length, 4);
  guide.setPlan(null);
  assert.equal(guide.group.visible, false);
  assert.equal(guide.markers.children.length, 0);
});

test("desktop render budget retains native Full HD and 4K resolution without raising mobile cost", () => {
  for (const [width, height] of [
    [1920, 1080],
    [3840, 2160],
  ])
    assert.ok(
      renderProfile({ width, height, dpr: 2, touch: false }).pixelRatio >= 1,
    );
  assert.ok(
    renderProfile({ width: 390, height: 844, dpr: 3, touch: true })
      .pixelRatio <= 1.5,
  );
});
