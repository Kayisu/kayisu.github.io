import { N, CELL, MATERIALS, random } from "./terrain.js?v=0.4.0";
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex) => [
  linear(((hex >> 16) & 255) / 255),
  linear(((hex >> 8) & 255) / 255),
  linear((hex & 255) / 255),
];
const palettes = MATERIALS.map((m) => rgb(m.color)),
  green = rgb(0x87936a),
  patch = rgb(0xa6a47a),
  road = rgb(0x999172);
export class TerrainSurface {
  constructor(seed) {
    this.seed = seed;
    this.natural = new Float32Array((N + 1) ** 2 * 3);
    this.grain = new Float32Array((N + 1) ** 2);
    const phase = random(seed)() * 20;
    for (let z = 0; z <= N; z++)
      for (let x = 0; x <= N; x++) {
        const i = z * (N + 1) + x,
          wx = x * CELL - 48,
          wz = z * CELL - 48,
          v = (Math.sin(wx * 0.73 + wz * 0.52) * 0.5 + 0.5) * 0.45,
          onRoad = Math.abs(wx - 6 * Math.sin(wz * 0.065 + phase)) < 3.6;
        for (let c = 0; c < 3; c++)
          this.natural[i * 3 + c] = onRoad
            ? road[c]
            : green[c] + (patch[c] - green[c]) * v;
        this.grain[i] = Math.sin(wx * 7.1 + wz * 3.7) * 0.035;
      }
  }
  write(
    terrain,
    positions,
    colors,
    normals,
    previous,
    blend = 1,
    instant = false,
  ) {
    const stride = N + 1,
      h = terrain.h;
    for (let z = 0; z <= N; z++)
      for (let x = 0; x <= N; x++) {
        const i = z * stride + x,
          j = i * 3,
          mat = terrain.mat[i],
          shade =
            (1 - terrain.marks[i] * 0.25) *
            (1 + this.grain[i] - terrain.compact[i] * 0.16);
        previous[i] = instant
          ? h[i]
          : previous[i] + (positions[j + 1] - previous[i]) * blend;
        positions[j + 1] = h[i];
        const dx =
            (h[i + (x < N ? 1 : 0)] - h[i - (x > 0 ? 1 : 0)]) /
            ((x === 0 || x === N ? 1 : 2) * CELL),
          dz =
            (h[i + (z < N ? stride : 0)] - h[i - (z > 0 ? stride : 0)]) /
            ((z === 0 || z === N ? 1 : 2) * CELL),
          inv = 1 / Math.sqrt(dx * dx + dz * dz + 1);
        normals[j] = -dx * inv;
        normals[j + 1] = inv;
        normals[j + 2] = -dz * inv;
        let r = (mat ? palettes[mat][0] : this.natural[j]) * shade,
          g = (mat ? palettes[mat][1] : this.natural[j + 1]) * shade,
          b = (mat ? palettes[mat][2] : this.natural[j + 2]) * shade;
        // A narrow color transition softens raster-sized material edges.
        for (const other of [
          x > 0 ? i - 1 : i,
          x < N ? i + 1 : i,
          z > 0 ? i - stride : i,
          z < N ? i + stride : i,
        ]) {
          const m = terrain.mat[other];
          if (m === mat) continue;
          const k = other * 3;
          r = r * 0.93 + (m ? palettes[m][0] : this.natural[k]) * 0.07;
          g = g * 0.93 + (m ? palettes[m][1] : this.natural[k + 1]) * 0.07;
          b = b * 0.93 + (m ? palettes[m][2] : this.natural[k + 2]) * 0.07;
        }
        colors[j] = r;
        colors[j + 1] = g;
        colors[j + 2] = b;
      }
  }
}
