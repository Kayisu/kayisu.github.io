/** Pure heightfield maths for the construction toy's sand lot. No framework imports. */

export const LOT_SIZE = 8;
export const GRID = 48;
export const STEP = LOT_SIZE / (GRID - 1);
export const BASE_HEIGHT = 0.3;
export const MIN_HEIGHT = 0;
export const MAX_HEIGHT = 1.4;

const HALF = LOT_SIZE / 2;
const BUMP = 0.08;
const COARSE = 7;
const REPOSE = 0.18;
const RELAX_RATE = 0.25;
const BLADE_WIDTH = 0.9;
const BLADE_DEPTH = 0.25;
const PUSH_AHEAD = 0.35;

export interface SandLot {
  /** Vertex heights, row-major: index = j * GRID + i, x = -4 + i * STEP, z = -4 + j * STEP. */
  heights: Float64Array;
}

function seeded(seed: number) {
  let value = seed % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const smooth = (t: number) => t * t * (3 - 2 * t);
const toGrid = (coordinate: number) => (coordinate + HALF) / STEP;

export const vertexX = (index: number) => -HALF + (index % GRID) * STEP;
export const vertexZ = (index: number) => -HALF + Math.floor(index / GRID) * STEP;

/** A flat lot with gentle seeded bumps: a coarse random lattice, smoothly interpolated. */
export function createLot(seed = 1): SandLot {
  const random = seeded(seed);
  const coarse = Array.from({ length: COARSE * COARSE }, () => (random() * 2 - 1) * BUMP);
  const heights = new Float64Array(GRID * GRID);
  const cell = (t: number) => {
    const u = (t / (GRID - 1)) * (COARSE - 1);
    const base = Math.min(Math.floor(u), COARSE - 2);
    return [base, smooth(u - base)] as const;
  };
  for (let j = 0; j < GRID; j++) {
    const [cj, tj] = cell(j);
    for (let i = 0; i < GRID; i++) {
      const [ci, ti] = cell(i);
      const at = (di: number, dj: number) => coarse[(cj + dj) * COARSE + ci + di];
      const top = at(0, 0) + (at(1, 0) - at(0, 0)) * ti;
      const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * ti;
      heights[j * GRID + i] = BASE_HEIGHT + top + (bottom - top) * tj;
    }
  }
  return { heights };
}

/** Bilinear height at a world position; positions outside the lot read the nearest edge. */
export function sampleHeight(lot: SandLot, x: number, z: number) {
  const gx = clamp(toGrid(x), 0, GRID - 1);
  const gz = clamp(toGrid(z), 0, GRID - 1);
  const i = Math.min(Math.floor(gx), GRID - 2);
  const j = Math.min(Math.floor(gz), GRID - 2);
  const fx = gx - i;
  const fz = gz - j;
  const h = lot.heights;
  const k = j * GRID + i;
  const top = h[k] + (h[k + 1] - h[k]) * fx;
  const bottom = h[k + GRID] + (h[k + GRID + 1] - h[k + GRID]) * fx;
  return top + (bottom - top) * fz;
}

/** Calls `visit` for every vertex within `radius` of (x, z). */
function forEachNear(x: number, z: number, radius: number, visit: (index: number, distance: number) => void) {
  const i0 = Math.max(0, Math.ceil(toGrid(x - radius)));
  const i1 = Math.min(GRID - 1, Math.floor(toGrid(x + radius)));
  const j0 = Math.max(0, Math.ceil(toGrid(z - radius)));
  const j1 = Math.min(GRID - 1, Math.floor(toGrid(z + radius)));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const index = j * GRID + i;
      const distance = Math.hypot(vertexX(index) - x, vertexZ(index) - z);
      if (distance <= radius) visit(index, distance);
    }
  }
}

/** Adds a smooth mound: `amount` at the centre, falling to zero at `radius`. */
export function pile(lot: SandLot, x: number, z: number, amount = 0.15, radius = 0.5) {
  forEachNear(x, z, radius, (index, distance) => {
    const t = distance / radius;
    lot.heights[index] = clamp(lot.heights[index] + amount * (1 - t * t) ** 2, MIN_HEIGHT, MAX_HEIGHT);
  });
}

/** Splats `amount` bilinearly at (x, z) without exceeding MAX_HEIGHT; returns what did not fit. */
function deposit(lot: SandLot, x: number, z: number, amount: number) {
  const gx = clamp(toGrid(x), 0, GRID - 1);
  const gz = clamp(toGrid(z), 0, GRID - 1);
  const i = Math.min(Math.floor(gx), GRID - 2);
  const j = Math.min(Math.floor(gz), GRID - 2);
  const fx = gx - i;
  const fz = gz - j;
  const k = j * GRID + i;
  let leftover = 0;
  for (const [index, weight] of [[k, (1 - fx) * (1 - fz)], [k + 1, fx * (1 - fz)], [k + GRID, (1 - fx) * fz], [k + GRID + 1, fx * fz]]) {
    const add = amount * weight;
    const put = Math.min(add, MAX_HEIGHT - lot.heights[index]);
    lot.heights[index] += put;
    leftover += add - put;
  }
  return leftover;
}

/**
 * Scrapes the blade footprint centred at (x, z) facing `heading` down towards `floor`, at most
 * `cut` per vertex, and drops the same volume PUSH_AHEAD further forward. Returns the volume moved
 * in height units (multiply by STEP² for world volume).
 */
export function bladePush(lot: SandLot, x: number, z: number, heading: number, cut: number, floor: number) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const level = Math.max(MIN_HEIGHT, floor);
  let moved = 0;
  forEachNear(x, z, Math.hypot(BLADE_WIDTH, BLADE_DEPTH) / 2, (index) => {
    const dx = vertexX(index) - x;
    const dz = vertexZ(index) - z;
    if (Math.abs(dx * fx + dz * fz) > BLADE_DEPTH / 2 || Math.abs(dx * fz - dz * fx) > BLADE_WIDTH / 2) return;
    const take = Math.min(cut, lot.heights[index] - level);
    if (take <= 0) return;
    lot.heights[index] -= take;
    // put + leftover = take, so the source never ends above its original height.
    const leftover = deposit(lot, vertexX(index) + fx * PUSH_AHEAD, vertexZ(index) + fz * PUSH_AHEAD, take);
    lot.heights[index] += leftover;
    moved += take - leftover;
  });
  return moved;
}

/** One angle-of-repose pass over all 4-neighbour pairs. Returns the largest height change. */
export function relaxStep(lot: SandLot) {
  const h = lot.heights;
  const delta = new Float64Array(h.length);
  const settle = (a: number, b: number) => {
    const difference = h[a] - h[b];
    const excess = Math.abs(difference) - REPOSE;
    if (excess <= 0) return;
    const flow = Math.sign(difference) * RELAX_RATE * excess;
    delta[a] -= flow;
    delta[b] += flow;
  };
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const index = j * GRID + i;
      if (i < GRID - 1) settle(index, index + 1);
      if (j < GRID - 1) settle(index, index + GRID);
    }
  }
  let largest = 0;
  // Every vertex moves towards a convex mix of its neighbours, so no clamp is needed here.
  for (let index = 0; index < h.length; index++) {
    h[index] += delta[index];
    largest = Math.max(largest, Math.abs(delta[index]));
  }
  return largest;
}

/** Total sand volume in world units³. */
export function volume(lot: SandLot) {
  let sum = 0;
  for (const height of lot.heights) sum += height;
  return sum * STEP * STEP;
}
