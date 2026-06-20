import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANETS } from '../../data/planets';
import { useSolarStore } from '../../store/solarStore';
import Stars from './Stars';
import Sun from './Sun';
import Planet from './Planet';

// The whole "universe": lights + stars + sun + planets, tilted for a nicer 3D
// read and very slowly spinning as a whole (script.js applied both to
// scene.rotation). The tilt is the initial euler; the y-spin accumulates.
export default function Scene() {
  const universeRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const mult = useSolarStore.getState().speedMultiplier;
    if (universeRef.current) universeRef.current.rotation.y += 0.0005 * mult;
  });

  return (
    <>
      <ambientLight color={0xffffff} intensity={0.8} />
      <pointLight color={0xffddaa} intensity={3} distance={150} />

      <group ref={universeRef} rotation={[0.2, 0, 0.1]}>
        <Stars />
        <Sun />
        {PLANETS.map((body) => (
          <Planet key={body.name} body={body} />
        ))}
      </group>
    </>
  );
}
