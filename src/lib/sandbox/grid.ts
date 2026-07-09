import { GRID_SIZE, WORLD_SIZE, CELL_SIZE } from './constants';

/** Convert world X/Z to grid coordinates (clamped) */
export function worldToGrid(worldX: number, worldZ: number): { gx: number; gz: number } {
  const half = WORLD_SIZE * 0.5;
  const gx = Math.floor(((worldX + half) / WORLD_SIZE) * GRID_SIZE);
  const gz = Math.floor(((worldZ + half) / WORLD_SIZE) * GRID_SIZE);
  return {
    gx: Math.max(0, Math.min(GRID_SIZE - 1, gx)),
    gz: Math.max(0, Math.min(GRID_SIZE - 1, gz)),
  };
}

/** Convert grid coordinates to world X/Z (cell center) */
export function gridToWorld(gx: number, gz: number): { x: number; z: number } {
  const half = WORLD_SIZE * 0.5;
  const x = (gx + 0.5) * CELL_SIZE - half;
  const z = (gz + 0.5) * CELL_SIZE - half;
  return { x, z };
}

/** Get 1D index from 2D grid coords */
export function idx(gx: number, gz: number): number {
  return gz * GRID_SIZE + gx;
}

/** Get 2D coords from 1D index */
export function coords(i: number): { gx: number; gz: number } {
  return { gx: i % GRID_SIZE, gz: Math.floor(i / GRID_SIZE) };
}

/** Check if grid coordinate is in bounds */
export function inBounds(gx: number, gz: number): boolean {
  return gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE;
}

/** 4-connected neighbors */
export function neighbors4(gx: number, gz: number): Array<{ gx: number; gz: number }> {
  const out: Array<{ gx: number; gz: number }> = [];
  if (gx > 0) out.push({ gx: gx - 1, gz });
  if (gx < GRID_SIZE - 1) out.push({ gx: gx + 1, gz });
  if (gz > 0) out.push({ gx, gz: gz - 1 });
  if (gz < GRID_SIZE - 1) out.push({ gx, gz: gz + 1 });
  return out;
}

/** 8-connected neighbors (for smoothing) */
export function neighbors8(gx: number, gz: number): Array<{ gx: number; gz: number }> {
  const out: Array<{ gx: number; gz: number }> = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const nx = gx + dx;
      const nz = gz + dz;
      if (inBounds(nx, nz)) out.push({ gx: nx, gz: nz });
    }
  }
  return out;
}

/** Iterate all grid cells */
export function forEachCell(fn: (gx: number, gz: number, i: number) => void): void {
  for (let gz = 0; gz < GRID_SIZE; gz++) {
    const base = gz * GRID_SIZE;
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      fn(gx, gz, base + gx);
    }
  }
}