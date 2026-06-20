import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { orbitalSpeed, type Body } from '../../data/planets';
import { useSolarStore } from '../../store/solarStore';

// The faint static circle marking a planet's orbit. Built from the edges of a
// thin ring, laid flat — exactly as the original script.js did it.
function OrbitPath({ distance }: { distance: number }) {
  const geometry = useMemo(() => {
    const ring = new THREE.RingGeometry(distance, distance + 0.05, 128);
    return new THREE.EdgesGeometry(ring);
  }, [distance]);

  return (
    <lineSegments geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
      <lineBasicMaterial color={0x333333} transparent opacity={0.5} />
    </lineSegments>
  );
}

export default function Planet({ body }: { body: Body }) {
  const texture = useTexture(body.texture);
  const orbitRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const select = useSolarStore((s) => s.select);

  // Kepler-derived orbital speed (slower the farther out), same as the original.
  const speed = useMemo(() => orbitalSpeed(body.distance), [body.distance]);

  useFrame(() => {
    // Read the multiplier imperatively so changing speed doesn't re-render the tree.
    const mult = useSolarStore.getState().speedMultiplier;
    if (orbitRef.current) orbitRef.current.rotation.y += speed * mult;
    if (meshRef.current) meshRef.current.rotation.y += 0.01 * mult;
  });

  return (
    <group>
      <OrbitPath distance={body.distance} />
      <group ref={orbitRef}>
        <mesh
          ref={meshRef}
          name={body.name}
          position={[body.distance, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            select(body.name);
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
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
      </group>
    </group>
  );
}
