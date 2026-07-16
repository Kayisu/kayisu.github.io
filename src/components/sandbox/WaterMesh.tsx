import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSandboxStore } from '../../store/sandboxStore';
import {
  GRID_SIZE,
  WORLD_SIZE,
  CELL_SIZE,
  COLORS,
  WATER_RENDER_THRESHOLD,
  MAX_WATER_INSTANCES,
} from '../../lib/sandbox/constants';

// Water vertex shader
const waterVertexShader = `
  uniform float uTime;
  varying float vDepth;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vDepth = position.y;
    
    // Subtle wave animation
    float wave = sin(position.x * 8.0 + uTime * 1.5) * 0.008 +
                 sin(position.z * 6.0 + uTime * 1.2) * 0.006 +
                 sin((position.x + position.z) * 4.0 + uTime * 0.8) * 0.004;
    vWave = wave;
    
    vec3 pos = position;
    pos.y += wave;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// Water fragment shader with foam at edges
const waterFragmentShader = `
  uniform float uTime;
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec3 uFoamColor;
  
  varying float vDepth;
  varying vec2 vUv;
  varying float vWave;

  void main() {
    // Depth-based color (0 = shallow, 1 = deep)
    float depthNorm = clamp(vDepth / 0.5, 0.0, 1.0);
    vec3 waterColor = mix(uShallowColor, uDeepColor, depthNorm * depthNorm);
    
    // Foam at wave peaks and edges
    float foam = smoothstep(0.008, 0.015, abs(vWave));
    foam *= smoothstep(0.02, 0.08, vDepth); // more foam in shallower water
    
    // Caustics-like sparkle
    float sparkle = sin(vUv.x * 100.0 + uTime * 5.0) * sin(vUv.y * 100.0 + uTime * 3.0);
    sparkle = max(0.0, sparkle) * 0.3 * (1.0 - depthNorm);
    
    vec3 finalColor = mix(waterColor, uFoamColor, foam * 0.6);
    finalColor += vec3(sparkle);
    
    // Transparency based on depth
    float alpha = mix(0.55, 0.85, depthNorm) * (1.0 - foam * 0.3);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function WaterMesh() {
  const waterGrid = useSandboxStore((state) => state.waterGrid);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Shared geometry (quad)
  const geometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(CELL_SIZE * 0.95, CELL_SIZE * 0.95);
    geom.rotateX(-Math.PI / 2);
    return geom;
  }, []);

  // Custom shader material
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uShallowColor: { value: new THREE.Color(COLORS.water) },
        uDeepColor: { value: new THREE.Color(COLORS.waterDeep) },
        uFoamColor: { value: new THREE.Color(COLORS.waterFoam) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    return mat;
  }, []);

  const dummy = useRef(new THREE.Object3D()).current;

  // Update water instances each frame
  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const time = state.clock.getElapsedTime();

    // Update shader time
    material.uniforms.uTime.value = time;

    // Rebuild instances from water grid
    let count = 0;

    for (let gz = 0; gz < GRID_SIZE; gz++) {
      const base = gz * GRID_SIZE;
      const z = (gz + 0.5) * CELL_SIZE - WORLD_SIZE * 0.5;
      
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (count >= MAX_WATER_INSTANCES) break;

        const waterDepth = waterGrid.data[base + gx];
        if (waterDepth < WATER_RENDER_THRESHOLD) continue;

        const x = (gx + 0.5) * CELL_SIZE - WORLD_SIZE * 0.5;
        
        dummy.position.set(x, waterDepth * 0.5, z);
        dummy.rotation.x = -Math.PI / 2;
        dummy.updateMatrix();
        mesh.setMatrixAt(count, dummy.matrix);
        count++;
      }
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_WATER_INSTANCES]}
      frustumCulled
      dispose={null}
    />
  );
}
