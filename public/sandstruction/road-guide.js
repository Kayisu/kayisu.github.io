import * as T from "./vendor/three.module.js";

export class RoadGuide {
  constructor(scene) {
    this.group = new T.Group();
    scene.add(this.group);
    this.lines = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: 0xf1c65a,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      }),
    );
    this.lines.renderOrder = 6;
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
    this.markers = new T.Group();
    this.group.add(this.markers);
    this.plan = null;
  }
  setPlan(plan) {
    this.plan = plan;
    this.markers.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.markers.clear();
    if (!plan) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    for (const along of [0, plan.length])
      for (const side of [-1, 1]) {
        const p = plan.point(along, side * (plan.width / 2 + 0.45));
        const cone = new T.Mesh(
          new T.ConeGeometry(0.18, 0.6, 12),
          new T.MeshStandardMaterial({ color: 0xe89a3d, roughness: 0.85 }),
        );
        cone.position.set(p.x, plan.heightAt(p.x, p.z) + 0.3, p.z);
        cone.castShadow = true;
        this.markers.add(cone);
      }
  }
  update(terrain, showTarget = false) {
    const plan = this.plan;
    if (!plan) return;
    const vertices = [];
    const point = (along, side) => {
      const p = plan.point(along, side);
      return [
        p.x,
        (showTarget ? plan.heightAt(p.x, p.z) : terrain.sample(p.x, p.z)) +
          0.055,
        p.z,
      ];
    };
    for (let a = 0; a < plan.length; a += 0.6)
      for (const side of [-1, 1])
        vertices.push(
          ...point(a, (side * plan.width) / 2),
          ...point(Math.min(a + 0.6, plan.length), (side * plan.width) / 2),
        );
    for (let a = 0; a <= plan.length; a += 2)
      for (const side of [-1, 1])
        vertices.push(
          ...point(a, side * (plan.width / 2 - 0.12)),
          ...point(a, side * (plan.width / 2 + 0.35)),
        );
    for (const a of [0, plan.length])
      vertices.push(...point(a, -plan.width / 2), ...point(a, plan.width / 2));
    this.lines.geometry.dispose();
    this.lines.geometry = new T.BufferGeometry();
    this.lines.geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    );
  }
}

// The GPU surface is displaced, so mesh.raycast would hit its original plane.
// Intersect the same height reconstruction that the wheels actually use.
export function intersectTerrain(ray, terrain) {
  let previous = null;
  for (let t = 0.5; t < 220; t += 0.65) {
    const x = ray.origin.x + ray.direction.x * t,
      z = ray.origin.z + ray.direction.z * t,
      y = ray.origin.y + ray.direction.y * t;
    if (Math.abs(x) > 47 || Math.abs(z) > 47) {
      previous = null;
      continue;
    }
    const delta = y - terrain.sample(x, z);
    if (previous && previous.delta >= 0 && delta <= 0) {
      let a = previous.t,
        b = t;
      for (let i = 0; i < 10; i++) {
        const m = (a + b) / 2,
          mx = ray.origin.x + ray.direction.x * m,
          mz = ray.origin.z + ray.direction.z * m,
          my = ray.origin.y + ray.direction.y * m;
        if (my > terrain.sample(mx, mz)) a = m;
        else b = m;
      }
      const hit = (a + b) / 2,
        hx = ray.origin.x + ray.direction.x * hit,
        hz = ray.origin.z + ray.direction.z * hit;
      return { x: hx, z: hz, h: terrain.sample(hx, hz) };
    }
    previous = { t, delta };
  }
  return null;
}
