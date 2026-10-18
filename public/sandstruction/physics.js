import { clamp } from "./terrain.js?v=0.5.0";

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
  const desired = Number.isFinite(input.throttle)
    ? clamp(input.throttle, -1, 1)
    : (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const braking =
    desired &&
    Math.sign(v.speed) !== Math.sign(desired) &&
    Math.abs(v.speed) > 0.2;
  const acceleration = v.id === "shovel" ? 8 : 2.7;
  v.speed += desired * (braking ? 7.5 : acceleration) * dt;
  if (!desired || input.brake)
    v.speed *= Math.exp(-dt * (input.brake ? 14 : 2.1));
  v.speed = clamp(v.speed, -v.max * 0.45, v.max * grip);
  if (Math.abs(v.speed) < 0.015) v.speed = 0;
  const turn = Number.isFinite(input.steer)
    ? clamp(input.steer, -1, 1)
    : (input.left ? 1 : 0) - (input.right ? 1 : 0);
  v.steer =
    (v.steer || 0) + (turn * 0.48 - (v.steer || 0)) * (1 - Math.exp(-dt * 8));
  const oldAngle = v.angle;
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
    if (v.id === "dozer") {
      const w = Number.isFinite(v.bladeWidth)
          ? clamp(v.bladeWidth, 1.2, 6)
          : 3.2,
        r = other.radius ?? (other.id === "shovel" ? 0.32 : 1.45);
      const distance = (px, pz, angle) => {
        const dx = -Math.sin(angle),
          dz = -Math.cos(angle),
          rx = other.x - (px + dx * 2.05),
          rz = other.z - (pz + dz * 2.05);
        return Math.hypot(
          Math.max(0, Math.abs(rx * dz - rz * dx) - w / 2),
          Math.max(0, Math.abs(rx * dx + rz * dz) - 0.4),
        );
      };
      if (
        distance(x, z, v.angle) < r &&
        distance(x, z, v.angle) < distance(ox, oz, oldAngle)
      ) {
        x = ox;
        z = oz;
        v.angle = oldAngle;
        v.speed = 0;
        collision = true;
        break;
      }
    }
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
