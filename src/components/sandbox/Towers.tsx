import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils';
import { useSandboxStore } from '../../store/sandboxStore';
import { gridToWorld } from '../../lib/sandbox/grid';
import { TOWER_BASE_RADIUS, TOWER_HEIGHT, TOWER_FLAG_HEIGHT, COLORS } from '../../lib/sandbox/constants';

const MAX_TOWERS = 256;

export default function Towers() {
  const { towers } = useSandboxStore();
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

    const merged = new THREE.BufferGeometry();
    THREE.BufferGeometryUtils.mergeGeometries([base, roof, pole, flag], false, merged);
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

  const instancedMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(towerGeometry, material, MAX_TOWERS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, [towerGeometry, material]);

  // Update instances when towers array changes
  useFrame(() => {
    const mesh = instancedMesh;
    mesh.count = towers.length;

    towers.forEach((tower, i) => {
      const { x, z } = gridToWorld(tower.gx, tower.gz);
      dummy.position.set(x, 0, z);
      dummy.rotation.y = tower.rotation;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    return () => {
      towerGeometry.dispose();
      material.dispose();
    };
  }, [towerGeometry, material]);

  return <instancedMesh ref={meshRef} args={[towerGeometry, material, MAX_TOWERS]} />;
}