import { filterContours } from "./contour-surface.js?v=0.7.0";
import { splineWeights } from "./cubic-surface.js?v=0.7.0";
import { N, SIZE, CELL, MATERIALS } from "./terrain.js?v=0.7.0";
import { TerrainSurface } from "./terrain-render.js?v=0.7.0";
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const palette = MATERIALS.map((m) => [
  lin(((m.color >> 16) & 255) / 255),
  lin(((m.color >> 8) & 255) / 255),
  lin((m.color & 255) / 255),
]);
export class SurfaceField {
  constructor() {
    this.data = new Float32Array((N + 1) ** 2 * 4);
    this.color = new Uint8Array(this.data.length);
    this.material = new Uint8Array(this.data.length);
    this.coverage = new Uint8Array(this.data.length);
    this.coverageScratch = new Float32Array(this.data.length);
    this.height = new Float32Array((N + 1) ** 2);
    this.heightScratch = new Float32Array(this.height.length);
    this.cache = null;
  }
  sample(x, z, blend = 1) {
    const gx = Math.max(0, Math.min(N, (x + SIZE / 2) / CELL)),
      gz = Math.max(0, Math.min(N, (z + SIZE / 2) / CELL));
    const bx = Math.floor(gx),
      bz = Math.floor(gz),
      wx = splineWeights(gx - bx),
      wz = splineWeights(gz - bz);
    let height = 0;
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const at =
          (Math.max(0, Math.min(N, bz + j - 1)) * (N + 1) +
            Math.max(0, Math.min(N, bx + i - 1))) *
          4;
        height +=
          (this.data[at] + (this.data[at + 1] - this.data[at]) * blend) *
          wx[i] *
          wz[j];
      }
    return height;
  }
  update(terrain, blend = 1, instant = false) {
    if (!this.cache || this.cache.seed !== terrain.seed)
      this.cache = new TerrainSurface(terrain.seed);
    filterContours(terrain.h, this.height, this.heightScratch, N);
    const count = terrain.h.length;
    for (let i = 0; i < count; i++) {
      const j = i * 4,
        k = i * 3,
        mat = terrain.mat[i],
        shade = 1 + this.cache.grain[i] - terrain.compact[i] * 0.16;
      this.data[j] = instant
        ? this.height[i]
        : this.data[j] + (this.data[j + 1] - this.data[j]) * blend;
      this.data[j + 1] = this.height[i];
      this.data[j + 2] = terrain.compact[i];
      this.data[j + 3] = terrain.marks[i];
      this.material[j] = mat === 1 ? 255 : 0;
      this.material[j + 1] = mat === 2 ? 255 : 0;
      this.material[j + 2] = mat === 3 ? 255 : 0;
      this.material[j + 3] = Math.round(terrain.compact[i] * 255);
      for (let c = 0; c < 3; c++)
        this.color[j + c] = Math.round(
          Math.max(
            0,
            Math.min(
              1,
              (mat ? palette[mat][c] : this.cache.natural[k + c]) * shade,
            ),
          ) * 255,
        );
      this.color[j + 3] = 255;
    }
    filterContours(this.material, this.coverage, this.coverageScratch, N, 4);
  }
}
