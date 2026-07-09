import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSandboxStore } from '../../store/sandboxStore';
import { GRID_SIZE, CELL_SIZE, WORLD_SIZE, COLORS, DECOR_SCALE } from '../../lib/sandbox/constants';

const MAX_DECORATIONS = 1024;

const shellPts = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.15, 0.05),
  new THREE.Vector2(0.2, 0.15),
  new THREE.Vector2(0.18, 0.25),
  new THREE.Vector2(0.12, 0.3),
  new THREE.Vector2(0, 0.32),
];

function gridToWorld(gx: number, gz: number): { x: number; z: number } {
  const half = WORLD_SIZE * 0.5;
  return {
    x: (gx + 0.5) * CELL_SIZE - half,
    z: (gz + 0.5) * CELL_SIZE - half,
  };
}

export default function Decorations() {
  const decorations = useSandboxStore((s) => s.decorations);

  // Geometries
  const geomMap = useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();

    // Palm: trunk cone + fronds (separate geometries)
    const palmTrunk = new THREE.ConeGeometry(0.12, 2.8, 6, 1, true);
    palmTrunk.translate(0, 1.4, 0);
    map.set('palm_trunk', palmTrunk);

    const frond = new THREE.PlaneGeometry(0.15, 1.2);
    frond.translate(0, 0.6, 0);
    const palmFronds = new THREE.InstancedBufferGeometry();
    palmFronds.copy(frond);
    palmFronds.instanceCount = 5;
    const frondAngles = new Float32Array([0, 72, 144, 216, 288].map((d) => (d * Math.PI) / 180));
    palmFronds.setAttribute('angle', new THREE.InstancedBufferAttribute(frondAngles, 1));
    map.set('palm_fronds', palmFronds);

    // Rock: low-poly icosphere
    const rock = new THREE.IcosahedronGeometry(0.45, 0);
    map.set('rock', rock);

    // Shell: lathe
    const shell = new THREE.LatheGeometry(shellPts, 12);
    shell.translate(0, 0.08, 0);
    shell.rotateX(-Math.PI / 2);
    map.set('shell', shell);

    // Starfish: extruded star
    const starPts = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.22 : 0.1;
      starPts.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    const starShape = new THREE.Shape(starPts);
    const starfish = new THREE.ExtrudeGeometry(starShape, { depth: 0.04, bevelEnabled: false });
    starfish.translate(0, 0, -0.02);
    starfish.rotateX(-Math.PI / 2);
    map.set('starfish', starfish);

    return map;
  }, []);

  // Materials
  const matMap = useMemo(() => {
    const map = new Map<string, THREE.MeshStandardMaterial>();
    map.set('palm_trunk', new THREE.MeshStandardMaterial({
      color: COLORS.palmTrunk,
      roughness: 0.9,
      flatShading: true,
    }));
    map.set('palm_fronds', new THREE.MeshStandardMaterial({
      color: COLORS.palmFrond,
      roughness: 0.8,
      side: THREE.DoubleSide,
      flatShading: true,
    }));
    map.set('rock', new THREE.MeshStandardMaterial({
      color: COLORS.rock,
      roughness: 1,
      flatShading: true,
    }));
    map.set('shell', new THREE.MeshStandardMaterial({
      color: COLORS.shell,
      roughness: 0.7,
      metalness: 0.1,
    }));
    map.set('starfish', new THREE.MeshStandardMaterial({
      color: COLORS.starfish,
      roughness: 0.8,
    }));
    return map;
  }, []);

  // Instanced meshes
  const meshesRef = useRef(new Map<string, THREE.InstancedMesh>());
  const dummy = useRef(new THREE.Object3D()).current;

  useMemo(() => {
    geomMap.forEach((geom, type) => {
      const mat = matMap.get(type)!;
      const mesh = new THREE.InstancedMesh(geom, mat, MAX_DECORATIONS);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      meshesRef.current.set(type, mesh);
    });
  }, [geomMap, matMap]);

  // Update instances
  useFrame(() => {
    // Reset counts
    meshesRef.current.forEach((mesh) => { mesh.count = 0; });

    // Group by type
    const byType = new Map<string, Array<{ x: number; z: number; rotation: number; scale: number }>>();
    
    decorations.forEach((dec) => {
      const { x, z } = gridToWorld(dec.gx, dec.gz);
      if (!byType.has(dec.type)) byType.set(dec.type, []);
      byType.get(dec.type)!.push({ x, z, rotation: dec.rotation, scale: dec.scale });
    });

    // Update each type
    byType.forEach((items, type) => {
      let trunkMesh: THREE.InstancedMesh | undefined;
      let frondMesh: THREE.InstancedMesh | undefined;

      if (type === 'palm') {
        trunkMesh = meshesRef.current.get('palm_trunk');
        frondMesh = meshesRef.current.get('palm_fronds');
      } else {
        const mesh = meshesRef.current.get(type);
        if (!mesh) return;
        
        items.forEach((item, i) => {
          if (i >= MAX_DECORATIONS) return;
          const s = DECOR_SCALE[type as keyof typeof DECOR_SCALE] * item.scale;
          dummy.position.set(item.x, 0, item.z);
          dummy.rotation.y = item.rotation;
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.count = items.length;
        mesh.instanceMatrix.needsUpdate = true;
      }

      // Palm needs special handling (trunk + fronds)
      if (type === 'palm' && trunkMesh && frondMesh) {
        items.forEach((item, i) => {
          if (i >= MAX_DECORATIONS) return;
          const s = DECOR_SCALE.palm * item.scale;
          dummy.position.set(item.x, 0, item.z);
          dummy.rotation.y = item.rotation;
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          trunkMesh.setMatrixAt(i, dummy.matrix);
        });
        trunkMesh.count = items.length;
        trunkMesh.instanceMatrix.needsUpdate = true;
        
        // Fronds use same matrices
        frondMesh.count = items.length;
        frondMesh.instanceMatrix.needsUpdate = true;
      }
    });
  });

  // Cleanup
  useEffect(() => {
    return () => {
      geomMap.forEach((g) => g.dispose());
      matMap.forEach((m) => m.dispose());
    };
  }, [geomMap, matMap]);

  // Render all meshes
  return (
    <>
      {Array.from(meshesRef.current.entries()).map(([type, mesh], i) => (
        <instancedMesh
          key={type}
          ref={mesh}
          geometry={mesh.geometry}
          material={mesh.material}
          count={MAX_DECORATIONS}
        />
      ))}
    </>
  );
}