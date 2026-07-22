import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useSolarStore } from '../../store/solarStore';
import type { SolarTheme } from './solarTheme';
import type { SolarBody } from './types';

interface SunProps {
  body: SolarBody;
  motionScale: number;
  reducedMotion: boolean;
  theme: SolarTheme;
}

// The sun: an unlit textured sphere at the origin. Also a point light source
// (added in Scene). Clicking it opens the info panel and zooms, same as a planet.
export default function Sun({ body, motionScale, reducedMotion, theme }: SunProps) {
  const texture = useTexture(body.texture);
  const meshRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();
  const select = useSolarStore((s) => s.select);
  const setHovered = useSolarStore((s) => s.setHovered);
  const clearHovered = useSolarStore((s) => s.clearHovered);
  const highlighted = useSolarStore(
    (s) => s.selected === body.name || s.hovered === body.name || s.previewed === body.name,
  );

  useEffect(() => {
    return () => {
      clearHovered(body.name);
      gl.domElement.style.cursor = '';
    };
  }, [body.name, clearHovered, gl]);

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return;
    const state = useSolarStore.getState();
    if (
      state.selected === body.name ||
      state.hovered === body.name ||
      state.previewed === body.name
    ) return;

    const frame = Math.min(delta, 0.05) * 60 * motionScale * state.speedMultiplier;
    meshRef.current.rotation.y += 0.003 * frame;
  });

  const hitRadius = Math.max(body.radius * 1.8, 0.9);

  return (
    <group>
      <mesh ref={meshRef} name={body.name}>
        <sphereGeometry args={[body.radius, 32, 32]} />
        <meshBasicMaterial map={texture} color={body.color} />
      </mesh>

      {highlighted && (
        <mesh raycast={() => {}} renderOrder={2}>
          <sphereGeometry args={[body.radius * 1.14, 28, 28]} />
          <meshBasicMaterial
            color={theme.halo}
            wireframe
            transparent
            opacity={0.72}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh
        onClick={(event) => {
          event.stopPropagation();
          select(body.name);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(body.name);
          gl.domElement.style.cursor = 'pointer';
        }}
        onPointerOut={(event) => {
          event.stopPropagation();
          clearHovered(body.name);
          gl.domElement.style.cursor = '';
        }}
      >
        <sphereGeometry args={[hitRadius, 20, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  );
}
