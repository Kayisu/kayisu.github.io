import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSolarStore } from '../../store/solarStore';
import Stars from './Stars';
import Sun from './Sun';
import Planet from './Planet';
import type { SolarTheme } from './solarTheme';
import type { SolarBody, SolarMode } from './types';

interface SceneProps {
  bodies: SolarBody[];
  mode: SolarMode;
  reducedMotion: boolean;
  theme: SolarTheme;
}

const MOTION_SCALE: Record<SolarMode, number> = {
  hero: 0.08,
  explore: 0.12,
};

// The whole "universe": lights + stars + sun + planets, tilted for a nicer 3D
// read and very slowly spinning as a whole (script.js applied both to
// scene.rotation). The tilt is the initial euler; the y-spin accumulates.
export default function Scene({ bodies, mode, reducedMotion, theme }: SceneProps) {
  const universeRef = useRef<THREE.Group>(null);
  const star = bodies.find((body) => body.isStar);
  const planets = bodies.filter((body) => !body.isStar);
  const motionScale = MOTION_SCALE[mode];

  useFrame((_, delta) => {
    if (reducedMotion || !universeRef.current) return;
    const state = useSolarStore.getState();
    if (state.followTarget || state.selected) return;

    const frame = Math.min(delta, 0.05) * 60 * motionScale * state.speedMultiplier;
    universeRef.current.rotation.y += 0.0005 * frame;
  });

  return (
    <>
      <ambientLight color={0xffffff} intensity={0.8} />
      <pointLight color={0xffddaa} intensity={3} distance={150} />

      <group ref={universeRef} rotation={[0.2, 0, 0.1]}>
        <Stars color={theme.stars} reducedMotion={reducedMotion} />
        {star && (
          <Sun
            body={star}
            motionScale={motionScale}
            reducedMotion={reducedMotion}
            theme={theme}
          />
        )}
        {planets.map((body) => (
          <Planet
            key={body.name}
            body={body}
            motionScale={motionScale}
            reducedMotion={reducedMotion}
            theme={theme}
          />
        ))}
      </group>
    </>
  );
}
