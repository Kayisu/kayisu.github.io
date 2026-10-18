// Uniform cubic B-spline reconstruction. Positive weights prevent overshoot.
export function splineWeights(t) {
  const a = 1 - t,
    t2 = t * t,
    t3 = t2 * t;
  return [
    (a * a * a) / 6,
    (3 * t3 - 6 * t2 + 4) / 6,
    (-3 * t3 + 3 * t2 + 3 * t + 1) / 6,
    t3 / 6,
  ];
}
export function splineDerivatives(t) {
  return [
    -0.5 * (1 - t) ** 2,
    1.5 * t * t - 2 * t,
    -1.5 * t * t + t + 0.5,
    0.5 * t * t,
  ];
}
export function sampleSpline(field, x, z, n, size) {
  const gx = Math.max(0, Math.min(n, ((x + size / 2) / size) * n)),
    gz = Math.max(0, Math.min(n, ((z + size / 2) / size) * n)),
    bx = Math.floor(gx),
    bz = Math.floor(gz),
    wx = splineWeights(gx - bx),
    wz = splineWeights(gz - bz);
  let height = 0;
  for (let j = 0; j < 4; j++) {
    const row = Math.max(0, Math.min(n, bz + j - 1)) * (n + 1);
    for (let i = 0; i < 4; i++)
      height +=
        field[row + Math.max(0, Math.min(n, bx + i - 1))] * wx[i] * wz[j];
  }
  return height;
}
export function sampleSplineGradient(field, x, z, n, size) {
  const gx = Math.max(0, Math.min(n, ((x + size / 2) / size) * n)),
    gz = Math.max(0, Math.min(n, ((z + size / 2) / size) * n)),
    bx = Math.floor(gx),
    bz = Math.floor(gz),
    wx = splineWeights(gx - bx),
    wz = splineWeights(gz - bz),
    dx = splineDerivatives(gx - bx),
    dz = splineDerivatives(gz - bz);
  let height = 0,
    sx = 0,
    sz = 0;
  for (let j = 0; j < 4; j++) {
    const row = Math.max(0, Math.min(n, bz + j - 1)) * (n + 1);
    for (let i = 0; i < 4; i++) {
      const h = field[row + Math.max(0, Math.min(n, bx + i - 1))];
      height += h * wx[i] * wz[j];
      sx += h * dx[i] * wz[j];
      sz += h * wx[i] * dz[j];
    }
  }
  return { height, dx: (sx * n) / size, dz: (sz * n) / size };
}
