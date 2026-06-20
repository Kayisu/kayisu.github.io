import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getBody } from '../../data/planets';
import { useSolarStore } from '../../store/solarStore';
import { useKeyboard } from './useKeyboard';

// Minimal shape of the OrbitControls instance we touch.
interface Controls {
  target: THREE.Vector3;
  update: () => void;
}

const LERP_SPEED = 0.06; // CAMERA_LERP_SPEED in the original
const MOVE_SPEED = 0.5; // KEYBOARD_MOVE_SPEED in the original

// OrbitControls + smooth planet-follow/zoom + WASD, ported from the animate()
// loop in script.js. The selected body is read from the store each frame.
export default function CameraRig() {
  const controlsRef = useRef<Controls>(null);
  const { camera, scene } = useThree();
  const keys = useKeyboard();

  // Scratch vectors reused every frame (avoid per-frame allocation).
  const targetPos = useRef(new THREE.Vector3());
  const dir = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const { followTarget, isAnimating, setAnimating } = useSolarStore.getState();

    // --- Smooth zoom / follow (tracks the moving planet) ---
    if (followTarget) {
      const obj = scene.getObjectByName(followTarget);
      if (obj) {
        scene.updateMatrixWorld(true); // accurate world position for a moving body
        obj.getWorldPosition(targetPos.current);

        if (isAnimating) {
          const radius = getBody(followTarget)?.radius ?? 1;
          const zoomDistance = radius * 5 + 2; // stay N radii away
          dir.current.subVectors(camera.position, targetPos.current).normalize();
          desired.current.copy(targetPos.current).addScaledVector(dir.current, zoomDistance);

          camera.position.lerp(desired.current, LERP_SPEED);
          controls.target.lerp(targetPos.current, LERP_SPEED);

          if (camera.position.distanceTo(desired.current) < 0.5) {
            setAnimating(false);
          }
        } else {
          // Keep the body centered once the zoom finishes.
          controls.target.lerp(targetPos.current, 0.1);
        }
      }
    }

    // --- WASD navigation (disabled mid-zoom, as in the original) ---
    if (!isAnimating) {
      camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      forward.current.normalize();
      right.current.crossVectors(forward.current, camera.up).normalize();

      const k = keys.current;
      if (k['w']) {
        camera.position.addScaledVector(forward.current, MOVE_SPEED);
        controls.target.addScaledVector(forward.current, MOVE_SPEED);
      }
      if (k['s']) {
        camera.position.addScaledVector(forward.current, -MOVE_SPEED);
        controls.target.addScaledVector(forward.current, -MOVE_SPEED);
      }
      if (k['a']) {
        camera.position.addScaledVector(right.current, -MOVE_SPEED);
        controls.target.addScaledVector(right.current, -MOVE_SPEED);
      }
      if (k['d']) {
        camera.position.addScaledVector(right.current, MOVE_SPEED);
        controls.target.addScaledVector(right.current, MOVE_SPEED);
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef as never}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      enablePan
      panSpeed={1.2}
      minDistance={2}
      maxDistance={300}
    />
  );
}
