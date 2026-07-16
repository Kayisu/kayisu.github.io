import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useSandboxStore } from '../../store/sandboxStore';
import { gridToWorld } from '../../lib/sandbox/grid';
import {
  COLORS,
  DECOR_SCALE,
  MAX_DECORATIONS,
  type DecorationType,
} from '../../lib/sandbox/constants';

interface Placement {
  x: number;
  z: number;
  rotation: number;
  scale: number;
}

interface DecorationInstancesProps {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  placements: readonly Placement[];
  baseScale: number;
}

const shellPoints = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.15, 0.05),
  new THREE.Vector2(0.2, 0.15),
  new THREE.Vector2(0.18, 0.25),
  new THREE.Vector2(0.12, 0.3),
  new THREE.Vector2(0, 0.32),
];

function mergeOrThrow(
  geometries: THREE.BufferGeometry[],
  label: string,
): THREE.BufferGeometry {
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((geometry) => geometry.dispose());

  if (!merged) {
    throw new Error(`Could not merge ${label} geometry.`);
  }

  return merged;
}

function createPalmFronds(): THREE.BufferGeometry {
  const fronds = [0, 72, 144, 216, 288].map((degrees) => {
    const frond = new THREE.PlaneGeometry(0.22, 1.4);
    frond.translate(0, 0.7, 0);
    frond.rotateX(-Math.PI / 3);
    frond.translate(0, 2.55, 0);
    frond.rotateY(THREE.MathUtils.degToRad(degrees));
    return frond;
  });

  return mergeOrThrow(fronds, 'palm frond');
}

function DecorationInstances({
  geometry,
  material,
  placements,
  baseScale,
}: DecorationInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useRef(new THREE.Object3D()).current;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const count = Math.min(placements.length, MAX_DECORATIONS);

    for (let i = 0; i < count; i++) {
      const placement = placements[i];
      const scale = baseScale * placement.scale;
      dummy.position.set(placement.x, 0, placement.z);
      dummy.rotation.set(0, placement.rotation, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }, [baseScale, dummy, placements]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_DECORATIONS]}
      castShadow
      receiveShadow
      frustumCulled={false}
      dispose={null}
    />
  );
}

export default function Decorations() {
  const decorations = useSandboxStore((state) => state.decorations);

  const geometries = useMemo(() => {
    const palmTrunk = new THREE.ConeGeometry(0.12, 2.8, 6, 1, true);
    palmTrunk.translate(0, 1.4, 0);

    const rock = new THREE.IcosahedronGeometry(0.45, 0);

    const shell = new THREE.LatheGeometry(shellPoints, 12);
    shell.translate(0, 0.08, 0);
    shell.rotateX(-Math.PI / 2);

    const starPoints: THREE.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const radius = i % 2 === 0 ? 0.22 : 0.1;
      starPoints.push(
        new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius),
      );
    }

    const starfish = new THREE.ExtrudeGeometry(new THREE.Shape(starPoints), {
      depth: 0.04,
      bevelEnabled: false,
    });
    starfish.translate(0, 0, -0.02);
    starfish.rotateX(-Math.PI / 2);

    return {
      palmTrunk,
      palmFronds: createPalmFronds(),
      rock,
      shell,
      starfish,
    };
  }, []);

  const materials = useMemo(() => ({
    palmTrunk: new THREE.MeshStandardMaterial({
      color: COLORS.palmTrunk,
      roughness: 0.9,
      flatShading: true,
    }),
    palmFronds: new THREE.MeshStandardMaterial({
      color: COLORS.palmFrond,
      roughness: 0.8,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
    rock: new THREE.MeshStandardMaterial({
      color: COLORS.rock,
      roughness: 1,
      flatShading: true,
    }),
    shell: new THREE.MeshStandardMaterial({
      color: COLORS.shell,
      roughness: 0.7,
      metalness: 0.1,
    }),
    starfish: new THREE.MeshStandardMaterial({
      color: COLORS.starfish,
      roughness: 0.8,
    }),
  }), []);

  const placements = useMemo(() => {
    const grouped: Record<DecorationType, Placement[]> = {
      palm: [],
      rock: [],
      shell: [],
      starfish: [],
    };

    for (const decoration of decorations) {
      const { x, z } = gridToWorld(decoration.gx, decoration.gz);
      grouped[decoration.type].push({
        x,
        z,
        rotation: decoration.rotation,
        scale: decoration.scale,
      });
    }

    return grouped;
  }, [decorations]);

  useEffect(() => () => {
    Object.values(geometries).forEach((geometry) => geometry.dispose());
    Object.values(materials).forEach((material) => material.dispose());
  }, [geometries, materials]);

  return (
    <>
      <DecorationInstances
        geometry={geometries.palmTrunk}
        material={materials.palmTrunk}
        placements={placements.palm}
        baseScale={DECOR_SCALE.palm}
      />
      <DecorationInstances
        geometry={geometries.palmFronds}
        material={materials.palmFronds}
        placements={placements.palm}
        baseScale={DECOR_SCALE.palm}
      />
      <DecorationInstances
        geometry={geometries.rock}
        material={materials.rock}
        placements={placements.rock}
        baseScale={DECOR_SCALE.rock}
      />
      <DecorationInstances
        geometry={geometries.shell}
        material={materials.shell}
        placements={placements.shell}
        baseScale={DECOR_SCALE.shell}
      />
      <DecorationInstances
        geometry={geometries.starfish}
        material={materials.starfish}
        placements={placements.starfish}
        baseScale={DECOR_SCALE.starfish}
      />
    </>
  );
}
