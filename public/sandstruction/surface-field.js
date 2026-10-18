import { N, MATERIALS } from "./terrain.js?v=0.5.0";
import { TerrainSurface } from "./terrain-render.js?v=0.5.0";
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
    this.cache = null;
  }
  update(terrain, blend = 1, instant = false) {
    if (!this.cache || this.cache.seed !== terrain.seed)
      this.cache = new TerrainSurface(terrain.seed);
    const count = terrain.h.length;
    for (let i = 0; i < count; i++) {
      const j = i * 4,
        k = i * 3,
        mat = terrain.mat[i],
        shade =
          (1 - terrain.marks[i] * 0.25) *
          (1 + this.cache.grain[i] - terrain.compact[i] * 0.16);
      this.data[j] = instant
        ? terrain.h[i]
        : this.data[j] + (this.data[j + 1] - this.data[j]) * blend;
      this.data[j + 1] = terrain.h[i];
      this.data[j + 2] = terrain.compact[i];
      this.data[j + 3] = terrain.marks[i];
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
  }
}
