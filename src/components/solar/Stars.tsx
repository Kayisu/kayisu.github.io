import { useMemo, useRef } from 'react';
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
  varying float vAlpha;
  void main() {
    // Twinkle math
    float twinkle = sin(time * 2.0 + vAlpha * 10.0) * 0.5 + 0.5;
    float finalAlpha = vAlpha * 0.5 + twinkle * 0.5;

    // Circular particle
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;

    gl_FragColor = vec4(1.0, 1.0, 1.0, finalAlpha * 0.8);
  }
`;

export default function Stars() {
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

  useFrame((state) => {
    if (matRef.current) {
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
        args={[
          {
            uniforms: { time: { value: 0 } },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
          },
        ]}
      />
    </points>
  );
}
