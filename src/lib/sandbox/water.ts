import {
  GRID_SIZE,
  SEA_LEVEL,
  WATER_DIFFUSION,
  WATER_EVAPORATION,
  WATER_LEVEL,
  WATER_STEPS_PER_TICK,
} from './constants';
import { idx, inBounds } from './grid';
import { HeightGrid } from './terrain';

const NEIGHBOR_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export class WaterGrid {
  data: Float32Array;
  next: Float32Array;
  revision = 0;

  constructor() {
    this.data = new Float32Array(GRID_SIZE * GRID_SIZE);
    this.next = new Float32Array(GRID_SIZE * GRID_SIZE);
  }

  get(gx: number, gz: number): number {
    if (!inBounds(gx, gz)) return 0;
    return this.data[idx(gx, gz)];
  }

  set(gx: number, gz: number, value: number): void {
    if (!inBounds(gx, gz)) return;
    const index = idx(gx, gz);
    const nextValue = Math.max(0, value);
    if (this.data[index] === nextValue) return;
    this.data[index] = nextValue;
    this.revision++;
  }

  add(gx: number, gz: number, delta: number): void {
    if (!inBounds(gx, gz)) return;
    const index = idx(gx, gz);
    const nextValue = Math.max(0, this.data[index] + delta);
    if (this.data[index] === nextValue) return;
    this.data[index] = nextValue;
    this.revision++;
  }

  has(gx: number, gz: number): boolean {
    if (!inBounds(gx, gz)) return false;
    return this.data[idx(gx, gz)] > 0.01;
  }

  replace(values: ArrayLike<number>): void {
    this.data.set(values);
    this.next.set(values);
    this.revision++;
  }

  /** Run the configured simulation substeps and publish one visual revision. */
  step(heightGrid: HeightGrid): void {
    let changed = false;
    for (let step = 0; step < WATER_STEPS_PER_TICK; step++) {
      changed = this.singleStep(heightGrid) || changed;
    }
    if (changed) this.revision++;
  }

  private singleStep(heightGrid: HeightGrid): boolean {
    this.next.set(this.data);

    const bottomZ = GRID_SIZE - 1;
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      const index = idx(gx, bottomZ);
      const targetLevel = Math.max(
        SEA_LEVEL,
        heightGrid.data[index] + WATER_LEVEL,
      );
      if (this.next[index] < targetLevel) this.next[index] = targetLevel;
    }

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const row = gz * GRID_SIZE;
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const index = row + gx;
        const waterHere = this.data[index];
        if (waterHere <= 0.001) continue;

        const totalHere = heightGrid.data[index] + waterHere;
        for (const [offsetX, offsetZ] of NEIGHBOR_OFFSETS) {
          const neighborX = gx + offsetX;
          const neighborZ = gz + offsetZ;
          if (!inBounds(neighborX, neighborZ)) continue;

          const neighborIndex = neighborZ * GRID_SIZE + neighborX;
          const totalThere = heightGrid.data[neighborIndex]
            + this.data[neighborIndex];
          const difference = totalHere - totalThere;
          if (difference <= 0.01) continue;

          const flow = Math.min(
            waterHere * 0.25,
            difference * WATER_DIFFUSION,
          );
          this.next[index] -= flow;
          this.next[neighborIndex] += flow;
        }

        if (this.next[index] < 0) this.next[index] = 0;
      }
    }

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const row = gz * GRID_SIZE;
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const index = row + gx;
        const waterHere = this.next[index];
        if (waterHere <= 0.001) continue;

        for (const [offsetX, offsetZ] of NEIGHBOR_OFFSETS) {
          const neighborX = gx + offsetX;
          const neighborZ = gz + offsetZ;
          if (!inBounds(neighborX, neighborZ)) continue;

          const neighborIndex = neighborZ * GRID_SIZE + neighborX;
          const difference = waterHere - this.next[neighborIndex];
          if (difference <= 0.005) continue;

          const flow = difference * 0.1;
          this.next[index] -= flow;
          this.next[neighborIndex] += flow;
        }
      }
    }

    let changed = false;
    for (let index = 0; index < this.next.length; index++) {
      if (this.next[index] > 0) {
        this.next[index] = Math.max(0, this.next[index] - WATER_EVAPORATION);
        if (this.next[index] < 0.001) this.next[index] = 0;
      }
      if (this.next[index] !== this.data[index]) changed = true;
    }

    const current = this.data;
    this.data = this.next;
    this.next = current;
    return changed;
  }

  addWater(gx: number, gz: number, amount: number): void {
    this.add(gx, gz, amount);
  }

  reset(): void {
    this.data.fill(0);
    this.next.fill(0);
    this.revision++;
  }

  toJSON(): string {
    return JSON.stringify(Array.from(this.data));
  }

  static fromJSON(json: string): WaterGrid {
    const grid = new WaterGrid();
    grid.replace(JSON.parse(json) as number[]);
    return grid;
  }
}
