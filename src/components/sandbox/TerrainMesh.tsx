import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSandboxStore } from '../../store/sandboxStore';
import { GRID_SIZE, WORLD_SIZE, CELL_SIZE, MAX_HEIGHT, COLORS } from '../../lib/sandbox/constants';

const VERTEX_COUNT = GRID_SIZE * GRID_SIZE;
const TRIANGLE_COUNT = (GRID_SIZE - 1) * (GRID_SIZE - 1) * 2;

export default function TerrainMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { heightGrid } = useSandboxStore();

  // Create geometry once
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(VERTEX_COUNT * 3);
    const normals = new Float32Array(VERTEX_COUNT * 3);
    const uvs = new Float32Array(VERTEX_COUNT * 2);
    const indices = new Uint32Array(TRIANGLE_COUNT * 3);

    const halfWorld = WORLD_SIZE * 0.5;

    // Generate vertices
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const z = gz * CELL_SIZE - halfWorld;
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const x = gx * CELL_SIZE - halfWorld;
        const i = (gz * GRID_SIZE + gx) * 3;
        positions[i] = x;
        positions[i + 1] = 0; // height updated in useFrame
        positions[i + 2] = z;

        uvs[(gz * GRID_SIZE + gx) * 2] = gx / (GRID_SIZE - 1);
        uvs[(gz * GRID_SIZE + gx) * 2 + 1] = gz / (GRID_SIZE - 1);
      }
    }

    // Generate indices (two triangles per quad)
    let idx = 0;
    for (let gz = 0; gz < GRID_SIZE - 1; gz++) {
      for (let gx = 0; gx < GRID_SIZE - 1; gx++) {
        const a = gz * GRID_SIZE + gx;
        const b = gz * GRID_SIZE + gx + 1;
        const c = (gz + 1) * GRID_SIZE + gx;
        const d = (gz + 1) * GRID_SIZE + gx + 1;

        indices[idx++] = a;
        indices[idx++] = c;
        indices[idx++] = b;

        indices[idx++] = b;
        indices[idx++] = c;
        indices[idx++] = d;
      }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();

    return geom;
  }, []);

  // Material with vertex colors for wet/dry sand
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: COLORS.sand,
      roughness: 0.9,
      metalness: 0,
      vertexColors: false, // we'll use color attribute for height-based tint
      flatShading: false,
    });
  }, []);

  // Update vertex positions (height) and normals each frame
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const positions = mesh.geometry.attributes.position;
    const normals = mesh.geometry.attributes.normal;
    const data = heightGrid.data;

    // Update heights
    for (let i = 0; i < VERTEX_COUNT; i++) {
      positions.array[i * 3 + 1] = data[i];
    }
    positions.needsUpdate = true;

    // Recompute normals (only for dirty region for perf)
    const { minX, minZ, maxX, maxZ } = heightGrid.getDirtyRect();
    if (heightGrid.hasDirty()) {
      // For simplicity, recompute all - 16k vertices is fast enough
      mesh.geometry.computeVertexNormals();
      heightGrid.clearDirty();
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      receiveShadow
      castShadow
    />
  );
}