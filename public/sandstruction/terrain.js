import { sampleContour, shoulderCoverage } from "./contour-surface.js?v=0.6.1";
export const N = 256,
  SIZE = 96,
  CELL = SIZE / N;
export const MATERIALS = [
  { name: "Toprak", color: 0x8c8860 },
  { name: "Kum", color: 0xd7ba7c },
  { name: "Çakıl", color: 0x8b9694 },
  { name: "Asfalt", color: 0x414a49 },
];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const grain = (x, z) =>
  0.5 +
  0.5 * Math.sin(x * 7.31 + Math.sin(z * 9.17)) * Math.cos(z * 6.73 + x * 3.11);
function encode(array) {
  const bytes = new Uint8Array(
    array.buffer,
    array.byteOffset,
    array.byteLength,
  );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}
function decode(value, Type, length) {
  if (typeof value !== "string") throw Error("Geçersiz kayıt");
  const binary = atob(value);
  if (binary.length !== length * Type.BYTES_PER_ELEMENT)
    throw Error("Geçersiz kayıt boyutu");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Type(bytes.buffer);
}
export class Terrain {
  constructor(seed = 3817) {
    this.seed = seed >>> 0;
    const count = (N + 1) ** 2;
    this.h = new Float32Array(count);
    this.mat = new Uint8Array(count);
    this.compact = new Float32Array(count);
    this.marks = new Float32Array(count);
    this.loose = new Float32Array(count);
    this.flux = new Float64Array(count);
    this.active = null;
    this.settleAge = 0;
    this.make();
  }
  index(x, z) {
    return z * (N + 1) + x;
  }
  coord(i) {
    return [
      (i % (N + 1)) * CELL - SIZE / 2,
      Math.floor(i / (N + 1)) * CELL - SIZE / 2,
    ];
  }
  make() {
    const phase = random(this.seed)() * 20;
    for (let z = 0; z <= N; z++)
      for (let x = 0; x <= N; x++) {
        const wx = x * CELL - SIZE / 2,
          wz = z * CELL - SIZE / 2,
          i = this.index(x, z);
        let h =
          0.65 * Math.sin(wx * 0.12 + phase) * Math.cos(wz * 0.14) +
          0.3 * Math.sin(wz * 0.31 + wx * 0.08 + phase) +
          0.14 * Math.sin(wx * 0.52 + wz * 0.42);
        const road = 6 * Math.sin(wz * 0.065 + phase);
        h -=
          shoulderCoverage(Math.abs(wx - road), 4.2) *
          (0.7 + Math.sin(wz * 0.3 + phase) * 0.35);
        h += Math.exp(-((wx - 24) ** 2 + (wz + 16) ** 2) / 190) * 3.5;
        if (wx < -21 && wz > 17) h = 0.4;
        this.h[i] = h;
      }
    this.deposit(-15, 24, 2.8, 10, 1);
    this.deposit(-14, 31, 2.6, 8, 2);
  }
  sample(x, z) {
    return sampleContour(this.h, x, z, N, SIZE);
  }
  sampleLinear(x, z) {
    const gx = clamp((x + SIZE / 2) / CELL, 0, N - 0.001),
      gz = clamp((z + SIZE / 2) / CELL, 0, N - 0.001),
      ix = Math.floor(gx),
      iz = Math.floor(gz),
      fx = gx - ix,
      fz = gz - iz;
    return (
      this.h[this.index(ix, iz)] * (1 - fx) * (1 - fz) +
      this.h[this.index(ix + 1, iz)] * fx * (1 - fz) +
      this.h[this.index(ix, iz + 1)] * (1 - fx) * fz +
      this.h[this.index(ix + 1, iz + 1)] * fx * fz
    );
  }
  nearest(x, z) {
    return this.index(
      Math.round(clamp((x + SIZE / 2) / CELL, 0, N)),
      Math.round(clamp((z + SIZE / 2) / CELL, 0, N)),
    );
  }
  cells(x, z, r) {
    const out = [],
      a = Math.max(0, Math.floor((x - r + SIZE / 2) / CELL)),
      b = Math.min(N, Math.ceil((x + r + SIZE / 2) / CELL)),
      c = Math.max(0, Math.floor((z - r + SIZE / 2) / CELL)),
      d = Math.min(N, Math.ceil((z + r + SIZE / 2) / CELL));
    for (let iz = c; iz <= d; iz++)
      for (let ix = a; ix <= b; ix++) {
        const i = this.index(ix, iz),
          [wx, wz] = this.coord(i),
          dist = Math.hypot(wx - x, wz - z);
        if (dist < r) out.push([i, 1 - dist / r]);
      }
    return out;
  }
  footprint(x, z, angle, width, depth) {
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle);
    return this.cells(x, z, Math.hypot(width, depth) / 2 + CELL).filter(
      ([i]) => {
        const [wx, wz] = this.coord(i);
        return (
          Math.abs((wx - x) * dz - (wz - z) * dx) < width / 2 &&
          Math.abs((wx - x) * dx + (wz - z) * dz) < depth / 2
        );
      },
    );
  }
  touch(x, z, r) {
    const bounds = [
      Math.max(0, Math.floor((x - r + 48) / CELL) - 2),
      Math.min(N, Math.ceil((x + r + 48) / CELL) + 2),
      Math.max(0, Math.floor((z - r + 48) / CELL) - 2),
      Math.min(N, Math.ceil((z + r + 48) / CELL) + 2),
    ];
    if (this.active) {
      this.active = [
        Math.min(this.active[0], bounds[0]),
        Math.max(this.active[1], bounds[1]),
        Math.min(this.active[2], bounds[2]),
        Math.max(this.active[3], bounds[3]),
      ];
    } else this.active = bounds;
    this.settleAge = 0;
  }
  add(i, dh, material) {
    if (dh <= 0) return;
    const old = this.loose[i];
    this.h[i] += dh;
    this.loose[i] += dh;
    this.compact[i] *= old / (old + dh || 1);
    this.mat[i] = material;
    this.marks[i] = material === 0 ? 0.18 : 0;
  }
  deposit(x, z, r, volume, material = 1) {
    if (volume <= 0) return 0;
    const cells = this.cells(x, z, r),
      weights = cells.map(([i, w]) => {
        const [a, b] = this.coord(i);
        return w * w * (0.8 + grain(a, b) * 0.4);
      }),
      total = weights.reduce((a, b) => a + b, 0);
    if (!total) return 0;
    cells.forEach(([i], k) =>
      this.add(i, (volume * weights[k]) / total / (CELL * CELL), material),
    );
    this.touch(x, z, r + 1);
    return volume;
  }
  dig(x, z, r, volume) {
    if (volume <= 0) return { volume: 0, material: 0 };
    let removed = 0;
    const counts = [0, 0, 0, 0],
      cells = this.cells(x, z, r),
      weight = cells.reduce((s, c) => s + c[1], 0);
    if (!weight) return { volume: 0, material: 0 };
    for (const [i, w] of cells) {
      const cut = Math.min(
        Math.max(0, this.h[i] + 3),
        (volume * w) / weight / (CELL * CELL),
      );
      this.h[i] -= cut;
      removed += cut * CELL * CELL;
      counts[this.mat[i]] += cut;
      this.loose[i] = Math.max(0, this.loose[i] - cut);
      if (this.loose[i] < 0.001) this.mat[i] = 0;
      this.compact[i] = 0;
      this.marks[i] = 0.2;
    }
    this.touch(x, z, r + 1);
    return { volume: removed, material: counts.indexOf(Math.max(...counts)) };
  }
  level(x, z, r, strength) {
    const cells = this.cells(x, z, r);
    if (!cells.length) return 0;
    const mean = cells.reduce((s, c) => s + this.h[c[0]], 0) / cells.length;
    let moved = 0;
    for (const [i] of cells) {
      const delta = (mean - this.h[i]) * clamp(strength, 0, 1);
      this.h[i] += delta;
      this.loose[i] = Math.max(0, this.loose[i] + delta);
      moved += Math.abs(delta) * CELL * CELL;
    }
    return moved / 2;
  }
  pave(x, z, r, volume) {
    return this.deposit(x, z, r, volume, 3);
  }
  ribbon(x, z, angle, width, depth, volume) {
    if (volume <= 0) return 0;
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle),
      cells = this.footprint(x, z, angle, width, depth);
    let total = 0;
    const weights = cells.map(([i]) => {
      const [a, b] = this.coord(i),
        side = Math.abs((a - x) * dz - (b - z) * dx),
        fwd = Math.abs((a - x) * dx + (b - z) * dz),
        w =
          clamp((width / 2 - side) / 0.3, 0, 1) *
          clamp((depth / 2 - fwd) / 0.2, 0, 1) *
          (0.35 + grain(a, b) * 1.5);
      total += w;
      return w;
    });
    if (!total) return 0;
    cells.forEach(([i], k) =>
      this.add(i, (volume * weights[k]) / total / (CELL * CELL), 3),
    );
    this.touch(x, z, Math.max(width, depth) / 2 + 1);
    return volume;
  }
  fillLowest(cells, volume, material) {
    if (!cells.length || volume <= 0) return 0;
    const sorted = cells.map((c) => c[0]).sort((a, b) => this.h[a] - this.h[b]);
    let remaining = volume / (CELL * CELL),
      level = this.h[sorted[0]],
      count = 1;
    for (; count < sorted.length; count++) {
      const next = this.h[sorted[count]],
        needed = (next - level) * count;
      if (remaining <= needed) {
        level += remaining / count;
        remaining = 0;
        break;
      }
      remaining -= needed;
      level = next;
    }
    if (remaining > 0) level += remaining / sorted.length;
    for (const i of sorted)
      this.add(i, Math.max(0, level - this.h[i]), material);
    return volume;
  }
  spreadLayer(x, z, angle, width, depth, volume, material) {
    if (volume <= 0) return 0;
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle),
      cells = this.footprint(x, z, angle, width, depth);
    const weights = cells.map(([i]) => {
        const [wx, wz] = this.coord(i),
          side = Math.abs((wx - x) * dz - (wz - z) * dx),
          front = Math.abs((wx - x) * dx + (wz - z) * dz);
        return (
          clamp((width / 2 - side) / 0.18, 0, 1) *
          clamp((depth / 2 - front) / 0.15, 0, 1) *
          (material === 3
            ? 0.65 + grain(wx, wz) * 0.7
            : 0.95 + grain(wx, wz) * 0.1)
        );
      }),
      total = weights.reduce((a, b) => a + b, 0);
    if (!total) return 0;
    cells.forEach(([i], k) =>
      this.add(i, (volume * weights[k]) / total / (CELL * CELL), material),
    );
    this.touch(x, z, width / 2 + 1);
    return volume;
  }
  // Cut at a fixed (optionally sloped) blade plane, backfill low spots, then
  // carry the remaining windrow forward. Every removed cubic metre is placed.
  bladeGrade(
    x,
    z,
    angle,
    target,
    strength,
    width = 3.2,
    slopeX = 0,
    slopeZ = 0,
  ) {
    if (strength <= 0) return 0;
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle),
      source = this.bladeFootprint(x, z, angle, width, 1.5);
    const front = this.footprint(
      clamp(x + dx * 1.5, -46, 46),
      clamp(z + dz * 1.5, -46, 46),
      angle,
      width,
      1.5,
    );
    if (!source.length || !front.length) return 0;
    const height = (i) => {
      const [wx, wz] = this.coord(i);
      return Math.max(-3, target + (wx - x) * slopeX + (wz - z) * slopeZ);
    };
    const materialVolumes = [0, 0, 0, 0];
    let removed = 0;
    for (const [i, w] of source) {
      const cut = Math.min(Math.max(0, this.h[i] - height(i)), strength * w);
      if (cut <= 0) continue;
      this.h[i] -= cut;
      this.loose[i] = Math.max(0, this.loose[i] - cut);
      this.compact[i] = 0;
      this.marks[i] = 0.22;
      removed += cut;
      materialVolumes[this.mat[i]] += cut;
    }
    if (!removed) return 0;
    const material = materialVolumes.indexOf(Math.max(...materialVolumes));
    let remaining = removed;
    for (const cells of [source, front]) {
      const low = cells.map(([i]) => [i, Math.max(0, height(i) - this.h[i])]),
        total = low.reduce((sum, [, d]) => sum + d, 0);
      const use = Math.min(remaining, total);
      if (use > 0)
        for (const [i, d] of low) this.add(i, (use * d) / total, material);
      remaining -= use;
    }
    if (remaining > 0)
      this.fillLowest(front, remaining * CELL * CELL, material);
    this.touch(x, z, width / 2 + 3);
    return removed * CELL * CELL;
  }
  bladeFootprint(x, z, angle, width, depth) {
    width = clamp(width, 1.2, 6);
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle);
    return this.footprint(x, z, angle, width, depth).map(([i]) => {
      const [wx, wz] = this.coord(i),
        side = Math.abs((wx - x) * dz - (wz - z) * dx),
        fwd = Math.abs((wx - x) * dx + (wz - z) * dz);
      const edge = clamp((width / 2 - side) / 0.24, 0, 1),
        front = clamp((depth / 2 - fwd) / 0.16, 0, 1);
      return [i, edge * edge * (3 - 2 * edge) * front];
    });
  }
  push(x, z, angle, targetHeight, strength, width = 3.2) {
    if (strength <= 0) return 0;
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle),
      toX = clamp(x + dx * 1.35, -46, 46),
      toZ = clamp(z + dz * 1.35, -46, 46),
      dest = this.footprint(toX, toZ, angle, width + 0.1, 1.5);
    if (!dest.length) return 0;
    const counts = [0, 0, 0, 0];
    let moved = 0;
    for (const [i, w] of this.bladeFootprint(x, z, angle, width, 0.8)) {
      const cut = Math.min(
        Math.max(0, this.h[i] - Math.max(-3, targetHeight)),
        strength * w,
      );
      this.h[i] -= cut;
      const v = cut * CELL * CELL;
      moved += v;
      counts[this.mat[i]] += v;
      this.loose[i] = Math.max(0, this.loose[i] - cut);
      this.compact[i] = 0;
      this.marks[i] = 0.15;
    }
    this.fillLowest(dest, moved, counts.indexOf(Math.max(...counts)));
    if (moved > 0) this.touch(x, z, width / 2 + 3);
    return moved;
  }
  grade(x, z, angle, targetHeight, strength, width = 3.2) {
    const cells = this.bladeFootprint(x, z, angle, width, 1.7),
      high = [],
      low = [];
    let excess = 0,
      deficit = 0;
    for (const [i, w] of cells) {
      const d = (this.h[i] - targetHeight) * w;
      if (d > 0) {
        high.push([i, d]);
        excess += d;
      } else {
        low.push([i, -d]);
        deficit -= d;
      }
    }
    const transfer = Math.min(excess, deficit) * clamp(strength, 0, 1);
    if (!transfer) return 0;
    const counts = [0, 0, 0, 0];
    for (const [i, d] of high) {
      const cut = (transfer * d) / excess;
      counts[this.mat[i]] += cut;
      this.h[i] -= cut;
      this.loose[i] = Math.max(0, this.loose[i] - cut);
      this.marks[i] = 0.15;
      this.compact[i] = 0;
    }
    const mat = counts.indexOf(Math.max(...counts));
    for (const [i, d] of low) this.add(i, (transfer * d) / deficit, mat);
    this.touch(x, z, width / 2 + 2);
    return transfer * CELL * CELL;
  }
  finish(x, z, angle, width, depth, strength) {
    let area = 0,
      moved = 0;
    const cells = this.footprint(x, z, angle, width, depth),
      eligible = new Set(
        cells.filter(([i]) => this.mat[i] > 0).map(([i]) => i),
      ),
      rate = clamp(strength, 0, 1);
    for (const [i] of cells) {
      if (!eligible.has(i)) continue;
      const old = this.compact[i];
      this.compact[i] = clamp(old + rate, 0, 1);
      area += (this.compact[i] - old) * CELL * CELL;
      for (const j of [i + 1, i + N + 1]) {
        if (!eligible.has(j) || this.mat[i] !== this.mat[j]) continue;
        const a = this.h[i] > this.h[j] ? i : j,
          b = a === i ? j : i;
        const flow = Math.min(
          (this.h[a] - this.h[b]) * 0.45 * rate,
          this.loose[a] * 0.4,
        );
        this.h[a] -= flow;
        this.h[b] += flow;
        this.loose[a] = Math.max(0, this.loose[a] - flow);
        this.loose[b] += flow;
        moved += flow * CELL * CELL;
      }
    }
    return area + moved;
  }
  roll(x, z, r, strength) {
    return this.finish(x, z, 0, r * 2, r * 2, strength);
  }
  settle(dt) {
    if (!this.active) return 0;
    dt = clamp(dt, 0, 0.05);
    this.settleAge += dt;
    const [a, b, c, d] = this.active,
      slopes = [0.7, 0.55, 0.8, 1.2];
    this.flux.fill(0);
    let moved = 0,
      minX = N,
      maxX = 0,
      minZ = N,
      maxZ = 0;
    for (let z = c; z <= d; z++)
      for (let x = a; x <= b; x++) {
        const i = this.index(x, z);
        for (const j of [x < N ? i + 1 : -1, z < N ? i + N + 1 : -1]) {
          if (j < 0) continue;
          const high = this.h[i] > this.h[j] ? i : j,
            low = high === i ? j : i;
          if (this.loose[high] < 0.000001 || this.compact[high] > 0.94)
            continue;
          const excess =
            this.h[high] - this.h[low] - slopes[this.mat[high]] * CELL;
          if (excess <= 0) continue;
          const amount =
            Math.min(excess * dt * 3, this.loose[high] * 0.24) *
            (1 - this.compact[high]);
          this.flux[high] -= amount;
          this.flux[low] += amount;
          moved += amount * CELL * CELL;
          if (amount > 0.000001) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x + (j === i + 1 ? 1 : 0));
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z + (j === i + N + 1 ? 1 : 0));
          }
          if (amount > 0.000001 && this.loose[low] < this.loose[high])
            this.mat[low] = this.mat[high];
        }
      }
    for (let z = Math.max(0, c - 1); z <= Math.min(N, d + 1); z++)
      for (let x = Math.max(0, a - 1); x <= Math.min(N, b + 1); x++) {
        const i = this.index(x, z),
          f = this.flux[i];
        if (!f) continue;
        this.h[i] += f;
        this.loose[i] = Math.max(0, this.loose[i] + f);
        if (f > 0) {
          this.compact[i] *= 0.985;
          this.marks[i] *= 0.9;
        }
      }
    if (moved > 0.000001 && minX <= maxX)
      this.active = [
        Math.max(0, minX - 2),
        Math.min(N, maxX + 2),
        Math.max(0, minZ - 2),
        Math.min(N, maxZ + 2),
      ];
    if ((moved < 0.000005 && this.settleAge > 0.5) || this.settleAge > 7)
      this.active = null;
    return moved;
  }
  track(x, z, strength = 0.3) {
    let changed = false;
    for (const [i, w] of this.cells(x, z, 0.42)) {
      const before = this.marks[i];
      this.marks[i] = clamp(before + strength * w, 0, 1);
      if (this.mat[i] === 1 || this.mat[i] === 2)
        this.compact[i] = clamp(this.compact[i] + strength * w * 0.04, 0, 1);
      if (this.marks[i] !== before) changed = true;
    }
    return changed;
  }
  serialize(packed = false) {
    if (packed)
      return {
        format: "f32-base64",
        n: N,
        seed: this.seed,
        h: encode(this.h),
        mat: encode(this.mat),
        compact: encode(this.compact),
        marks: encode(this.marks),
        loose: encode(this.loose),
      };
    return {
      n: N,
      seed: this.seed,
      h: Array.from(this.h),
      mat: Array.from(this.mat),
      compact: Array.from(this.compact),
      marks: Array.from(this.marks),
      loose: Array.from(this.loose),
    };
  }
  static restore(data) {
    if (!data) throw Error("Geçersiz arazi kaydı");
    const sourceN = data.n ?? Math.sqrt(data.h?.length || 0) - 1,
      count = (sourceN + 1) ** 2;
    if (!Number.isInteger(sourceN) || sourceN < 16 || sourceN > 512)
      throw Error("Geçersiz arazi çözünürlüğü");
    const fields = {};
    for (const key of ["h", "mat", "compact", "marks", "loose"]) {
      const value = data[key];
      if (value === undefined && ["marks", "loose"].includes(key)) continue;
      const Type = key === "mat" ? Uint8Array : Float32Array;
      if (data.format === "f32-base64")
        fields[key] = decode(value, Type, count);
      else {
        if (!Array.isArray(value) || value.length !== count)
          throw Error("Geçersiz kayıt boyutu");
        fields[key] = value;
      }
      if (
        !Array.from(fields[key]).every(
          (v) =>
            Number.isFinite(v) &&
            (key === "h"
              ? v > -100 && v < 1000
              : key === "mat"
                ? Number.isInteger(v) && v >= 0 && v <= 3
                : key === "loose"
                  ? v >= 0 && v < 1000
                  : v >= 0 && v <= 1),
        )
      )
        throw Error("Geçersiz kayıt değeri");
    }
    const t = new Terrain(data.seed);
    t.active = null;
    const interpolate = (arr, gx, gz) => {
      if (!arr) return 0;
      const ix = Math.min(sourceN - 1, Math.floor(gx)),
        iz = Math.min(sourceN - 1, Math.floor(gz)),
        fx = gx - ix,
        fz = gz - iz,
        i = iz * (sourceN + 1) + ix;
      return (
        arr[i] * (1 - fx) * (1 - fz) +
        arr[i + 1] * fx * (1 - fz) +
        arr[i + sourceN + 1] * (1 - fx) * fz +
        arr[i + sourceN + 2] * fx * fz
      );
    };
    for (let z = 0; z <= N; z++)
      for (let x = 0; x <= N; x++) {
        const i = t.index(x, z),
          gx = (x / N) * sourceN,
          gz = (z / N) * sourceN,
          nearest = Math.round(gz) * (sourceN + 1) + Math.round(gx);
        t.h[i] = interpolate(fields.h, gx, gz);
        t.mat[i] = fields.mat[nearest];
        t.compact[i] = interpolate(fields.compact, gx, gz);
        t.marks[i] = interpolate(fields.marks, gx, gz);
        t.loose[i] = fields.loose
          ? interpolate(fields.loose, gx, gz)
          : t.mat[i] > 0
            ? 0.18 * (1 - t.compact[i])
            : 0;
      }
    return t;
  }
}
