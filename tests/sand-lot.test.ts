import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASE_HEIGHT, GRID, MAX_HEIGHT, MIN_HEIGHT, STEP,
  bladePush, createLot, pile, relaxStep, sampleHeight, vertexX, vertexZ, volume,
} from '../src/lib/construction/sandLot';

const EPSILON = 1e-9;
const range = (lot: ReturnType<typeof createLot>) => [Math.min(...lot.heights), Math.max(...lot.heights)];

test('lot is deterministic, gently bumped, and starts settled', () => {
  const lot = createLot(7);
  assert.deepEqual(createLot(7).heights, lot.heights);
  assert.notDeepEqual(createLot(8).heights, lot.heights);
  assert.equal(lot.heights.length, GRID * GRID);
  const [low, high] = range(lot);
  assert.ok(low >= BASE_HEIGHT - 0.08 - EPSILON && high <= BASE_HEIGHT + 0.08 + EPSILON);
  assert.ok(high - low > 0.02, 'bumps are visible');
  assert.equal(relaxStep(lot), 0);
});

test('pile raises the tapped vertex by 0.15 and leaves cells beyond the radius untouched', () => {
  const lot = createLot(3);
  const before = Float64Array.from(lot.heights);
  const centre = 20 * GRID + 20;
  const [x, z] = [vertexX(centre), vertexZ(centre)];
  pile(lot, x, z);
  assert.ok(Math.abs(lot.heights[centre] - before[centre] - 0.15) < EPSILON);
  for (let index = 0; index < lot.heights.length; index++) {
    const distance = Math.hypot(vertexX(index) - x, vertexZ(index) - z);
    const raised = lot.heights[index] - before[index];
    if (distance > 0.5) assert.equal(raised, 0);
    else assert.ok(raised >= 0 && raised <= 0.15 + EPSILON);
  }
  assert.ok(Math.abs(sampleHeight(lot, x, z) - lot.heights[centre]) < EPSILON);
});

test('blade push conserves volume, lowers the footprint and builds a berm ahead', () => {
  const lot = createLot(5);
  pile(lot, 0, 0, 0.4, 0.8);
  const total = volume(lot);
  const footprintBefore = sampleHeight(lot, 0, 0);
  const aheadBefore = sampleHeight(lot, 0.35, 0);
  const moved = bladePush(lot, 0, 0, Math.PI / 2, 0.1, BASE_HEIGHT);
  assert.ok(moved > 0);
  assert.ok(Math.abs(volume(lot) - total) < EPSILON);
  assert.ok(sampleHeight(lot, 0, 0) < footprintBefore);
  assert.ok(sampleHeight(lot, 0.35, 0) > aheadBefore);
});

test('blade push conserves volume at the lot edge and against a full column', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
    const lot = createLot(9);
    for (let index = 0; index < lot.heights.length; index++) if (vertexX(index) > 3.3) lot.heights[index] = MAX_HEIGHT;
    const total = volume(lot);
    for (let step = 0; step < 40; step++) bladePush(lot, 3.5, 3.9, heading, 0.05, 0);
    assert.ok(Math.abs(volume(lot) - total) < EPSILON, `heading ${heading}`);
    const [low, high] = range(lot);
    assert.ok(low >= MIN_HEIGHT && high <= MAX_HEIGHT + EPSILON);
  }
});

test('relaxation conserves volume and settles below the repose angle', () => {
  const lot = createLot(11);
  for (let tap = 0; tap < 12; tap++) pile(lot, 1, -1, 0.3, 0.3);
  const total = volume(lot);
  let change = Infinity;
  let steps = 0;
  while (change >= 1e-4 && steps < 2000) {
    change = relaxStep(lot);
    steps++;
    assert.ok(Math.abs(volume(lot) - total) < EPSILON);
  }
  assert.ok(steps < 2000, 'lot settles');
  for (let index = 0; index < lot.heights.length - 1; index++) {
    if ((index + 1) % GRID) assert.ok(Math.abs(lot.heights[index] - lot.heights[index + 1]) < 0.18 + 1e-3);
    if (index + GRID < lot.heights.length) assert.ok(Math.abs(lot.heights[index] - lot.heights[index + GRID]) < 0.18 + 1e-3);
  }
});

test('heights stay within [0, 1.4] under repeated piling and digging', () => {
  const lot = createLot(13);
  for (let tap = 0; tap < 30; tap++) pile(lot, -2, 2);
  assert.equal(range(lot)[1], MAX_HEIGHT);
  for (let pass = 0; pass < 60; pass++) bladePush(lot, -2, 2 - pass * STEP * 0.1, Math.PI, 0.2, -5);
  for (let pass = 0; pass < 200; pass++) relaxStep(lot);
  const [low, high] = range(lot);
  assert.ok(low >= MIN_HEIGHT && high <= MAX_HEIGHT + EPSILON);
});
