import { splineWeights, splineDerivatives } from "./cubic-surface.js?v=0.7.0";

// Resolve raster stair steps before cubic reconstruction. This small symmetric
// kernel rounds the shoulder profile; material sharpness is handled separately.
const KERNEL = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
const bounded = (v, n) => Math.max(0, Math.min(n, v));
export function filterContours(source, target, scratch, n, channels = 1) {
  const stride = n + 1,
    rowSize = stride * channels;
  for (let z = 0; z <= n; z++)
    for (let x = 0; x <= n; x++) {
      const at = (z * stride + x) * channels;
      const a = (z * stride + Math.max(0, x - 2)) * channels,
        b = (z * stride + Math.max(0, x - 1)) * channels;
      const d = (z * stride + Math.min(n, x + 1)) * channels,
        e = (z * stride + Math.min(n, x + 2)) * channels;
      for (let c = 0; c < channels; c++)
        scratch[at + c] =
          (source[a + c] +
            4 * source[b + c] +
            6 * source[at + c] +
            4 * source[d + c] +
            source[e + c]) /
          16;
    }
  for (let z = 0; z <= n; z++) {
    const a = Math.max(0, z - 2) * rowSize,
      b = Math.max(0, z - 1) * rowSize,
      at = z * rowSize,
      d = Math.min(n, z + 1) * rowSize,
      e = Math.min(n, z + 2) * rowSize;
    for (let c = 0; c < rowSize; c++)
      target[at + c] =
        (scratch[a + c] +
          4 * scratch[b + c] +
          6 * scratch[at + c] +
          4 * scratch[d + c] +
          scratch[e + c]) /
        16;
  }
  return target;
}
function axis(g, n, derivative = false) {
  const base = Math.floor(g),
    start = Math.max(0, base - 3),
    end = Math.min(n, base + 4),
    weights = new Float64Array(end - start + 1);
  const cubic = derivative
    ? splineDerivatives(g - base)
    : splineWeights(g - base);
  // Clamp twice, exactly like filtering the lattice then sampling its texture.
  for (let i = 0; i < 4; i++)
    for (let k = 0; k < 5; k++) {
      const q = bounded(bounded(base + i - 1, n) + k - 2, n);
      weights[q - start] += cubic[i] * KERNEL[k];
    }
  return { start, weights };
}
function reconstruct(field, x, z, n, size, gradient) {
  const gx = bounded(((x + size / 2) / size) * n, n),
    gz = bounded(((z + size / 2) / size) * n, n);
  const ax = axis(gx, n),
    az = axis(gz, n),
    dx = gradient ? axis(gx, n, true) : null,
    dz = gradient ? axis(gz, n, true) : null;
  let height = 0,
    sx = 0,
    sz = 0;
  for (let j = 0; j < az.weights.length; j++)
    for (let i = 0; i < ax.weights.length; i++) {
      const h = field[(az.start + j) * (n + 1) + ax.start + i];
      height += h * ax.weights[i] * az.weights[j];
      if (gradient) {
        sx += h * dx.weights[i] * az.weights[j];
        sz += h * ax.weights[i] * dz.weights[j];
      }
    }
  return gradient
    ? { height, dx: (sx * n) / size, dz: (sz * n) / size }
    : height;
}
export function sampleContour(field, x, z, n, size) {
  return reconstruct(field, x, z, n, size, false);
}
export function sampleContourGradient(field, x, z, n, size) {
  return reconstruct(field, x, z, n, size, true);
}
export function shoulderCoverage(distance, halfWidth, feather = 0.55) {
  const t = Math.max(
    0,
    Math.min(1, (halfWidth + feather - distance) / (2 * feather)),
  );
  return t * t * (3 - 2 * t);
}
