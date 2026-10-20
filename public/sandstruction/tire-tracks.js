// Continuous world-space capsules, independent of the simulation's 37.5 cm cells.
// RGBA bytes work on both WebGL 1 and 2; only the red channel is sampled.
export class TireTracks {
  constructor(resolution = 1536, size = 96) {
    this.resolution = resolution;
    this.size = size;
    this.data = new Uint8Array(resolution * resolution * 4);
    this.history = [];
    this.dirty = true;
  }
  clear() {
    this.data.fill(0);
    this.history = [];
    this.dirty = true;
  }
  stroke(
    ax,
    az,
    bx,
    bz,
    width = 0.32,
    strength = 0.8,
    phase = 0,
    record = true,
  ) {
    const values = [ax, az, bx, bz, width, strength, phase];
    if (
      !values.every(Number.isFinite) ||
      width <= 0 ||
      width > 12 ||
      Math.hypot(bx - ax, bz - az) > 8
    )
      return false;
    if (
      Math.max(Math.abs(ax), Math.abs(az), Math.abs(bx), Math.abs(bz)) >
      this.size / 2 + 8
    )
      return false;
    const n = this.resolution,
      scale = n / this.size,
      pixel = 1 / scale,
      radius = width / 2;
    const minX = Math.max(
      0,
      Math.floor((Math.min(ax, bx) - radius + this.size / 2) * scale - 1),
    );
    const maxX = Math.min(
      n - 1,
      Math.ceil((Math.max(ax, bx) + radius + this.size / 2) * scale + 1),
    );
    const minZ = Math.max(
      0,
      Math.floor((Math.min(az, bz) - radius + this.size / 2) * scale - 1),
    );
    const maxZ = Math.min(
      n - 1,
      Math.ceil((Math.max(az, bz) + radius + this.size / 2) * scale + 1),
    );
    const dx = bx - ax,
      dz = bz - az,
      len = Math.hypot(dx, dz),
      len2 = len * len;
    let painted = false;
    for (let iz = minZ; iz <= maxZ; iz++)
      for (let ix = minX; ix <= maxX; ix++) {
        const x = (ix + 0.5) * pixel - this.size / 2 - ax,
          z = (iz + 0.5) * pixel - this.size / 2 - az;
        const t = len2 ? Math.max(0, Math.min(1, (x * dx + z * dz) / len2)) : 0;
        const distance = Math.hypot(x - t * dx, z - t * dz);
        const edge = Math.max(
          0,
          Math.min(1, (radius + pixel * 0.65 - distance) / (pixel * 1.3)),
        );
        if (!edge) continue;
        const side = len ? (x * dz - z * dx) / len : 0;
        const tread =
          0.72 +
          0.28 *
            Math.cos(
              ((phase + t * len + Math.abs(side) * 0.7) * Math.PI * 2) / 0.22,
            );
        const i = (iz * n + ix) * 4;
        const before = this.data[i];
        this.data[i] =
          strength < 0
            ? Math.round(this.data[i] * (1 - edge))
            : Math.max(
                this.data[i],
                Math.round(255 * edge * Math.min(1, strength) * tread),
              );
        if (this.data[i] !== before) painted = true;
      }
    if (!painted) return false;
    if (record) {
      this.history.push(values);
      if (this.history.length > 4096) {
        const kept = this.history.slice(-3072);
        this.restore(kept);
      }
    }
    this.dirty = true;
    return true;
  }
  erase(x, z, radius) {
    return this.stroke(x, z, x, z, radius * 2, -1, 0);
  }
  serialize() {
    return this.history.map((v) => v.slice());
  }
  restore(history) {
    this.clear();
    if (!Array.isArray(history)) return;
    for (const op of history.slice(-4096))
      if (Array.isArray(op) && op.length === 7 && this.stroke(...op, false))
        this.history.push(op.slice());
  }
}
