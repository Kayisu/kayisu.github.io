export const N = 112,
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
export class Terrain {
  constructor(seed = 3817) {
    this.seed = seed >>> 0;
    this.h = new Float32Array((N + 1) ** 2);
    this.mat = new Uint8Array(this.h.length);
    this.compact = new Float32Array(this.h.length);
    this.marks = new Float32Array(this.h.length);
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
    const rng = random(this.seed),
      phase = rng() * 20;
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
        if (Math.abs(wx - road) < 4.2)
          h -= 0.7 + Math.sin(wz * 0.3 + phase) * 0.35;
        const hill = Math.exp(-((wx - 24) ** 2 + (wz + 16) ** 2) / 190) * 3.5;
        h += hill;
        if (wx < -21 && wz > 17) h = 0.4;
        this.h[i] = h;
        this.mat[i] = 0;
        this.compact[i] = 0;
      }
    // Excavatable stockpiles beside the machine yard.
    this.deposit(-15, 24, 2.8, 10, 1);
    this.deposit(-14, 31, 2.6, 8, 2);
  }
  sample(x, z) {
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
    const out = [];
    let a = Math.max(0, Math.floor((x - r + SIZE / 2) / CELL)),
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
  deposit(x, z, r, volume, material = 1) {
    const cells = this.cells(x, z, r);
    let weight = cells.reduce((s, c) => s + c[1], 0);
    if (!weight || volume <= 0) return 0;
    for (const [i, w] of cells) {
      this.h[i] += (volume * w) / weight / (CELL * CELL);
      this.mat[i] = material;
      this.compact[i] = 0;
      this.marks[i] = 0;
    }
    return volume;
  }
  dig(x, z, r, volume) {
    if (volume <= 0) return { volume: 0, material: 0 };
    let removed = 0,
      counts = [0, 0, 0, 0];
    const cells = this.cells(x, z, r),
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
      this.mat[i] = 0;
      this.compact[i] = 0;
      this.marks[i] = 0;
    }
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
      moved += Math.abs(delta) * CELL * CELL;
    }
    return moved / 2;
  }
  roll(x, z, r, strength) {
    let area = 0;
    for (const [i, w] of this.cells(x, z, r)) {
      if (this.mat[i] === 0) continue;
      const before = this.compact[i];
      this.compact[i] = clamp(before + strength * w, 0, 1);
      area += (this.compact[i] - before) * CELL * CELL;
    }
    return area;
  }
  pave(x, z, r, volume) {
    return this.deposit(x, z, r, volume, 3);
  }
  ribbon(x, z, angle, width, depth, volume) {
    if (volume <= 0) return 0;
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle);
    const cells = this.cells(x, z, Math.hypot(width, depth) / 2 + CELL).filter(
      ([i]) => {
        const [wx, wz] = this.coord(i),
          rx = wx - x,
          rz = wz - z;
        return (
          Math.abs(rx * dz - rz * dx) <= width / 2 &&
          Math.abs(rx * dx + rz * dz) <= depth / 2
        );
      },
    );
    if (!cells.length) return 0;
    for (const [i] of cells) {
      this.h[i] += volume / cells.length / (CELL * CELL);
      this.mat[i] = 3;
      this.compact[i] = 0;
      this.marks[i] = 0;
    }
    return volume;
  }
  push(x, z, angle, targetHeight, strength) {
    if (strength <= 0) return 0;
    const dx = -Math.sin(angle),
      dz = -Math.cos(angle),
      counts = [0, 0, 0, 0];
    let moved = 0;
    for (const [i, w] of this.cells(x, z, 2)) {
      const [wx, wz] = this.coord(i),
        rx = wx - x,
        rz = wz - z;
      if (
        Math.abs(rx * dz - rz * dx) > 1.55 ||
        Math.abs(rx * dx + rz * dz) > 0.75
      )
        continue;
      const cut = Math.min(
        Math.max(0, this.h[i] - Math.max(-3, targetHeight)),
        strength * w,
      );
      this.h[i] -= cut;
      const volume = cut * CELL * CELL;
      moved += volume;
      counts[this.mat[i]] += volume;
      this.compact[i] = 0;
      this.marks[i] = 0;
    }
    if (moved > 0)
      this.deposit(
        clamp(x + dx * 1.65, -47, 47),
        clamp(z + dz * 1.65, -47, 47),
        1.45,
        moved,
        counts.indexOf(Math.max(...counts)),
      );
    return moved;
  }
  track(x, z, strength = 0.3) {
    let changed = false;
    for (const [i, w] of this.cells(x, z, 0.62)) {
      const before = this.marks[i];
      this.marks[i] = clamp(before + strength * w, 0, 1);
      if (this.mat[i] === 1 || this.mat[i] === 2)
        this.compact[i] = clamp(this.compact[i] + strength * w * 0.04, 0, 1);
      if (this.marks[i] !== before) changed = true;
    }
    return changed;
  }
  serialize() {
    return {
      seed: this.seed,
      h: Array.from(this.h),
      mat: Array.from(this.mat),
      compact: Array.from(this.compact),
      marks: Array.from(this.marks),
    };
  }
  static restore(data) {
    const count = (N + 1) ** 2;
    if (
      !data ||
      ![data.h, data.mat, data.compact].every(
        (v) => Array.isArray(v) && v.length === count,
      ) ||
      !data.h.every((v) => Number.isFinite(v) && v > -100 && v < 1000) ||
      !data.mat.every((v) => Number.isInteger(v) && v >= 0 && v <= 3) ||
      !data.compact.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
    )
      throw Error("Geçersiz arazi kaydı");
    const t = new Terrain(data.seed);
    t.h.set(data.h);
    t.mat.set(data.mat);
    t.compact.set(data.compact);
    if (data.marks) {
      if (
        !Array.isArray(data.marks) ||
        data.marks.length !== count ||
        !data.marks.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
      )
        throw Error("Geçersiz tekerlek izleri");
      t.marks.set(data.marks);
    }
    return t;
  }
}
