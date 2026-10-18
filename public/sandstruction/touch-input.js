const limit = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// One owner per control. Keyboard, joystick and tool fingers never release
// each other's input, even when a browser cancels just one pointer.
export class TouchInput {
  constructor() {
    this.reset();
  }
  reset() {
    this.stickId = null;
    this.throttle = this.steer = 0;
    this.workPointers = new Set();
    this.brakePointers = new Set();
    this.locked = false;
  }
  stickStart(id) {
    if (this.stickId !== null) return false;
    this.stickId = id;
    return true;
  }
  stickMove(id, x, y, radius) {
    if (id !== this.stickId || !(radius > 0)) return null;
    const length = Math.hypot(x, y),
      scale = length > radius ? radius / length : 1;
    const nx = (x * scale) / radius,
      ny = (y * scale) / radius;
    const axis = (v) =>
      Math.abs(v) < 0.13 ? 0 : (Math.sign(v) * (Math.abs(v) - 0.13)) / 0.87;
    this.throttle = axis(-ny);
    this.steer = axis(-nx);
    return { x: nx * radius, y: ny * radius };
  }
  release(id) {
    if (this.stickId === id) {
      this.stickId = null;
      this.throttle = this.steer = 0;
    }
    this.workPointers.delete(id);
    this.brakePointers.delete(id);
  }
  get work() {
    return this.locked || this.workPointers.size > 0;
  }
  get brake() {
    return this.brakePointers.size > 0;
  }
}

export class CameraGestures {
  constructor() {
    this.points = new Map();
  }
  start(id, x, y) {
    this.points.set(id, { x, y });
  }
  end(id) {
    this.points.delete(id);
  }
  reset() {
    this.points.clear();
  }
  move(id, x, y) {
    if (!this.points.has(id)) return null;
    const before = [...this.points.values()];
    this.points.set(id, { x, y });
    const after = [...this.points.values()];
    if (after.length === 1)
      return {
        yaw: (x - before[0].x) * -0.007,
        pitch: (y - before[0].y) * 0.005,
        zoom: 1,
      };
    const distance = (p) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    const a = distance(before),
      b = distance(after);
    return {
      yaw: 0,
      pitch: 0,
      zoom: a > 4 && b > 4 ? limit(a / b, 0.7, 1.4) : 1,
    };
  }
}

export function renderProfile({
  width,
  height,
  dpr = 1,
  touch = false,
  memory = 8,
  cores = 8,
}) {
  const area = Math.max(1, width * height),
    budget = touch ? 1200000 : 2800000;
  return {
    pixelRatio: Math.max(
      0.75,
      Math.min(dpr, touch ? 1.5 : 1.75, Math.sqrt(budget / area)),
    ),
    segments: touch ? (memory <= 4 || cores <= 4 ? 256 : 512) : 768,
    shadowSize: touch ? 1024 : 2048,
  };
}
