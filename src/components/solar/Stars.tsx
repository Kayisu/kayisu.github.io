import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Twinkling background starfield. Ported verbatim from script.js: 1500 points
// scattered in a large spherical shell, with a custom shader that fades each
// star in and out over time.
const STAR_COUNT = 1500;

const vertexShader = /* glsl */ `
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (1.5 / -mvPosition.z) * 150.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float time;
  uniform vec3 starColor;
  varying float vAlpha;
  void main() {
    // Twinkle math
    float twinkle = sin(time * 2.0 + vAlpha * 10.0) * 0.5 + 0.5;
    float finalAlpha = vAlpha * 0.5 + twinkle * 0.5;

    // Circular particle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    gl_FragColor = vec4(starColor, finalAlpha * 0.8);
  }
`;

interface StarsProps {
  color: string;
  reducedMotion: boolean;
}

export default function Stars({ color, reducedMotion }: StarsProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, alphas } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const alphas = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT * 3; i += 3) {
      const r = 100 + Math.random() * 200;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);
      alphas[i / 3] = Math.random();
    }
    return { positions, alphas };
  }, []);

  const uniforms = useMemo(
    () => ({ time: { value: 0 }, starColor: { value: new THREE.Color(color) } }),
    [],
  );

  useEffect(() => {
    uniforms.starColor.value.set(color);
  }, [color, uniforms]);

  useFrame((state) => {
    if (matRef.current && !reducedMotion) {
      matRef.current.uniforms.time.value = state.clock.getElapsedTime();
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-alpha" args={[alphas, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  );
}
