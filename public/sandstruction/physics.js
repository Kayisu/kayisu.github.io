import { clamp } from "./terrain.js?v=0.3.0";

export function stepVehicle(v, input, terrain, others, dt) {
  dt = clamp(dt, 0, 0.05);
  const index = terrain.nearest(v.x, v.z),
    material = terrain.mat[index];
  const grip =
    material === 3
      ? 1
      : material === 1
        ? 0.64 + terrain.compact[index] * 0.25
        : 0.85;
  const desired = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const braking =
    desired && Math.sign(v.speed) !== desired && Math.abs(v.speed) > 0.2;
  const acceleration = v.id === "shovel" ? 8 : 2.7;
  v.speed += desired * (braking ? 7.5 : acceleration) * dt;
  if (!desired || input.brake)
    v.speed *= Math.exp(-dt * (input.brake ? 14 : 2.1));
  v.speed = clamp(v.speed, -v.max * 0.45, v.max * grip);
  if (Math.abs(v.speed) < 0.015) v.speed = 0;
  const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  v.steer =
    (v.steer || 0) + (turn * 0.48 - (v.steer || 0)) * (1 - Math.exp(-dt * 8));
  v.angle +=
    v.steer * dt * (v.id === "shovel" ? 4 : 1.8) * clamp(v.speed / 1.5, -1, 1);
  const ox = v.x,
    oz = v.z,
    nx = ox - Math.sin(v.angle) * v.speed * dt,
    nz = oz - Math.cos(v.angle) * v.speed * dt;
  const slope =
    (terrain.sample(nx, nz) - terrain.sample(ox, oz)) /
    Math.max(0.02, Math.abs(v.speed * dt));
  const resistance = clamp(1 - Math.max(0, slope) * 0.45, 0.08, 1);
  let x = clamp(ox + (nx - ox) * resistance, -45, 45),
    z = clamp(oz + (nz - oz) * resistance, -45, 45);
  let collision = false;
  const radius = v.id === "shovel" ? 0.32 : 1.45;
  for (const other of others) {
    if (other === v) continue;
    const combined =
      radius + (other.radius ?? (other.id === "shovel" ? 0.32 : 1.45));
    const before = Math.hypot(ox - other.x, oz - other.z),
      after = Math.hypot(x - other.x, z - other.z);
    // Permit separating from overlaps introduced by old saves.
    if (after < combined && after < before) {
      x = ox;
      z = oz;
      v.speed = 0;
      collision = true;
      break;
    }
  }
  v.x = x;
  v.z = z;
  return { distance: Math.hypot(x - ox, z - oz), collision, slope };
}
