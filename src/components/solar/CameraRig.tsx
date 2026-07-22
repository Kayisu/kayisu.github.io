import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSolarStore } from '../../store/solarStore';
import { useKeyboard } from './useKeyboard';
import type { SolarBody, SolarMode } from './types';

// Minimal shape of the OrbitControls instance we touch.
interface Controls {
  target: THREE.Vector3;
  update: () => void;
}

const LERP_SPEED = 0.06; // CAMERA_LERP_SPEED in the original
const MOVE_SPEED = 0.5; // KEYBOARD_MOVE_SPEED in the original

interface CameraRigProps {
  bodies: SolarBody[];
  mode: SolarMode;
  reducedMotion: boolean;
  rootId: string;
}

// OrbitControls + smooth planet-follow/zoom + WASD, ported from the animate()
// loop in script.js. The selected body is read from the store each frame.
export default function CameraRig({ bodies, mode, reducedMotion, rootId }: CameraRigProps) {
  const controlsRef = useRef<Controls>(null);
  const { camera, scene } = useThree();
  const keys = useKeyboard(mode === 'explore', rootId);
  const followTarget = useSolarStore((state) => state.followTarget);
  const bodiesByName = useMemo(
    () => new Map(bodies.map((body) => [body.name, body])),
    [bodies],
  );

  // Scratch vectors reused every frame (avoid per-frame allocation).
  const targetPos = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useEffect(() => {
    if (reducedMotion && followTarget) useSolarStore.getState().stopFollowing();
  }, [followTarget, reducedMotion]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const state = useSolarStore.getState();
    const { followTarget, isAnimating, setAnimating } = state;
    const frame = Math.min(delta, 0.05) * 60;
    const lerp = 1 - Math.pow(1 - LERP_SPEED, frame);

    // --- Smooth zoom / follow (tracks the moving planet) ---
    if (followTarget && !reducedMotion) {
      const obj = scene.getObjectByName(followTarget);
      if (obj) {
        scene.updateMatrixWorld(true); // accurate world position for a moving body
        obj.getWorldPosition(targetPos.current);

        if (isAnimating) {
          const radius = bodiesByName.get(followTarget)?.radius ?? 1;
          const zoomDistance = radius * 5 + 2; // stay N radii away
          dir.current.subVectors(camera.position, targetPos.current).normalize();
          desired.current.copy(targetPos.current).addScaledVector(dir.current, zoomDistance);

          camera.position.lerp(desired.current, lerp);
          controls.target.lerp(targetPos.current, lerp);

          if (camera.position.distanceTo(desired.current) < 0.5) {
            setAnimating(false);
          }
        } else {
          // Keep the body centered once the zoom finishes.
          controls.target.lerp(targetPos.current, 1 - Math.pow(0.9, frame));
        }
      }
    }

    // --- WASD navigation, deliberately scoped to the focused explore shell. ---
    if (mode === 'explore' && !isAnimating) {
      camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      forward.current.normalize();
      right.current.crossVectors(forward.current, camera.up).normalize();

      const k = keys.current;
      const moving = k.w || k.s || k.a || k.d;
      if (moving && followTarget) state.stopFollowing();
      const distance = MOVE_SPEED * frame;
      if (k['w']) {
        camera.position.addScaledVector(forward.current, distance);
        controls.target.addScaledVector(forward.current, distance);
      }
      if (k['s']) {
        camera.position.addScaledVector(forward.current, -distance);
        controls.target.addScaledVector(forward.current, -distance);
      }
      if (k['a']) {
        camera.position.addScaledVector(right.current, -distance);
        controls.target.addScaledVector(right.current, -distance);
      }
      if (k['d']) {
        camera.position.addScaledVector(right.current, distance);
        controls.target.addScaledVector(right.current, distance);
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef as never}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.05}
      enableRotate={mode === 'explore'}
      enablePan={mode === 'explore'}
      enableZoom={mode === 'explore'}
      panSpeed={1.2}
      minDistance={2}
      maxDistance={300}
      onStart={() => useSolarStore.getState().stopFollowing()}
    />
  );
}
