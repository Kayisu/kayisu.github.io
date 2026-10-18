import test from "node:test";
import assert from "node:assert/strict";
import {
  TouchInput,
  CameraGestures,
  renderProfile,
} from "../../public/sandstruction/touch-input.js";
import { initMobileUI } from "../../public/sandstruction/mobile-ui.js";
import { stepVehicle } from "../../public/sandstruction/physics.js";
import { Terrain } from "../../public/sandstruction/terrain.js";

test("a joystick has a dead zone, bounded diagonal travel and exactly one owner", () => {
  const input = new TouchInput();
  assert.equal(input.stickStart(3), true);
  assert.equal(input.stickStart(4), false);
  input.stickMove(3, 1, -1, 40);
  assert.equal(input.throttle, 0);
  const p = input.stickMove(3, 200, -200, 40);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 40) < 1e-9);
  assert.ok(input.throttle > 0.6 && input.throttle < 1);
  assert.ok(input.steer < -0.6 && input.steer > -1);
  input.release(4);
  assert.notEqual(input.throttle, 0);
  input.release(3);
  assert.equal(input.throttle, 0);
  assert.equal(input.steer, 0);
});

test("simultaneous driving, work and braking fingers release independently", () => {
  const input = new TouchInput();
  input.stickStart(1);
  input.stickMove(1, 0, -40, 40);
  input.workPointers.add(2);
  input.workPointers.add(5);
  input.brakePointers.add(3);
  input.release(2);
  assert.equal(input.work, true);
  assert.equal(input.brake, true);
  assert.equal(input.throttle, 1);
  input.release(5);
  assert.equal(input.work, false);
  input.locked = true;
  input.reset();
  assert.equal(input.work, false);
  assert.equal(input.brake, false);
  assert.equal(input.throttle, 0);
});

test("pinch zoom stays separate from orbit and adding/removing fingers never jumps", () => {
  const g = new CameraGestures();
  g.start(1, 10, 10);
  assert.equal(g.move(1, 20, 10).yaw, -0.07);
  g.start(2, 120, 10);
  const pinch = g.move(2, 145, 10);
  assert.equal(pinch.yaw, 0);
  assert.equal(pinch.zoom, 0.8);
  g.end(2);
  const still = g.move(1, 20, 10);
  assert.equal(Math.abs(still.yaw) + Math.abs(still.pitch), 0);
  assert.equal(still.zoom, 1);
  assert.equal(g.move(1, 25, 20).pitch, 0.05);
  g.reset();
  assert.equal(g.move(1, 300, 300), null);
});

test("analog throttle/steering retain gradual control and reversing uses the brake rate", () => {
  const terrain = new Terrain();
  terrain.h.fill(0);
  const vehicle = () => ({
    id: "truck",
    x: 0,
    z: 0,
    speed: 1,
    angle: 0,
    max: 6,
  });
  const slow = vehicle(),
    fast = vehicle();
  stepVehicle(slow, { throttle: 0.25, steer: 0.25 }, terrain, [], 0.05);
  stepVehicle(fast, { throttle: 1, steer: 1 }, terrain, [], 0.05);
  assert.ok(Math.abs(slow.speed - 1.03375) < 1e-9);
  assert.ok(slow.speed < fast.speed);
  assert.ok(slow.steer > 0 && slow.steer < fast.steer);
  const reverse = vehicle();
  stepVehicle(reverse, { throttle: -1 }, terrain, [], 0.05);
  assert.ok(reverse.speed < 0.7);
});

test("phone/tablet profiles bound rendering cost in either orientation without user-agent sniffing", () => {
  for (const [w, h] of [
    [320, 480],
    [360, 640],
    [390, 844],
    [430, 932],
    [540, 720],
    [768, 1024],
    [820, 1180],
    [1024, 1366],
  ])
    for (const [width, height] of [
      [w, h],
      [h, w],
    ]) {
      const p = renderProfile({ width, height, dpr: 3, touch: true });
      assert.ok(width * height * p.pixelRatio ** 2 <= 1200001);
      assert.ok(p.pixelRatio <= 1.5 && p.pixelRatio >= 0.75);
      assert.equal(p.segments, 512);
      assert.equal(p.shadowSize, 1024);
    }
  assert.equal(
    renderProfile({ width: 390, height: 844, touch: true, memory: 4 }).segments,
    256,
  );
  assert.equal(
    renderProfile({ width: 1366, height: 768, touch: false }).segments,
    768,
  );
});

// A small event/DOM harness exercises our real bindings, including capture loss
// and media-query transitions. It does not claim to test browser layout/WebGL.
class Node extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.attrs = {};
    this.children = [];
    this.parent = null;
    const set = new Set();
    this.classList = {
      toggle: (key, value) => (value ? set.add(key) : set.delete(key)),
      contains: (key) => set.has(key),
    };
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  append(node) {
    node.parent = this;
    this.children.push(node);
  }
  before(node) {
    node.parent = this.parent;
  }
  after(node) {
    node.parent = this.parent;
  }
  setPointerCapture(id) {
    this.captured = id;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 120, height: 120 };
  }
}
function fire(node, type, id, x = 60, y = 60) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: id, clientX: x, clientY: y, button: 0 });
  node.dispatchEvent(event);
}
test("bound mobile controls recover from capture loss, panel resets and tablet/desktop switches", () => {
  const prior = {
    document: globalThis.document,
    matchMedia: globalThis.matchMedia,
  };
  const nodes = new Map(),
    get = (id) => {
      if (!nodes.has(id)) nodes.set(id, new Node());
      return nodes.get(id);
    };
  const query = new EventTarget();
  query.matches = true;
  const doc = new EventTarget();
  doc.body = new Node();
  doc.getElementById = get;
  doc.createComment = () => new Node();
  doc.querySelector = get;
  const mobileNodes = [
    get("mobileControls"),
    get("mobileToolbar"),
    get("mobileHud"),
  ];
  doc.querySelectorAll = (selector) =>
    selector === ".mobile-only" ? mobileNodes : [];
  globalThis.document = doc;
  globalThis.matchMedia = (value) => {
    assert.equal(value, "(pointer: coarse)");
    return query;
  };
  let playing = true,
    cleared = 0;
  try {
    const ui = initMobileUI({
      canPlay: () => playing,
      clearInput: () => cleared++,
      openDialog: () => {},
      onLayout: () => {},
    });
    assert.equal(ui.touch, true);
    assert.ok(mobileNodes.every((node) => node.hidden === false));
    fire(get("drivePad"), "pointerdown", 1, 60, 10);
    fire(get("touchWork"), "pointerdown", 2);
    assert.equal(ui.input.throttle, 1);
    assert.equal(ui.input.work, true);
    const thumb = get("driveThumb").style.transform;
    fire(get("touchBrake"), "pointerdown", 3);
    assert.equal(get("driveThumb").style.transform, thumb);
    fire(get("touchWork"), "lostpointercapture", 2);
    assert.equal(ui.input.work, false);
    assert.equal(ui.input.throttle, 1);
    fire(get("drivePad"), "pointercancel", 1);
    assert.equal(ui.input.throttle, 0);
    get("workLock").onclick();
    assert.equal(ui.input.work, true);
    ui.reset();
    assert.equal(ui.input.work, false);
    playing = false;
    fire(get("touchWork"), "pointerdown", 8);
    assert.equal(ui.input.work, false);
    playing = true;
    query.matches = false;
    query.dispatchEvent(new Event("change"));
    assert.equal(doc.body.classList.contains("touch-layout"), false);
    assert.ok(cleared >= 2);
    assert.ok(mobileNodes.every((node) => node.hidden === true));
    fire(get("touchWork"), "pointerdown", 19);
    fire(get("drivePad"), "pointerdown", 20, 60, 10);
    get("workLock").onclick();
    assert.equal(ui.input.work, false);
    assert.equal(ui.input.throttle, 0);
    query.matches = true;
    query.dispatchEvent(new Event("change"));
    assert.ok(mobileNodes.every((node) => node.hidden === false));
    fire(get("touchWork"), "pointerdown", 21);
    assert.equal(ui.input.work, true);
  } finally {
    Object.assign(globalThis, prior);
  }
});
