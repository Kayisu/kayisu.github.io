import { Component, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { GRID, bladePush, createLot, pile, relaxStep, sampleHeight, vertexX, vertexZ, type SandLot } from '../../lib/construction/sandLot';
import './construction.css';

interface Hint { lang: string; text: string }
interface Props { label: string; hints: Hint[] }

const DRIVE_SPEED = 1.6;
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

function toyMaterial(color: string, roughness = 0.92) {
  return <meshPhysicalMaterial color={color} roughness={roughness} metalness={0} />;
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
  // Fixed bounds that cover every legal height, so raycasts and culling never go stale.
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-4, WALL_BOTTOM, -4), new THREE.Vector3(4, 1.4, 4));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const update = () => {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < surface; k++) position.setY(k, lot.heights[k]);
    perimeter.forEach((k, n) => position.setY(surface + n, lot.heights[k]));
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  update();
  return { geometry, update };
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

function Scene({ stage }: { stage: RefObject<HTMLDivElement> }) {
  const { camera, gl, invalidate } = useThree();
  // Looking slightly past the centre keeps the whole lot in frame, near corner included.
  useEffect(() => { camera.lookAt(0.6, 0, 0.6); invalidate(); }, [camera, invalidate]);
  const lot = useMemo(() => createLot(7), []);
  const terrain = useMemo(() => buildTerrain(lot), [lot]);
  useEffect(() => () => terrain.geometry.dispose(), [terrain]);
  const sand = useRef<THREE.Mesh>(null);
  const dozer = useRef<THREE.Group>(null);
  const state = useRef({
    x: -1, z: 0.6, heading: Math.PI / 2, dirty: false, settled: true,
    keys: new Set<string>(), target: null as { x: number; z: number } | null,
  });

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
        s.target = null;
        s.settled = false;
        s.dirty = true;
        lastTap = null;
      } else {
        s.target = point;
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
      else { s.keys.add(action); s.target = null; }
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
  }, [camera, gl, invalidate, lot, stage]);

  useFrame((_, delta) => {
    const s = state.current;
    // After an idle stretch the demand loop reports a long delta; never jump more than one step.
    const dt = Math.min(delta, 1 / 30);
    let drive = 0;
    let turn = 0;
    if (s.keys.size) {
      drive = Number(s.keys.has('forward')) - Number(s.keys.has('back'));
      turn = Number(s.keys.has('left')) - Number(s.keys.has('right'));
    } else if (s.target) {
      const dx = s.target.x - s.x;
      const dz = s.target.z - s.z;
      if (Math.hypot(dx, dz) < 0.15) s.target = null;
      else {
        const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - s.heading), Math.cos(Math.atan2(dx, dz) - s.heading));
        turn = clamp(off / (TURN_SPEED * dt), -1, 1);
        drive = Math.abs(off) < 1.2 ? 1 : 0;
      }
    }
    s.heading += turn * TURN_SPEED * dt;
    const forwardX = Math.sin(s.heading);
    const forwardZ = Math.cos(s.heading);
    const x = clamp(s.x + forwardX * drive * DRIVE_SPEED * dt, -LIMIT, LIMIT);
    const z = clamp(s.z + forwardZ * drive * DRIVE_SPEED * dt, -LIMIT, LIMIT);
    const moved = Math.hypot(x - s.x, z - s.z);
    s.x = x;
    s.z = z;
    if (drive > 0 && moved > 0) {
      const floor = sampleHeight(lot, x, z) - 0.03;
      if (bladePush(lot, x + forwardX * BLADE_AHEAD, z + forwardZ * BLADE_AHEAD, s.heading, moved, floor) > 0) {
        s.dirty = true;
        s.settled = false;
      }
    }
    if (!s.settled) {
      const change = relaxStep(lot);
      s.dirty ||= change > 0;
      s.settled = change < SETTLED;
    }
    if (s.dirty) terrain.update();
    s.dirty = false;
    dozer.current?.position.set(s.x, sampleHeight(lot, s.x, s.z), s.z);
    dozer.current?.rotation.set(0, s.heading, 0);
    if (s.keys.size || s.target || !s.settled) invalidate();
  });

  return <>
    <hemisphereLight args={['#f4efe6', '#1a1a22', 1]} />
    <directionalLight position={[4, 8, 5]} intensity={1.2} />
    <mesh ref={sand} geometry={terrain.geometry}>{toyMaterial('#d9c08a', 0.95)}</mesh>
    <Bulldozer group={dozer} />
  </>;
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function ConstructionToy({ label, hints }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const hintId = useId();
  // WebGL only exists in the browser; the server renders the empty stage and the hint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div className="construction-toy">
    <div ref={stage} className="construction-toy__stage" tabIndex={0} role="application" aria-label={label} aria-describedby={hintId}>
      {mounted && <CanvasBoundary>
        <Canvas frameloop="demand" camera={{ position: [6.5, 6, 6.5], fov: 35 }} dpr={[1, 2]}>
          <Scene stage={stage} />
        </Canvas>
      </CanvasBoundary>}
    </div>
    <p id={hintId} className="construction-toy__hint">
      {hints.map((hint) => <span key={hint.lang} lang={hint.lang}>{hint.text}</span>)}
    </p>
  </div>;
}
