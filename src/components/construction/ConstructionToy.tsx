import { Component, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { GRID, STEP, bladePush, createLot, pile, relaxStep, sampleHeight, vertexX, vertexZ, type SandLot } from '../../lib/construction/sandLot';
import './construction.css';

interface Hint { lang: string; text: string }
interface Props { label: string; hints: Hint[]; resetLabels: Hint[] }

const DRIVE_SPEED = 1.6;
const ACCEL = 4;
const START = { x: -1, z: 0.6, heading: Math.PI / 2 };
const POOL = 12;
const SAND = { base: new THREE.Color('#d9c08a'), low: new THREE.Color('#c4a66e'), high: new THREE.Color('#e6d3a3') };
const TRACK_FADE = 6;
const TRACK_DARKEN = 0.12;
const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const TURN_SPEED = 2.2;
const LIMIT = 3.6;
const BLADE_AHEAD = 0.55;
const SETTLED = 1e-4;
const WALL_BOTTOM = -0.05;
const KEYS: Record<string, 'forward' | 'back' | 'left' | 'right'> = {
  w: 'forward', arrowup: 'forward', s: 'back', arrowdown: 'back',
  a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toyMaterial(color: string, roughness = 0.92, transparent = false) {
  return <meshPhysicalMaterial color={color} roughness={roughness} metalness={0} transparent={transparent} depthWrite={!transparent} />;
}

/** Surface grid plus a skirt around the edge so the lot reads as a block of sand. */
function buildTerrain(lot: SandLot) {
  const surface = GRID * GRID;
  const perimeter: number[] = [];
  for (let i = 0; i < GRID - 1; i++) perimeter.push(i);
  for (let j = 0; j < GRID - 1; j++) perimeter.push(j * GRID + GRID - 1);
  for (let i = GRID - 1; i > 0; i--) perimeter.push((GRID - 1) * GRID + i);
  for (let j = GRID - 1; j > 0; j--) perimeter.push(j * GRID);
  const ring = perimeter.length;
  const positions = new Float32Array((surface + ring * 2) * 3);
  const indices: number[] = [];
  for (let k = 0; k < surface; k++) positions.set([vertexX(k), 0, vertexZ(k)], k * 3);
  perimeter.forEach((k, n) => {
    positions.set([vertexX(k), 0, vertexZ(k)], (surface + n) * 3);
    positions.set([vertexX(k), WALL_BOTTOM, vertexZ(k)], (surface + ring + n) * 3);
    const [top, next] = [surface + n, surface + ((n + 1) % ring)];
    indices.push(top, next, top + ring, next, next + ring, top + ring);
  });
  for (let j = 0; j < GRID - 1; j++) {
    for (let i = 0; i < GRID - 1; i++) {
      const k = j * GRID + i;
      indices.push(k, k + GRID, k + 1, k + 1, k + GRID, k + GRID + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const colors = new Float32Array(positions.length);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Wheel-track tint lives beside the heights, so it can never change the sand's volume.
  const tint = new Float32Array(surface);
  const shade = new THREE.Color();
  const terrainState = { tinting: false };
  // Fixed bounds that cover every legal height, so raycasts and culling never go stale.
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-4, WALL_BOTTOM, -4), new THREE.Vector3(4, 1.4, 4));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const update = (heightsChanged = true) => {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const color = geometry.attributes.color as THREE.BufferAttribute;
    for (let k = 0; k < surface; k++) {
      const h = lot.heights[k];
      shade.copy(SAND.base);
      if (h < 0.2) shade.lerp(SAND.low, clamp((0.2 - h) / 0.2, 0, 1));
      else if (h > 0.6) shade.lerp(SAND.high, clamp((h - 0.6) / 0.4, 0, 1));
      shade.multiplyScalar(1 - TRACK_DARKEN * tint[k]);
      color.setXYZ(k, shade.r, shade.g, shade.b);
      if (heightsChanged) position.setY(k, h);
    }
    perimeter.forEach((k, n) => {
      color.setXYZ(surface + n, color.getX(k), color.getY(k), color.getZ(k));
      color.setXYZ(surface + ring + n, color.getX(k), color.getY(k), color.getZ(k));
      if (heightsChanged) position.setY(surface + n, lot.heights[k]);
    });
    color.needsUpdate = true;
    if (heightsChanged) {
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  };
  /** Darkens the cells around a world point; fades in `decay`. */
  const stamp = (x: number, z: number) => {
    const ci = Math.round((x + 4) / STEP);
    const cj = Math.round((z + 4) / STEP);
    for (let j = Math.max(0, cj - 1); j <= Math.min(GRID - 1, cj + 1); j++) {
      for (let i = Math.max(0, ci - 1); i <= Math.min(GRID - 1, ci + 1); i++) {
        if (Math.hypot(vertexX(j * GRID + i) - x, vertexZ(j * GRID + i) - z) < 0.14) tint[j * GRID + i] = 1;
      }
    }
    terrainState.tinting = true;
  };
  /** Returns true when any tint was alive at the start of the step, so colors need one more upload. */
  const decay = (dt: number) => {
    if (!terrainState.tinting) return false;
    let alive = false;
    for (let k = 0; k < surface; k++) {
      if (tint[k] > 0) { tint[k] = Math.max(0, tint[k] - dt / TRACK_FADE); alive ||= tint[k] > 0; }
    }
    terrainState.tinting = alive;
    return true;
  };
  const clear = () => { tint.fill(0); terrainState.tinting = false; };
  update();
  return { geometry, update, stamp, decay, clear, state: terrainState };
}

function Bulldozer({ group }: { group: RefObject<THREE.Group> }) {
  return <group ref={group}>
    {[-0.27, 0.27].map((x) => <RoundedBox key={x} args={[0.22, 0.2, 1]} radius={0.09} smoothness={3} position={[x, 0.1, -0.03]}>
      {toyMaterial('#3a3530')}
    </RoundedBox>)}
    <RoundedBox args={[0.5, 0.26, 0.62]} radius={0.08} smoothness={3} position={[0, 0.3, -0.05]}>{toyMaterial('#e8c547')}</RoundedBox>
    <RoundedBox args={[0.36, 0.3, 0.3]} radius={0.07} smoothness={3} position={[0, 0.55, -0.17]}>{toyMaterial('#e8c547')}</RoundedBox>
    <RoundedBox args={[0.38, 0.12, 0.32]} radius={0.04} smoothness={2} position={[0, 0.59, -0.17]}>{toyMaterial('#2b2a28')}</RoundedBox>
    <mesh position={[0.14, 0.52, 0.14]}><capsuleGeometry args={[0.035, 0.14, 3, 8]} />{toyMaterial('#3a3530')}</mesh>
    {[-0.2, 0.2].map((x) => <mesh key={x} position={[x, 0.2, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
      <capsuleGeometry args={[0.03, 0.2, 3, 8]} />{toyMaterial('#8a8378')}
    </mesh>)}
    <RoundedBox args={[0.9, 0.26, 0.08]} radius={0.035} smoothness={3} position={[0, 0.14, 0.53]}>{toyMaterial('#8a8378')}</RoundedBox>
  </group>;
}

interface Particle { on: boolean; age: number; life: number; r0: number; r1: number; rise: number; alpha: number; y: number }
interface Flag { x: number; z: number; age: number; out: number | null }

function Scene({ stage, resetTick }: { stage: RefObject<HTMLDivElement>; resetTick: number }) {
  const { camera, gl, invalidate } = useThree();
  // Looking slightly past the centre keeps the whole lot in frame, near corner included.
  useEffect(() => { camera.lookAt(0.6, 0, 0.6); invalidate(); }, [camera, invalidate]);
  const lot = useMemo(() => createLot(7), []);
  const terrain = useMemo(() => buildTerrain(lot), [lot]);
  useEffect(() => () => terrain.geometry.dispose(), [terrain]);
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const sand = useRef<THREE.Mesh>(null);
  const dozer = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const flag = useRef<THREE.Group>(null);
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const pool = useRef<Particle[]>(Array.from({ length: POOL }, () => ({ on: false, age: 0, life: 1, r0: 0, r1: 0, rise: 0, alpha: 0, y: 0 })));
  const state = useRef({
    ...START, speed: 0, time: 0, dirty: false, settled: true, invite: true, inviteAge: 0, puffT: 0, dustT: 0,
    keys: new Set<string>(), target: null as { x: number; z: number } | null, flag: null as Flag | null,
  });

  const aim = (point: { x: number; z: number } | null) => {
    const s = state.current;
    s.target = point;
    if (point) s.flag = { ...point, age: 0, out: null };
    else if (s.flag && s.flag.out === null) s.flag.out = 0;
  };
  const spawn = (color: string, x: number, y: number, z: number, r0: number, r1: number, rise: number, life: number, alpha: number) => {
    const slot = pool.current.findIndex((p) => !p.on);
    const mesh = puffs.current[slot];
    if (slot < 0 || !mesh) return;
    Object.assign(pool.current[slot], { on: true, age: 0, life, r0, r1, rise, alpha, y });
    mesh.position.set(x, y, z);
    (mesh.material as THREE.MeshPhysicalMaterial).color.set(color);
    mesh.visible = true;
  };

  useEffect(() => {
    if (!resetTick) return;
    const s = state.current;
    lot.heights.set(createLot(7).heights);
    terrain.clear();
    terrain.update();
    Object.assign(s, START, { speed: 0, settled: true, dirty: false, invite: false, puffT: 0, dustT: 0 });
    s.keys.clear();
    aim(null);
    pool.current.forEach((p, n) => { p.on = false; if (puffs.current[n]) puffs.current[n]!.visible = false; });
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTick]);

  useEffect(() => {
    const wrapper = stage.current;
    const canvas = gl.domElement;
    if (!wrapper) return;
    const s = state.current;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    // A tap drives the dozer to the point, a double tap piles sand there. Drags stay with the page,
    // so the lot never traps scrolling on touch screens.
    let press: { id: number; x: number; y: number; time: number } | null = null;
    let lastTap: { x: number; y: number; time: number } | null = null;
    const hit = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const found = sand.current && raycaster.intersectObject(sand.current)[0];
      return found ? { x: clamp(found.point.x, -LIMIT, LIMIT), z: clamp(found.point.z, -LIMIT, LIMIT) } : null;
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || press) return;
      s.invite = false;
      // Under reduced motion no loop is running, so ask for the frame that hides the static ring.
      invalidate();
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    };
    const onUp = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return;
      const now = performance.now();
      const isTap = Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6 && now - press.time < 400;
      press = null;
      const point = isTap ? hit(event) : null;
      if (!point) return;
      const isDouble = lastTap && now - lastTap.time < 320 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24;
      if (isDouble) {
        pile(lot, point.x, point.z);
        aim(null);
        s.settled = false;
        s.dirty = true;
        lastTap = null;
      } else {
        aim(point);
        lastTap = { x: event.clientX, y: event.clientY, time: now };
      }
      invalidate();
    };
    const onCancel = () => { press = null; };
    const onKey = (event: KeyboardEvent) => {
      const action = KEYS[event.key.toLowerCase()];
      if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (event.type === 'keyup') s.keys.delete(action);
      else { s.keys.add(action); s.invite = false; aim(null); }
      invalidate();
    };
    const onBlur = () => s.keys.clear();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    wrapper.addEventListener('keydown', onKey);
    wrapper.addEventListener('keyup', onKey);
    wrapper.addEventListener('blur', onBlur);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      wrapper.removeEventListener('keydown', onKey);
      wrapper.removeEventListener('keyup', onKey);
      wrapper.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, invalidate, lot, stage]);

  useFrame((_, delta) => {
    const s = state.current;
    // After an idle stretch the demand loop reports a long delta; never jump more than one step.
    const dt = Math.min(delta, 1 / 30);
    s.time += dt;
    let want = 0;
    let turn = 0;
    if (s.keys.size) {
      want = (Number(s.keys.has('forward')) - Number(s.keys.has('back'))) * DRIVE_SPEED;
      turn = Number(s.keys.has('left')) - Number(s.keys.has('right'));
    } else if (s.target) {
      const dx = s.target.x - s.x;
      const dz = s.target.z - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) aim(null);
      else {
        const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - s.heading), Math.cos(Math.atan2(dx, dz) - s.heading));
        turn = clamp(off / (TURN_SPEED * dt), -1, 1);
        // Ease off so the dozer coasts to a stop right at the flag.
        want = Math.abs(off) < 1.2 ? Math.min(DRIVE_SPEED, Math.sqrt(2 * ACCEL * Math.max(dist - 0.1, 0))) : 0;
      }
    }
    s.speed += clamp(want - s.speed, -ACCEL * dt, ACCEL * dt);
    s.heading += turn * TURN_SPEED * dt;
    const forwardX = Math.sin(s.heading);
    const forwardZ = Math.cos(s.heading);
    const x = clamp(s.x + forwardX * s.speed * dt, -LIMIT, LIMIT);
    const z = clamp(s.z + forwardZ * s.speed * dt, -LIMIT, LIMIT);
    const moved = Math.hypot(x - s.x, z - s.z);
    s.x = x;
    s.z = z;
    const moving = Math.abs(s.speed) > 0.05;
    let pushing = false;
    if (moving && moved > 0) {
      for (const side of [-0.27, 0.27]) terrain.stamp(x + Math.cos(s.heading) * side - forwardX * 0.03, z - Math.sin(s.heading) * side - forwardZ * 0.03);
    }
    if (s.speed > 0 && moved > 0) {
      const floor = sampleHeight(lot, x, z) - 0.03;
      const pushed = bladePush(lot, x + forwardX * BLADE_AHEAD, z + forwardZ * BLADE_AHEAD, s.heading, moved, floor);
      if (pushed > 0) {
        s.dirty = true;
        s.settled = false;
      }
      pushing = pushed > 0.002;
    }
    if (!s.settled) {
      const change = relaxStep(lot);
      s.dirty ||= change > 0;
      s.settled = change < SETTLED;
    }
    const tinting = terrain.decay(dt);
    if (s.dirty || tinting) terrain.update(s.dirty);
    s.dirty = false;
    const ground = sampleHeight(lot, s.x, s.z);
    const bob = moving && !reduced ? Math.sin(s.time * 28) * 0.008 : 0;
    dozer.current?.position.set(s.x, ground + bob, s.z);
    dozer.current?.rotation.set(0, s.heading, 0);
    shadow.current?.position.set(s.x, ground + 0.02, s.z);

    // Particles: exhaust while driving, dust while the blade moves sand.
    if (!reduced) {
      s.puffT = moving ? s.puffT + dt : 0;
      s.dustT = pushing ? s.dustT + dt : 0;
      if (s.puffT >= 0.18) {
        s.puffT -= 0.18;
        const [c, sn] = [Math.cos(s.heading), Math.sin(s.heading)];
        spawn('#cfc8bb', s.x + 0.14 * c + 0.14 * sn, ground + 0.66, s.z - 0.14 * sn + 0.14 * c, 0.05, 0.12, 0.4, 0.9, 0.6);
      }
      if (s.dustT >= 0.12) {
        s.dustT -= 0.12;
        const [bx, bz] = [s.x + forwardX * 0.55, s.z + forwardZ * 0.55];
        spawn('#e6d3a3', bx, sampleHeight(lot, bx, bz) + 0.05, bz, 0.04, 0.09, 0.2, 0.5, 0.5);
      }
    }
    pool.current.forEach((p, n) => {
      const mesh = puffs.current[n];
      if (!p.on || !mesh) return;
      p.age += dt;
      const u = p.age / p.life;
      if (u >= 1) { p.on = false; mesh.visible = false; return; }
      mesh.position.y = p.y + p.rise * u;
      mesh.scale.setScalar(p.r0 + (p.r1 - p.r0) * u);
      (mesh.material as THREE.MeshPhysicalMaterial).opacity = p.alpha * (1 - u);
    });

    // Target flag pops in, then fades on arrival or when cancelled.
    const f = s.flag;
    if (flag.current) {
      flag.current.visible = !!f;
      if (f) {
        f.age += dt;
        if (f.out !== null) f.out += dt;
        const fade = f.out === null ? 1 : 1 - f.out / (reduced ? 0.01 : 0.25);
        if (fade <= 0) s.flag = null;
        flag.current.position.set(f.x, sampleHeight(lot, f.x, f.z), f.z);
        flag.current.scale.setScalar(reduced ? 1 : Math.max(easeOutBack(Math.min(f.age / 0.3, 1)), 0.001));
        flag.current.children.forEach((child) => { ((child as THREE.Mesh).material as THREE.Material).opacity = Math.max(fade, 0); });
      }
    }

    // Invite ring: pulses near the dozer's nose until the first touch, at most 8 s.
    if (ring.current) {
      if (s.invite) s.inviteAge += dt;
      if (!reduced && s.inviteAge >= 8) s.invite = false;
      ring.current.visible = s.invite;
      if (s.invite) {
        const phase = reduced ? 0.4 : (s.inviteAge % 1.6) / 1.6;
        const [rx, rz] = [START.x + Math.sin(START.heading) * 1.3, START.z + Math.cos(START.heading) * 1.3];
        ring.current.position.set(rx, sampleHeight(lot, rx, rz) + 0.03, rz);
        ring.current.scale.setScalar(0.35 + 0.25 * phase);
        (ring.current.material as THREE.MeshBasicMaterial).opacity = reduced ? 0.3 : 0.5 * (1 - phase);
      }
    }
    const inviting = s.invite && !reduced;
    if (s.keys.size || s.target || !s.settled || s.speed !== 0 || terrain.state.tinting || s.flag || inviting || pool.current.some((p) => p.on)) invalidate();
  });

  return <>
    <hemisphereLight args={['#f4efe6', '#1a1a22', 1]} />
    <directionalLight position={[4, 8, 5]} intensity={1.2} />
    <mesh ref={sand} geometry={terrain.geometry}><meshPhysicalMaterial color="#ffffff" vertexColors roughness={0.95} metalness={0} /></mesh>
    <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.55, 24]} /><meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
    </mesh>
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1, 48]} /><meshBasicMaterial color="#3a3530" transparent opacity={0} depthWrite={false} />
    </mesh>
    <group ref={flag} visible={false}>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />{toyMaterial('#3a3530', 0.92, true)}</mesh>
      <mesh position={[0.08, 0.26, 0]}><boxGeometry args={[0.14, 0.08, 0.012]} />{toyMaterial('#e8c547', 0.92, true)}</mesh>
    </group>
    {Array.from({ length: POOL }, (_, n) => <mesh key={n} ref={(mesh) => { puffs.current[n] = mesh; }} visible={false}>
      <sphereGeometry args={[1, 10, 8]} />{toyMaterial('#cfc8bb', 0.92, true)}
    </mesh>)}
    <Bulldozer group={dozer} />
  </>;
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function ConstructionToy({ label, hints, resetLabels }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const hintId = useId();
  // WebGL only exists in the browser; the server renders the empty stage and the hint.
  const [mounted, setMounted] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  useEffect(() => setMounted(true), []);
  return <div className="construction-toy">
    <div ref={stage} className="construction-toy__stage" tabIndex={0} role="application" aria-label={label} aria-describedby={hintId}>
      {mounted && <CanvasBoundary>
        <Canvas frameloop="demand" camera={{ position: [6.5, 6, 6.5], fov: 35 }} dpr={[1, 2]}>
          <Scene stage={stage} resetTick={resetTick} />
        </Canvas>
      </CanvasBoundary>}
    </div>
    <div className="construction-toy__foot">
      <p id={hintId} className="construction-toy__hint">
        {hints.map((hint) => <span key={hint.lang} lang={hint.lang}>{hint.text}</span>)}
      </p>
      {mounted && <button type="button" className="construction-toy__reset" onClick={() => setResetTick((tick) => tick + 1)}>
        {resetLabels.map((reset, index) => <span key={reset.lang} lang={reset.lang}>{index > 0 && <span aria-hidden="true"> / </span>}{reset.text}</span>)}
      </button>}
    </div>
  </div>;
}
