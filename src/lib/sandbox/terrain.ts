import { GRID_SIZE, MAX_HEIGHT, CELL_SIZE, WORLD_SIZE } from './constants';
import { idx, neighbors8, inBounds, forEachCell } from './grid';

export class HeightGrid {
  data: Float32Array;
  dirtyMinX: number;
  dirtyMinZ: number;
  dirtyMaxX: number;
  dirtyMaxZ: number;

  constructor() {
    this.data = new Float32Array(GRID_SIZE * GRID_SIZE);
    this.dirtyMinX = GRID_SIZE;
    this.dirtyMinZ = GRID_SIZE;
    this.dirtyMaxX = -1;
    this.dirtyMaxZ = -1;
  }

  get(gx: number, gz: number): number {
    if (!inBounds(gx, gz)) return 0;
    return this.data[idx(gx, gz)];
  }

  set(gx: number, gz: number, value: number): void {
    if (!inBounds(gx, gz)) return;
    const i = idx(gx, gz);
    this.data[i] = Math.max(0, Math.min(MAX_HEIGHT, value));
    this.markDirty(gx, gz);
  }

  add(gx: number, gz: number, delta: number): void {
    if (!inBounds(gx, gz)) return;
    const i = idx(gx, gz);
    this.data[i] = Math.max(0, Math.min(MAX_HEIGHT, this.data[i] + delta));
    this.markDirty(gx, gz);
  }

  private markDirty(gx: number, gz: number): void {
    if (gx < this.dirtyMinX) this.dirtyMinX = gx;
    if (gz < this.dirtyMinZ) this.dirtyMinZ = gz;
    if (gx > this.dirtyMaxX) this.dirtyMaxX = gx;
    if (gz > this.dirtyMaxZ) this.dirtyMaxZ = gz;
  }

  clearDirty(): void {
    this.dirtyMinX = GRID_SIZE;
    this.dirtyMinZ = GRID_SIZE;
    this.dirtyMaxX = -1;
    this.dirtyMaxZ = -1;
  }

  hasDirty(): boolean {
    return this.dirtyMaxX >= this.dirtyMinX && this.dirtyMaxZ >= this.dirtyMinZ;
  }

  getDirtyRect(): { minX: number; minZ: number; maxX: number; maxZ: number } {
    return {
      minX: this.dirtyMinX,
      minZ: this.dirtyMinZ,
      maxX: this.dirtyMaxX,
      maxZ: this.dirtyMaxZ,
    };
  }

  /** Gaussian-ish falloff for smooth brush */
  private falloff(dist: number, radius: number): number {
    if (dist >= radius) return 0;
    const t = dist / radius;
    return (1 - t * t) * (1 - t * t); // quartic falloff
  }

  /** Build tool: raise terrain */
  build(cx: number, cz: number, radius: number, strength: number): void {
    const r = Math.floor(radius);
    const minX = Math.max(0, cx - r);
    const maxX = Math.min(GRID_SIZE - 1, cx + r);
    const minZ = Math.max(0, cz - r);
    const maxZ = Math.min(GRID_SIZE - 1, cz + r);

    for (let gz = minZ; gz <= maxZ; gz++) {
      const base = gz * GRID_SIZE;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx - cx;
        const dz = gz - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const f = this.falloff(dist, radius);
        if (f > 0) {
          this.data[base + gx] = Math.min(MAX_HEIGHT, this.data[base + gx] + f * strength);
        }
      }
    }
    this.dirtyMinX = minX; this.dirtyMaxX = maxX;
    this.dirtyMinZ = minZ; this.dirtyMaxZ = maxZ;
  }

  /** Dig tool: lower terrain */
  dig(cx: number, cz: number, radius: number, strength: number): void {
    const r = Math.floor(radius);
    const minX = Math.max(0, cx - r);
    const maxX = Math.min(GRID_SIZE - 1, cx + r);
    const minZ = Math.max(0, cz - r);
    const maxZ = Math.min(GRID_SIZE - 1, cz + r);

    for (let gz = minZ; gz <= maxZ; gz++) {
      const base = gz * GRID_SIZE;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx - cx;
        const dz = gz - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const f = this.falloff(dist, radius);
        if (f > 0) {
          this.data[base + gx] = Math.max(0, this.data[base + gx] - f * strength);
        }
      }
    }
    this.dirtyMinX = minX; this.dirtyMaxX = maxX;
    this.dirtyMinZ = minZ; this.dirtyMaxZ = maxZ;
  }

  /** Flatten tool: smooth toward average height */
  flatten(cx: number, cz: number, radius: number, strength: number): void {
    const r = Math.floor(radius);
    const minX = Math.max(0, cx - r);
    const maxX = Math.min(GRID_SIZE - 1, cx + r);
    const minZ = Math.max(0, cz - r);
    const maxZ = Math.min(GRID_SIZE - 1, cz + r);

    // First pass: compute average
    let sum = 0;
    let count = 0;
    for (let gz = minZ; gz <= maxZ; gz++) {
      const base = gz * GRID_SIZE;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx - cx;
        const dz = gz - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radius) {
          sum += this.data[base + gx];
          count++;
        }
      }
    }
    const avg = count > 0 ? sum / count : 0;

    // Second pass: lerp toward average
    for (let gz = minZ; gz <= maxZ; gz++) {
      const base = gz * GRID_SIZE;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx - cx;
        const dz = gz - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const f = this.falloff(dist, radius) * strength;
        if (f > 0) {
          const i = base + gx;
          this.data[i] = this.data[i] + (avg - this.data[i]) * f;
        }
      }
    }
    this.dirtyMinX = minX; this.dirtyMaxX = maxX;
    this.dirtyMinZ = minZ; this.dirtyMaxZ = maxZ;
  }

  /** Get min/max/avg in radius */
  getBounds(cx: number, cz: number, radius: number): { min: number; max: number; avg: number } {
    const r = Math.floor(radius);
    const minX = Math.max(0, cx - r);
    const maxX = Math.min(GRID_SIZE - 1, cx + r);
    const minZ = Math.max(0, cz - r);
    const maxZ = Math.min(GRID_SIZE - 1, cz + r);

    let min = MAX_HEIGHT;
    let max = 0;
    let sum = 0;
    let count = 0;

    for (let gz = minZ; gz <= maxZ; gz++) {
      const base = gz * GRID_SIZE;
      for (let gx = minX; gx <= maxX; gx++) {
        const dx = gx - cx;
        const dz = gz - cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radius) {
          const h = this.data[base + gx];
          if (h < min) min = h;
          if (h > max) max = h;
          sum += h;
          count++;
        }
      }
    }
    return { min, max, avg: count > 0 ? sum / count : 0 };
  }

  /** Check if area is flat enough for tower placement */
  isFlat(cx: number, cz: number, radius: number, tolerance: number): boolean {
    const { min, max } = this.getBounds(cx, cz, radius);
    return max - min < tolerance;
  }

  /** Get height at world position (bilinear interpolation) */
  getWorldHeight(wx: number, wz: number): number {
    const half = WORLD_SIZE * 0.5;
    const gx = (wx + half) / CELL_SIZE - 0.5;
    const gz = (wz + half) / CELL_SIZE - 0.5;

    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const fx = gx - x0;
    const fz = gz - z0;

    if (x0 < 0 || x0 >= GRID_SIZE - 1 || z0 < 0 || z0 >= GRID_SIZE - 1) return 0;

    const h00 = this.get(x0, z0);
    const h10 = this.get(x0 + 1, z0);
    const h01 = this.get(x0, z0 + 1);
    const h11 = this.get(x0 + 1, z0 + 1);

    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fz;
  }

  /** Reset entire grid */
  reset(): void {
    this.data.fill(0);
    this.clearDirty();
  }

  /** Serialize for localStorage */
  toJSON(): string {
    return JSON.stringify(Array.from(this.data));
  }

  /** Deserialize from localStorage */
  static fromJSON(json: string): HeightGrid {
    const grid = new HeightGrid();
    const arr = JSON.parse(json) as number[];
    grid.data.set(arr);
    return grid;
  }
}