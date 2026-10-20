import { N, CELL, clamp } from "./terrain.js?v=0.7.0";

export class RoadPlan {
  constructor(start, end, width = 3.2) {
    if (
      ![start?.x, start?.z, start?.h, end?.x, end?.z, end?.h, width].every(
        Number.isFinite,
      )
    )
      throw Error("Geçersiz yol hattı");
    this.length = Math.hypot(end.x - start.x, end.z - start.z);
    if (
      this.length < 6 ||
      this.length > 60 ||
      [start, end].some((p) => Math.abs(p.x) > 43 || Math.abs(p.z) > 43)
    )
      throw Error("Hat 6–60 metre olmalı ve saha içinde kalmalı.");
    this.start = { ...start };
    this.end = { ...end };
    this.width = clamp(width, 2.4, 6);
    this.dx = (end.x - start.x) / this.length;
    this.dz = (end.z - start.z) / this.length;
    this.slope = (end.h - start.h) / this.length;
    this.angle = Math.atan2(-this.dx, -this.dz);
  }
  local(x, z) {
    const x0 = x - this.start.x,
      z0 = z - this.start.z;
    return {
      along: x0 * this.dx + z0 * this.dz,
      side: x0 * this.dz - z0 * this.dx,
    };
  }
  contains(x, z, margin = 0) {
    const p = this.local(x, z);
    return (
      p.along >= -margin &&
      p.along <= this.length + margin &&
      Math.abs(p.side) <= this.width / 2 + margin
    );
  }
  heightAt(x, z) {
    return this.start.h + this.local(x, z).along * this.slope;
  }
  point(along, side = 0) {
    return {
      x: this.start.x + this.dx * along + this.dz * side,
      z: this.start.z + this.dz * along - this.dx * side,
    };
  }
  serialize() {
    return { start: this.start, end: this.end, width: this.width };
  }
  static restore(data) {
    return data ? new RoadPlan(data.start, data.end, data.width) : null;
  }
  measure(terrain) {
    let count = 0,
      fill = 0,
      grade = 0,
      pave = 0,
      finish = 0,
      missing = 0,
      excess = 0,
      compaction = 0;
    const stations = Array.from({ length: 12 }, () => ({
      count: 0,
      finished: 0,
    }));
    const minX = Math.max(
        0,
        Math.floor(
          (Math.min(this.start.x, this.end.x) - this.width + 48) / CELL,
        ),
      ),
      maxX = Math.min(
        N,
        Math.ceil(
          (Math.max(this.start.x, this.end.x) + this.width + 48) / CELL,
        ),
      );
    const minZ = Math.max(
        0,
        Math.floor(
          (Math.min(this.start.z, this.end.z) - this.width + 48) / CELL,
        ),
      ),
      maxZ = Math.min(
        N,
        Math.ceil(
          (Math.max(this.start.z, this.end.z) + this.width + 48) / CELL,
        ),
      );
    for (let z = minZ; z <= maxZ; z++)
      for (let x = minX; x <= maxX; x++) {
        const i = terrain.index(x, z),
          [wx, wz] = terrain.coord(i),
          p = this.local(wx, wz);
        // Exclude the intentional feathered shoulder from the driving lane.
        if (
          p.along < 0.35 ||
          p.along > this.length - 0.35 ||
          Math.abs(p.side) > this.width / 2 - 0.3
        )
          continue;
        const asphalt = terrain.mat[i] === 3,
          delta = terrain.h[i] - this.heightAt(wx, wz) - (asphalt ? 0.1 : 0),
          flat = Math.abs(delta) <= 0.075;
        count++;
        fill += delta >= -0.08;
        grade += flat;
        pave += asphalt;
        compaction += terrain.compact[i];
        missing += Math.max(0, -delta) * CELL * CELL;
        excess += Math.max(0, delta) * CELL * CELL;
        const done = asphalt && flat && terrain.compact[i] >= 0.85;
        finish += done;
        const station =
          stations[Math.min(11, Math.floor((p.along / this.length) * 12))];
        station.count++;
        station.finished += done;
      }
    const ratios = [fill, grade, pave, finish].map((v) =>
      count ? v / count : 0,
    );
    const stage =
      ratios[0] < 0.93
        ? 0
        : ratios[1] < 0.88
          ? 1
          : ratios[2] < 0.93
            ? 2
            : ratios[3] < 0.9
              ? 3
              : 4;
    return {
      ratios,
      stage,
      missing,
      excess,
      compaction: count ? compaction / count : 0,
      stations: stations.map((s) => (s.count ? s.finished / s.count : 0)),
      count,
    };
  }
}

// A fresh desktop sandbox starts with a short, readable practice strip. This
// function is never run over a restored save or when drawing a new road plan.
export function prepareWorkshop(terrain) {
  const plan = new RoadPlan(
    { x: -3, z: 14, h: 0.5 },
    { x: -3, z: -10, h: 0.5 },
    3.2,
  );
  for (let i = 0; i < terrain.h.length; i++) {
    const [x, z] = terrain.coord(i);
    const edge = Math.min((10 - Math.abs(x)) / 2, (26 - z) / 3, (z + 18) / 3);
    const blend = clamp(edge, 0, 1);
    if (!blend) continue;
    let level = 0.42;
    if (plan.contains(x, z, 0.1)) {
      const p = plan.local(x, z),
        rut = Math.exp(-((Math.abs(p.side) - 0.9) ** 2) / 0.12);
      level = 0.25 - 0.09 * Math.sin(p.along * 0.8) ** 2 - 0.12 * rut;
    }
    terrain.h[i] = terrain.h[i] * (1 - blend) + level * blend;
    terrain.mat[i] = 0;
    terrain.compact[i] = 0;
    terrain.marks[i] = plan.contains(x, z, 0.1) ? 0.28 : 0;
    terrain.loose[i] = 0;
  }
  terrain.active = null;
  return plan;
}
