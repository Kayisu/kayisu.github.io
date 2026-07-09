import { GRID_SIZE, WATER_LEVEL, SEA_LEVEL, WATER_DIFFUSION, WATER_EVAPORATION, WATER_STEPS_PER_FRAME } from './constants';
import { idx, inBounds, neighbors4, forEachCell } from './grid';
import { HeightGrid } from './terrain';

export class WaterGrid {
  data: Float32Array;    // water depth (0 = dry)
  next: Float32Array;    // next frame buffer
  dirty: Uint8Array;     // cells that changed this frame

  constructor() {
    this.data = new Float32Array(GRID_SIZE * GRID_SIZE);
    this.next = new Float32Array(GRID_SIZE * GRID_SIZE);
    this.dirty = new Uint8Array(GRID_SIZE * GRID_SIZE);
  }

  get(gx: number, gz: number): number {
    if (!inBounds(gx, gz)) return 0;
    return this.data[idx(gx, gz)];
  }

  set(gx: number, gz: number, value: number): void {
    if (!inBounds(gx, gz)) return;
    const i = idx(gx, gz);
    this.data[i] = Math.max(0, value);
    this.dirty[i] = 1;
  }

  add(gx: number, gz: number, delta: number): void {
    if (!inBounds(gx, gz)) return;
    const i = idx(gx, gz);
    this.data[i] = Math.max(0, this.data[i] + delta);
    this.dirty[i] = 1;
  }

  has(gx: number, gz: number): boolean {
    if (!inBounds(gx, gz)) return false;
    return this.data[idx(gx, gz)] > 0.01;
  }

  clearDirty(): void {
    this.dirty.fill(0);
  }

  /** Check if any water exists and mark dirty cells for rendering update */
  getDirtyCells(): Array<{ gx: number; gz: number }> {
    const out: Array<{ gx: number; gz: number }> = [];
    for (let i = 0; i < this.dirty.length; i++) {
      if (this.dirty[i]) {
        out.push({ gx: i % GRID_SIZE, gz: Math.floor(i / GRID_SIZE) });
      }
    }
    return out;
  }

  /** 
   * Cellular automata water simulation:
   * - Water flows from higher total elevation (terrain + water) to lower
   * - Ocean source at bottom edge maintains SEA_LEVEL
   * - Diffusion spreads water to neighbors
   * - Evaporation slowly removes water
   */
  step(heightGrid: HeightGrid): void {
    // Multiple sub-steps per frame for stability
    for (let step = 0; step < WATER_STEPS_PER_FRAME; step++) {
      this.singleStep(heightGrid);
    }
  }

  private singleStep(heightGrid: HeightGrid): void {
    this.clearDirty();
    this.next.set(this.data); // copy current to next

    // 1. Ocean boundary condition: bottom row (z = GRID_SIZE - 1) connects to sea
    const bottomZ = GRID_SIZE - 1;
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const i = idx(gx, bottomZ);
      const terrainH = heightGrid.data[i];
      const targetLevel = Math.max(SEA_LEVEL, terrainH + WATER_LEVEL);
      if (this.next[i] < targetLevel) {
        this.next[i] = targetLevel;
        this.dirty[i] = 1;
      }
    }

    // 2. Flow simulation: water moves from high total elevation to low
    // Total elevation = terrain + water
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const base = gz * GRID_SIZE;
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const i = base + gx;
        const waterHere = this.data[i];
        if (waterHere <= 0.001) continue;

        const terrainHere = heightGrid.data[i];
        const totalHere = terrainHere + waterHere;

        // Check 4 neighbors
        const nbs = neighbors4(gx, gz);
        let totalOutflow = 0;

        for (const nb of nbs) {
          const j = idx(nb.gx, nb.gz);
          const terrainThere = heightGrid.data[j];
          const waterThere = this.data[j];
          const totalThere = terrainThere + waterThere;

          // Flow if neighbor is lower
          const diff = totalHere - totalThere;
          if (diff > 0.01) {
            const flow = Math.min(waterHere * 0.25, diff * WATER_DIFFUSION);
            this.next[i] -= flow;
            this.next[j] += flow;
            totalOutflow += flow;
            this.dirty[i] = 1;
            this.dirty[j] = 1;
          }
        }

        // Clamp
        if (this.next[i] < 0) this.next[i] = 0;
      }
    }

    // 3. Diffusion: spread water to equalize (even on flat terrain)
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const base = gz * GRID_SIZE;
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const i = base + gx;
        const waterHere = this.next[i];
        if (waterHere <= 0.001) continue;

        const nbs = neighbors4(gx, gz);
        let totalDiff = 0;

        for (const nb of nbs) {
          const j = idx(nb.gx, nb.gz);
          const diff = waterHere - this.next[j];
          if (diff > 0.005) {
            const flow = diff * 0.1;
            this.next[i] -= flow;
            this.next[j] += flow;
            totalDiff += flow;
            this.dirty[i] = 1;
            this.dirty[j] = 1;
          }
        }
      }
    }

    // 4. Evaporation
    for (let i = 0; i < this.next.length; i++) {
      if (this.next[i] > 0) {
        this.next[i] = Math.max(0, this.next[i] - WATER_EVAPORATION);
        if (this.next[i] < 0.001) this.next[i] = 0;
        if (this.next[i] !== this.data[i]) this.dirty[i] = 1;
      }
    }

    // Swap buffers
    const tmp = this.data;
    this.data = this.next;
    this.next = tmp;
  }

  /** Add water at a cell (e.g., from digging connecting to ocean) */
  addWater(gx: number, gz: number, amount: number): void {
    this.add(gx, gz, amount);
  }

  /** Reset entire grid */
  reset(): void {
    this.data.fill(0);
    this.next.fill(0);
    this.dirty.fill(0);
  }

  /** Serialize for localStorage */
  toJSON(): string {
    return JSON.stringify(Array.from(this.data));
  }

  /** Deserialize from localStorage */
  static fromJSON(json: string): WaterGrid {
    const grid = new WaterGrid();
    const arr = JSON.parse(json) as number[];
    grid.data.set(arr);
    return grid;
  }
}