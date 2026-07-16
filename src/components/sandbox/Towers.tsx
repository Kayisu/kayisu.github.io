import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useSandboxStore } from '../../store/sandboxStore';
import { gridToWorld } from '../../lib/sandbox/grid';
import {
  TOWER_BASE_RADIUS,
  TOWER_HEIGHT,
  TOWER_FLAG_HEIGHT,
  MAX_TOWERS,
  COLORS,
} from '../../lib/sandbox/constants';

export default function Towers() {
  const towers = useSandboxStore((state) => state.towers);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useRef(new THREE.Object3D()).current;

  // Tower geometry (base cylinder + cone roof + flag)
  const towerGeometry = useMemo(() => {
    const base = new THREE.CylinderGeometry(TOWER_BASE_RADIUS * 0.6, TOWER_BASE_RADIUS, TOWER_HEIGHT * 0.7, 8);
    const roof = new THREE.ConeGeometry(TOWER_BASE_RADIUS * 0.8, TOWER_HEIGHT * 0.3, 8);
    const pole = new THREE.CylinderGeometry(0.03, 0.03, TOWER_FLAG_HEIGHT, 4);
    const flag = new THREE.PlaneGeometry(0.5, 0.35);

    base.translate(0, TOWER_HEIGHT * 0.35, 0);
    roof.translate(0, TOWER_HEIGHT * 0.7 + TOWER_HEIGHT * 0.15, 0);
    pole.translate(0, TOWER_HEIGHT + TOWER_FLAG_HEIGHT * 0.5, 0);
    flag.translate(0, TOWER_HEIGHT + TOWER_FLAG_HEIGHT, 0.4);
    flag.rotateY(Math.PI / 2);

    const parts = [base, roof, pole, flag];
    const merged = mergeGeometries(parts, false);
    parts.forEach((part) => part.dispose());

    if (!merged) {
      throw new Error('Could not merge tower geometry.');
    }

    return merged;
  }, []);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: COLORS.sand,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const count = Math.min(towers.length, MAX_TOWERS);

    for (let i = 0; i < count; i++) {
      const tower = towers[i];
      const { x, z } = gridToWorld(tower.gx, tower.gz);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, tower.rotation, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy, towers]);

  useEffect(() => {
    return () => {
      towerGeometry.dispose();
      material.dispose();
    };
  }, [towerGeometry, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[towerGeometry, material, MAX_TOWERS]}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
