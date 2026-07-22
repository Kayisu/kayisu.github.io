import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { orbitalSpeed } from '../../data/planets';
import { useSolarStore } from '../../store/solarStore';
import type { SolarBody } from './types';
import type { SolarTheme } from './solarTheme';

interface PlanetProps {
  body: SolarBody;
  motionScale: number;
  reducedMotion: boolean;
  theme: SolarTheme;
}

// The faint static circle marking a planet's orbit. Built from the edges of a
// thin ring, laid flat — exactly as the original script.js did it.
function OrbitPath({ distance, color }: { distance: number; color: string }) {
  const geometry = useMemo(() => {
    const ring = new THREE.RingGeometry(distance, distance + 0.05, 128);
    const edges = new THREE.EdgesGeometry(ring);
    ring.dispose();
    return edges;
  }, [distance]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
      <lineBasicMaterial color={color} transparent opacity={0.42} />
    </lineSegments>
  );
}

export default function Planet({ body, motionScale, reducedMotion, theme }: PlanetProps) {
  const texture = useTexture(body.texture);
  const orbitRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();
  const select = useSolarStore((s) => s.select);
  const setHovered = useSolarStore((s) => s.setHovered);
  const clearHovered = useSolarStore((s) => s.clearHovered);
  const highlighted = useSolarStore(
    (s) => s.selected === body.name || s.hovered === body.name || s.previewed === body.name,
  );

  // Kepler-derived orbital speed (slower the farther out), same as the original.
  const speed = useMemo(() => orbitalSpeed(body.distance), [body.distance]);

  useEffect(() => {
    return () => {
      clearHovered(body.name);
      gl.domElement.style.cursor = '';
    };
  }, [body.name, clearHovered, gl]);

  useFrame((_, delta) => {
    if (reducedMotion) return;

    const state = useSolarStore.getState();
    const paused =
      state.selected === body.name ||
      state.hovered === body.name ||
      state.previewed === body.name;
    if (paused) return;

    const frame = Math.min(delta, 0.05) * 60 * motionScale * state.speedMultiplier;
    if (orbitRef.current) orbitRef.current.rotation.y += speed * frame;
    if (meshRef.current) meshRef.current.rotation.y += 0.01 * frame;
  });

  const hitRadius = Math.max(body.radius * 1.8, 0.9);
  const onPointerEnter = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setHovered(body.name);
    gl.domElement.style.cursor = 'pointer';
  };
  const onPointerLeave = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    clearHovered(body.name);
    gl.domElement.style.cursor = '';
  };

  return (
    <group>
      <OrbitPath distance={body.distance} color={theme.orbit} />
      <group ref={orbitRef}>
        <group position={[body.distance, 0, 0]}>
          <mesh ref={meshRef} name={body.name}>
            <sphereGeometry args={[body.radius, 32, 32]} />
            <meshBasicMaterial map={texture} />

            {body.hasRing && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[body.radius * 1.4, body.radius * 2.2, 32]} />
                <meshStandardMaterial
                  color={body.color}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            )}
          </mesh>

          {highlighted && (
            <mesh raycast={() => {}} renderOrder={2}>
              <sphereGeometry args={[body.radius * 1.18, 28, 28]} />
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
            onPointerOver={onPointerEnter}
            onPointerOut={onPointerLeave}
          >
            <sphereGeometry args={[hitRadius, 20, 20]} />
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
              colorWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
