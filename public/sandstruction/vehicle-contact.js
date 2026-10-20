// Contact samples are in model space. The same YXZ transform is used by Three.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const footprints = new Map();
function wheel(points, x, z, r, halfWidth = 0.22) {
  for (const side of [-halfWidth, 0, halfWidth])
    for (const f of [-0.7, -0.35, 0, 0.35, 0.7])
      points.push({
        x: x + side,
        y: r - Math.sqrt(r * r - (r * f) ** 2) - 0.025,
        z: z + r * f,
      });
}
export function contactPoints(id) {
  if (footprints.has(id)) return footprints.get(id);
  const p = [];
  if (id === "truck")
    for (const x of [-1, 1])
      for (const z of [-1.35, 0.8, 1.5]) wheel(p, x, z, 0.54);
  if (id === "loader")
    for (const x of [-1, 1])
      for (const z of [-1.05, 1.05]) wheel(p, x, z, 0.64);
  if (id === "roller") {
    for (const x of [-0.9, 0.9]) wheel(p, x, 1, 0.6);
    for (const x of [-0.92, -0.46, 0, 0.46, 0.92])
      wheel(p, x, -1.25, 0.67, 0.22);
  }
  if (id === "dozer" || id === "paver")
    for (const x of [-1.34, -1.05, -0.76, 0.76, 1.05, 1.34])
      for (let z = -1.62; z <= 1.63; z += 0.27) p.push({ x, y: 0.025, z });
  // Belly samples also bridge crests between axles/tracks.
  if (id !== "shovel")
    for (const x of [-0.6, 0, 0.6])
      for (const z of [-1, -0.5, 0, 0.5, 1]) p.push({ x, y: 0.48, z });
  else
    for (const x of [-0.25, 0, 0.25])
      for (const z of [-0.3, 0, 0.18]) p.push({ x, y: 0.02, z });
  footprints.set(id, p);
  return p;
}
export function rotateContact(p, yaw, pitch, roll) {
  const cz = Math.cos(roll),
    sz = Math.sin(roll),
    cx = Math.cos(pitch),
    sx = Math.sin(pitch),
    cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const x = cz * p.x - sz * p.y,
    y = sz * p.x + cz * p.y;
  const yy = cx * y - sx * p.z,
    z = sx * y + cx * p.z;
  return { x: cy * x + sy * z, y: yy, z: -sy * x + cy * z };
}
export function solveContact(vehicle, sample, dt = 1 / 60, previous) {
  const { x, z, angle = 0, id } = vehicle,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const at = (lx, lz) => sample(x + c * lx + s * lz, z - s * lx + c * lz);
  const span = id === "shovel" ? 0.25 : 1.15;
  const targetPitch = clamp(
    Math.atan2(at(0, -span) - at(0, span), 2 * span),
    -0.48,
    0.48,
  );
  const targetRoll = clamp(
    Math.atan2(at(span, 0) - at(-span, 0), 2 * span),
    -0.48,
    0.48,
  );
  const blend = previous ? 1 - Math.exp(-12 * dt) : 1;
  const pitch = previous
    ? previous.pitch + (targetPitch - previous.pitch) * blend
    : targetPitch;
  const roll = previous
    ? previous.roll + (targetRoll - previous.roll) * blend
    : targetRoll;
  let floor = -Infinity;
  for (const p of contactPoints(id)) {
    const q = rotateContact(p, angle, pitch, roll);
    floor = Math.max(floor, sample(x + q.x, z + q.z) - q.y + 0.025);
  }
  // Never damp upward into the ground. Downward settling remains gentle.
  const y = previous
    ? Math.max(
        floor,
        previous.y + (floor - previous.y) * (1 - Math.exp(-18 * dt)),
      )
    : floor;
  return { y, pitch, roll };
}

// Compatibility renderer: sample the exact two triangles and interpolation used
// by PlaneGeometry, rather than querying the next simulation height too early.
export function sampleDisplayMesh(positions, previous, blend, x, z, n, size) {
  const gx = clamp(((x + size / 2) * n) / size, 0, n),
    gz = clamp(((z + size / 2) * n) / size, 0, n);
  const ix = Math.min(n - 1, Math.floor(gx)),
    iz = Math.min(n - 1, Math.floor(gz)),
    fx = gx - ix,
    fz = gz - iz;
  const at = (xx, zz) => {
    const i = zz * (n + 1) + xx;
    return previous[i] + (positions[i * 3 + 1] - previous[i]) * blend;
  };
  const a = at(ix, iz),
    b = at(ix + 1, iz),
    c = at(ix, iz + 1),
    d = at(ix + 1, iz + 1);
  return fx + fz <= 1
    ? a + (b - a) * fx + (c - a) * fz
    : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}
