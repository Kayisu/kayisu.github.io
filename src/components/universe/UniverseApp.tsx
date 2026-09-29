import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { orbitForStatus } from '../../lib/projects';
import type { ProjectStatus } from '../../i18n/types';
import type { ChatScript } from '../../data/chat';
import ChatBeacon from '../chat/ChatBeacon';
import ChatPanel from '../chat/ChatPanel';
import './universe.css';

type Orbit = 'inner' | 'middle' | 'outer' | 'comet';

export interface UniverseProject {
  id: string;
  name: string;
  status: ProjectStatus;
  statusLabel: string;
  accent: string;
  pageBg: string;
  href: string;
  system: string;
  parent?: string;
}

/** One star system; its star sits at `position` in galaxy space. */
export interface UniverseSystem {
  id: string;
  starColor: string;
  position: readonly [number, number, number];
  label: string;
  sublabel: string;
  href: string;
}

interface ContactLink { href: string; label: string; external?: boolean }

interface Props {
  projects: UniverseProject[];
  systems: UniverseSystem[];
  owner: string;
  locale: 'tr' | 'en';
  homeHref: string;
  aboutHref: string;
  aboutLabel: string;
  languageHref: string;
  languageLabel: string;
  listLabel: string;
  orbitLabels: Record<Orbit, string>;
  contacts: ContactLink[];
  chat: ChatScript;
}

const SHELL_BG = '#0b0b0d';
const SCAFFOLD_COLOR = '#cdbf98';
const RADII = { inner: 5, middle: 9.5, outer: 15 } as const;
const ORBIT_ORDER: Record<Orbit, number> = { inner: 0, middle: 1, outer: 2, comet: 3 };

function seeded(seed: number) {
  let value = seed % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

function hash(text: string) {
  let value = 0;
  for (const character of text) value = (value * 31 + character.charCodeAt(0)) | 0;
  return value >>> 0;
}

function toyGeometry(radius: number, detail: number, jitter: number, seed: number) {
  const source = new THREE.IcosahedronGeometry(radius, detail);
  const positions = source.attributes.position;
  const vertices: number[] = [];
  const indices: number[] = [];
  const vertexByPoint = new Map<string, number>();

  for (let i = 0; i < positions.count; i++) {
    const point = [positions.getX(i), positions.getY(i), positions.getZ(i)];
    const key = point.map((part) => part.toFixed(5)).join(',');
    let index = vertexByPoint.get(key);
    if (index === undefined) {
      index = vertices.length / 3;
      vertexByPoint.set(key, index);
      vertices.push(...point);
    }
    indices.push(index);
  }

  const random = seeded(seed);
  for (let i = 0; i < vertices.length; i += 3) {
    const scale = 1 + (random() - 0.5) * 2 * jitter;
    vertices[i] *= scale;
    vertices[i + 1] *= scale;
    vertices[i + 2] *= scale;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  source.dispose();
  return geometry;
}

/** Memoised toy geometry that is disposed when its inputs change or the body unmounts. */
function useToyGeometry(radius: number, detail: number, jitter: number, seed: number) {
  const geometry = useMemo(() => toyGeometry(radius, detail, jitter, seed), [radius, detail, jitter, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Intro pop (easeOutBack) until the body has appeared, then an eased hover scale and emissive lift. */
function stepScale(mesh: THREE.Mesh, time: number, delay: number, introSkipped: boolean, hovered: boolean) {
  const progress = introSkipped ? 1 : Math.max(0, Math.min(1, (time - delay) / 0.55));
  if (progress < 1) {
    const c1 = 1.70158;
    mesh.scale.setScalar(Math.max(0.001, 1 + (c1 + 1) * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2)));
    return;
  }
  const target = hovered ? 1.12 : 1;
  mesh.scale.setScalar(mesh.scale.x + (target - mesh.scale.x) * 0.15);
  const material = mesh.material as THREE.MeshPhysicalMaterial;
  material.emissiveIntensity += ((hovered ? 0.08 : 0) - material.emissiveIntensity) * 0.15;
}

/** White disc with a radial alpha falloff; the sprite material tints it. */
function createHaloTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const falloff = Math.max(0, 1 - Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2));
      image.data.set([255, 255, 255, Math.round(falloff ** 1.5 * 255)], (y * size + x) * 4);
    }
    context.putImageData(image, 0, 0);
  }
  return new THREE.CanvasTexture(canvas);
}

function toyMaterial(color: string, opacity = 1) {
  return (
    <meshPhysicalMaterial
      color={color}
      emissive={color}
      emissiveIntensity={0}
      roughness={0.92}
      metalness={0}
      clearcoat={0}
      flatShading={false}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

/** Name always shows; the status line appears only while the body is hovered, keeping the sky nearly textless. */
function Label({ name, status, active }: { name: string; status: string; active: boolean }) {
  return (
    <Html center zIndexRange={[4, 0]} position={[0, -1.6, 0]} style={{ pointerEvents: 'none' }}>
      <div className="universe-label">
        <span>{name}</span>
        <small className={active ? 'is-visible' : undefined}>{status}</small>
      </div>
    </Html>
  );
}

/** Solid rings for the inner and middle orbits; the parked/archived outer orbit is dashed. */
function OrbitRings() {
  return <>
    {Object.entries(RADII).map(([orbit, radius]) => {
      const points = Array.from({ length: 129 }, (_, index) => {
        const angle = (index / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      });
      const outer = orbit === 'outer';
      return <Line key={radius} points={points} color="#6d6a64" lineWidth={1} transparent opacity={outer ? 0.22 : 0.28}
        dashed={outer} dashSize={0.6} gapSize={0.4} />;
    })}
  </>;
}

/** Two alternating star layers whose opacities breathe in opposite phase (0.55 to 0.85, 4 s period). */
function Stars({ lowDetail, reducedMotion }: { lowDetail: boolean; reducedMotion: boolean }) {
  const layers = useMemo(() => {
    const random = seeded(7);
    const count = lowDetail ? 53 : 160;
    const positions: [number[], number[]] = [[], []];
    for (let i = 0; i < count; i++) {
      const radius = 60 + random() * 60;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions[i % 2].push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
    }
    return positions.map((layer) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(layer, 3)));
  }, [lowDetail]);
  useEffect(() => () => layers.forEach((layer) => layer.dispose()), [layers]);
  const materials = useRef<(THREE.PointsMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    const wave = reducedMotion ? 0 : 0.15 * Math.sin((clock.elapsedTime / 4) * Math.PI * 2);
    materials.current.forEach((material, index) => { if (material) material.opacity = 0.7 + (index === 0 ? wave : -wave); });
  });
  return <>{layers.map((layer, index) => <points key={index} geometry={layer}>
    <pointsMaterial ref={(material) => { materials.current[index] = material; }} color="#d9d6cf" size={0.315} sizeAttenuation transparent opacity={0.7} />
  </points>)}</>;
}

function Scaffold({ size }: { size: number }) {
  const poles = Array.from({ length: 4 }, (_, index) => {
    const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
    return [Math.cos(angle) * size * 1.12, 0, Math.sin(angle) * size * 1.12] as const;
  });
  return <group>
    {poles.map((position, index) => <mesh key={index} position={position}>
      <capsuleGeometry args={[0.035, size * 2.1, 3, 6]} />
      {toyMaterial(SCAFFOLD_COLOR)}
    </mesh>)}
    <mesh position={[0, -0.45 * size, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[size * 1.12, 0.03, 5, 24]} />
      {toyMaterial(SCAFFOLD_COLOR)}
    </mesh>
  </group>;
}

interface SceneProps {
  projects: UniverseProject[];
  lowDetail: boolean;
  reducedMotion: boolean;
  shortIntro: boolean;
  introSkipped: boolean;
  systems: UniverseSystem[];
  onSelect: (id: string, href: string, pageBg: string, point: { x: number; y: number }) => void;
}

function Planet({ project, projects, projectIndices, index, slot, lowDetail, reducedMotion, shortIntro, introSkipped, onSelect }: {
  project: UniverseProject;
  projects: UniverseProject[];
  projectIndices: Map<string, number>;
  /** Evenly spaced start angle within the orbit, so planets sharing an orbit never overlap. */
  slot: number;
  index: number;
  lowDetail: boolean;
  reducedMotion: boolean;
  shortIntro: boolean;
  introSkipped: boolean;
  onSelect: SceneProps['onSelect'];
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera, size } = useThree();
  const orbit = orbitForStatus(project.status);
  const radius = RADII[orbit as keyof typeof RADII];
  const planetSize = orbit === 'inner' ? 0.85 : orbit === 'middle' ? 1 : 0.7;
  const geometry = useToyGeometry(planetSize, lowDetail ? 1 : 2, 0.04, hash(project.id));
  const phase = slot * Math.PI * 2 + (hash(project.id) / 0xffffffff) * 0.4;
  const delay = shortIntro ? 0.3 + index * 0.06 : 0.35 + index * 0.22;

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const angle = phase + (reducedMotion ? 0 : time * 0.05 / Math.sqrt(radius));
    group.current?.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    if (!body.current) return;
    body.current.rotation.y = reducedMotion ? 0 : time * 0.15;
    stepScale(body.current, time, delay, introSkipped || reducedMotion, hovered);
  });

  const choose = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!group.current) return;
    const world = group.current.getWorldPosition(new THREE.Vector3()).project(camera);
    onSelect(project.id, project.href, project.pageBg, {
      x: ((world.x + 1) / 2) * size.width,
      y: ((1 - world.y) / 2) * size.height,
    });
  };

  const moons = projects.filter((candidate) => candidate.parent === project.id);
  return <group ref={group} userData={{ projectId: project.id }}>
    <mesh
      ref={body}
      geometry={geometry}
      onClick={choose}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
    >
      {toyMaterial(project.accent)}
    </mesh>
    {orbit === 'middle' && <Scaffold size={planetSize} />}
    {moons.map((moon) => <Moon key={moon.id} project={moon} index={projectIndices.get(moon.id) ?? 0} reducedMotion={reducedMotion} shortIntro={shortIntro} introSkipped={introSkipped} onSelect={onSelect} />)}
    <Label name={project.name} status={project.statusLabel} active={hovered} />
  </group>;
}

function Moon({ project, index, reducedMotion, shortIntro, introSkipped, onSelect }: {
  project: UniverseProject;
  index: number;
  reducedMotion: boolean;
  shortIntro: boolean;
  introSkipped: boolean;
  onSelect: SceneProps['onSelect'];
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera, size } = useThree();
  const geometry = useToyGeometry(0.32, 1, 0.04, hash(project.id));
  const delay = shortIntro ? 0.3 + index * 0.06 : 0.35 + index * 0.22;
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const angle = reducedMotion ? 0 : time * 0.6;
    if (!ref.current) return;
    ref.current.position.set(Math.cos(angle) * 2.1, 0.3, Math.sin(angle) * 2.1);
    ref.current.rotation.y = reducedMotion ? 0 : time * 0.15;
    stepScale(ref.current, time, delay, introSkipped || reducedMotion, hovered);
  });
  return <mesh ref={ref} geometry={geometry}
    userData={{ projectId: project.id }}
    onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
    onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
    onClick={(event) => {
      event.stopPropagation();
      if (!ref.current) return;
      const world = ref.current.getWorldPosition(new THREE.Vector3()).project(camera);
      onSelect(project.id, project.href, project.pageBg, { x: ((world.x + 1) / 2) * size.width, y: ((1 - world.y) / 2) * size.height });
    }}>
    {toyMaterial(project.accent)}
    <Label name={project.name} status={project.statusLabel} active={hovered} />
  </mesh>;
}

function Comet({ project, index, reducedMotion, shortIntro, introSkipped, onSelect }: {
  project: UniverseProject;
  index: number;
  reducedMotion: boolean;
  shortIntro: boolean;
  introSkipped: boolean;
  onSelect: SceneProps['onSelect'];
}) {
  const group = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { camera, size } = useThree();
  const geometry = useToyGeometry(0.4, 1, 0.08, hash(project.id));
  const offset = (hash(project.id) / 0xffffffff) * Math.PI * 2;
  const delay = shortIntro ? 0.3 + index * 0.06 : 0.35 + index * 0.22;
  const path = (time: number) => {
    const angle = time * 0.12 + offset;
    return new THREE.Vector3(Math.cos(angle) * 22 + 6, Math.sin(angle * 0.7) * 2.5, Math.sin(angle) * 12);
  };

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const position = path(reducedMotion ? 0 : time);
    group.current?.position.copy(position);
    if (tail.current) tail.current.children.forEach((mesh, tailIndex) => {
      mesh.position.copy(path(reducedMotion ? 0 : time - 0.35 * (tailIndex + 1))).sub(position);
    });
    if (body.current) stepScale(body.current, time, delay, introSkipped || reducedMotion, hovered);
  });

  const choose = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!group.current) return;
    const world = group.current.getWorldPosition(new THREE.Vector3()).project(camera);
    onSelect(project.id, project.href, project.pageBg, { x: ((world.x + 1) / 2) * size.width, y: ((1 - world.y) / 2) * size.height });
  };

  return <group ref={group} userData={{ projectId: project.id }}>
    <mesh ref={body} geometry={geometry} onClick={choose}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}>
      {toyMaterial(project.accent)}
    </mesh>
    <group ref={tail}>
      {[0.28, 0.22, 0.17, 0.12, 0.08].map((radius, tailIndex) => <mesh key={radius}>
        <sphereGeometry args={[radius, 8, 6]} />
        {toyMaterial('#d8cfc4', 0.55 - 0.09 * tailIndex)}
      </mesh>)}
    </group>
    <Label name={project.name} status={project.statusLabel} active={hovered} />
  </group>;
}

function Star({ system, halo, lowDetail, onSelect }: {
  system: UniverseSystem;
  halo: THREE.Texture;
  lowDetail: boolean;
  onSelect: SceneProps['onSelect'];
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { camera, size } = useThree();
  const geometry = useToyGeometry(1.7, lowDetail ? 2 : 3, 0.024, hash(system.id));
  return <group ref={group} userData={{ projectId: `star:${system.id}` }}>
    <mesh geometry={geometry} onClick={(event) => {
      event.stopPropagation();
      const world = (group.current?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3()).project(camera);
      onSelect(`star:${system.id}`, system.href, SHELL_BG, { x: ((world.x + 1) / 2) * size.width, y: ((1 - world.y) / 2) * size.height });
    }} onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}>
      <meshPhysicalMaterial color={system.starColor} emissive={system.starColor} emissiveIntensity={0.55} roughness={0.9} metalness={0} clearcoat={0} />
    </mesh>
    <sprite scale={[7.5, 7.5, 1]}>
      <spriteMaterial map={halo} color="#f1c27d" transparent opacity={0.28} blending={THREE.NormalBlending} depthWrite={false} />
    </sprite>
    <pointLight intensity={120} distance={60} decay={1.6} color="#fff1dc" />
    <Label name={system.label} status={system.sublabel} active={hovered} />
  </group>;
}

function DiveRig({ targetId }: { targetId?: string }) {
  const { camera, scene } = useThree();
  useFrame(() => {
    if (!targetId) return;
    const found: { current: THREE.Object3D | null } = { current: null };
    scene.traverse((object) => {
      if (!found.current && object.userData.projectId === targetId) found.current = object;
    });
    const target = found.current;
    if (!target) return;
    const point = target.getWorldPosition(new THREE.Vector3());
    camera.position.lerp(point.clone().add(new THREE.Vector3(0, 0.6, 2.2)), 0.08);
    camera.lookAt(point);
  });
  return null;
}

type BodyProps = Pick<SceneProps, 'lowDetail' | 'reducedMotion' | 'shortIntro' | 'introSkipped' | 'onSelect'>;

/** One star with its orbits, planets, moons and comets, drawn around the system's position. */
function StarSystemView({ system, projects, halo, ...body }: BodyProps & { system: UniverseSystem; projects: UniverseProject[]; halo: THREE.Texture }) {
  const ordered = useMemo(() => projects.slice().sort((a, b) => ORBIT_ORDER[orbitForStatus(a.status)] - ORBIT_ORDER[orbitForStatus(b.status)]), [projects]);
  const roots = ordered.filter((project) => !project.parent);
  const comets = roots.filter((project) => orbitForStatus(project.status) === 'comet');
  const planets = roots.filter((project) => orbitForStatus(project.status) !== 'comet');
  const indices = new Map(ordered.map((project, index) => [project.id, index]));
  return <group position={[...system.position]}>
    <OrbitRings />
    <Star system={system} halo={halo} lowDetail={body.lowDetail} onSelect={body.onSelect} />
    {planets.map((project) => {
      const peers = planets.filter((peer) => orbitForStatus(peer.status) === orbitForStatus(project.status));
      return <Planet key={project.id} project={project} projects={projects} projectIndices={indices} index={indices.get(project.id) ?? 0} slot={peers.indexOf(project) / peers.length} {...body} />;
    })}
    {comets.map((project) => <Comet key={project.id} project={project} index={indices.get(project.id) ?? 0} {...body} />)}
  </group>;
}

function UniverseScene({ projects, systems, targetId, onFirstFrame, ...body }: SceneProps & { targetId?: string; onFirstFrame: () => void }) {
  const halo = useMemo(createHaloTexture, []);
  useEffect(() => () => halo.dispose(), [halo]);
  const firstFrame = useRef(true);
  useFrame(() => {
    if (firstFrame.current) onFirstFrame();
    firstFrame.current = false;
  });
  return <>
    <color attach="background" args={[SHELL_BG]} />
    <hemisphereLight args={['#f4efe6', '#1a1a22', 1.1]} />
    <directionalLight position={[0, 18, 30]} intensity={0.9} />
    {/* Rim light from behind: bodies catch a cool edge like toy plastic. */}
    <directionalLight position={[0, 4, -20]} color="#cfd6e0" intensity={0.5} />
    <Stars lowDetail={body.lowDetail} reducedMotion={body.reducedMotion} />
    {systems.map((system) => <StarSystemView key={system.id} system={system} halo={halo} projects={projects.filter((project) => project.system === system.id)} {...body} />)}
    <OrbitControls makeDefault enabled={!targetId} enablePan={false} minDistance={8} maxDistance={48} />
    <DiveRig targetId={targetId} />
  </>;
}

function ProjectList({ projects, aboutHref, aboutLabel, listLabel, orbitLabels, visible = false }: {
  projects: UniverseProject[];
  aboutHref: string;
  aboutLabel: string;
  listLabel: string;
  orbitLabels: Record<Orbit, string>;
  visible?: boolean;
}) {
  const groups = (['inner', 'middle', 'outer', 'comet'] as const).map((orbit) => ({
    orbit,
    projects: projects.filter((project) => orbitForStatus(project.status) === orbit),
  })).filter((group) => group.projects.length > 0);
  return <nav className={visible ? 'universe-project-list universe-project-list--visible' : 'universe-project-list'} aria-label={listLabel}>
    <h1>{listLabel}</h1>
    <ul className="universe-project-list__about"><li><a href={aboutHref}>{aboutLabel}</a></li></ul>
    {groups.map(({ orbit, projects: entries }) => <section key={orbit} aria-labelledby={`orbit-${orbit}`}>
      <h2 id={`orbit-${orbit}`}>{orbitLabels[orbit]}</h2>
      <ul>{entries.map((project) => <li key={project.id}>
        <a href={project.href}>{project.name}<span>{project.statusLabel}</span></a>
      </li>)}</ul>
    </section>)}
  </nav>;
}

interface VisitSettings { reduced: boolean; short: boolean }
function readVisitSettings(): VisitSettings {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let short = false;
  try {
    short = window.localStorage.getItem('universe-visited') === '1';
    window.localStorage.setItem('universe-visited', '1');
  } catch { /* Storage can be disabled; the first-visit intro remains available. */ }
  return { reduced, short };
}

function initialLowDetail() {
  return window.innerWidth < 700 || window.matchMedia('(pointer: coarse)').matches;
}

interface Selection {
  id: string;
  href: string;
  pageBg: string;
  point: { x: number; y: number };
}

interface BoundaryProps { fallback: ReactNode; children: ReactNode; onFail: () => void }
class CanvasBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function UniverseApp(props: Props) {
  const { projects, systems, owner, locale, homeHref, aboutHref, aboutLabel, languageHref, languageLabel, listLabel, orbitLabels, contacts, chat } = props;
  const [visit] = useState(readVisitSettings);
  const [introSkipped, setIntroSkipped] = useState(visit.reduced);
  const [reducedMotion, setReducedMotion] = useState(visit.reduced);
  const [lowDetail, setLowDetail] = useState(initialLowDetail);
  const [selection, setSelection] = useState<Selection>();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHint, setChatHint] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const chatTrigger = useRef<HTMLButtonElement>(null);
  const openChat = () => { setIntroSkipped(true); setChatOpen(true); };
  // Remounting the canvas resets the camera after a dive.
  const [sceneKey, setSceneKey] = useState(0);
  useEffect(() => {
    const updateDetail = () => setLowDetail(initialLowDetail());
    const onKeyDown = () => setIntroSkipped(true);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(pointer: coarse)');
    const onPointerChange = () => updateDetail();
    const onMotionChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      if (event.matches) setIntroSkipped(true);
    };
    // Back from a project page may restore this page from the bfcache mid-dive.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setSelection(undefined);
      setOverlayOpen(false);
      setSceneKey((key) => key + 1);
      document.body.style.cursor = '';
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('resize', updateDetail);
    window.addEventListener('keydown', onKeyDown);
    motion.addEventListener('change', onMotionChange);
    pointer.addEventListener('change', onPointerChange);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('resize', updateDetail);
      window.removeEventListener('keydown', onKeyDown);
      motion.removeEventListener('change', onMotionChange);
      pointer.removeEventListener('change', onPointerChange);
    };
  }, []);

  const onSelect = (id: string, href: string, pageBg: string, point: { x: number; y: number }) => {
    if (reducedMotion) {
      window.location.assign(href);
      return;
    }
    setSelection({ id, href, pageBg, point });
  };

  useEffect(() => {
    if (!selection) return;
    const frame = window.requestAnimationFrame(() => setOverlayOpen(true));
    const timer = window.setTimeout(() => window.location.assign(selection.href), 650);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [selection]);

  const fallback = <ProjectList projects={projects} aboutHref={aboutHref} aboutLabel={aboutLabel} listLabel={listLabel} orbitLabels={orbitLabels} visible />;
  return <div className="universe-root" onPointerDown={() => setIntroSkipped(true)}>
    <CanvasBoundary fallback={fallback} onFail={() => setCanvasFailed(true)}>
      <Canvas key={sceneKey} className={canvasReady ? 'universe-canvas is-ready' : 'universe-canvas'} camera={{ position: [0, 14, 26], fov: 45 }} dpr={[1, lowDetail ? 1.5 : 2]}>
        <UniverseScene projects={projects} lowDetail={lowDetail} reducedMotion={reducedMotion} shortIntro={visit.short} introSkipped={introSkipped} systems={systems} onSelect={onSelect} targetId={selection?.id}
          onFirstFrame={() => setCanvasReady(true)} />
        <ChatBeacon bubble={chat.ui.bubble} reducedMotion={reducedMotion} hinted={chatHint} muted={chatOpen} onOpen={openChat} />
      </Canvas>
    </CanvasBoundary>
    <header className="universe-header">
      <a href={homeHref}>{owner}</a>
      <button ref={chatTrigger} type="button" className="chat-trigger" aria-expanded={chatOpen} onClick={() => (chatOpen ? setChatOpen(false) : openChat())}
        onFocus={() => setChatHint(true)} onBlur={() => setChatHint(false)} onMouseEnter={() => setChatHint(true)} onMouseLeave={() => setChatHint(false)}>{chat.ui.trigger}</button>
      <a href={languageHref} lang={locale === 'tr' ? 'en' : 'tr'}>{languageLabel}</a>
    </header>
    <footer className="universe-footer">
      {contacts.map((contact, index) => <span className="universe-footer__item" key={contact.href}>
        {index > 0 && <span aria-hidden="true">·</span>}
        <a href={contact.href} {...(contact.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{contact.label}</a>
      </span>)}
    </footer>
    {chatOpen && <ChatPanel script={chat} triggerRef={chatTrigger} onClose={() => setChatOpen(false)} />}
    {!canvasFailed && <ProjectList projects={projects} aboutHref={aboutHref} aboutLabel={aboutLabel} listLabel={listLabel} orbitLabels={orbitLabels} />}
    {selection && <div className={`universe-takeover${overlayOpen ? ' is-open' : ''}`} aria-hidden="true" style={{
      backgroundColor: selection.pageBg,
      clipPath: `circle(${overlayOpen ? '150%' : '0%'} at ${selection.point.x}px ${selection.point.y}px)`,
    }} />}
  </div>;
}
