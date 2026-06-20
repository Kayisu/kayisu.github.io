import { OrbitControls } from '@react-three/drei';

// Interactive orbit/zoom/pan, with the same limits the original OrbitControls
// used. Smooth planet-follow and WASD movement are layered on in a later step.
export default function CameraRig() {
  return (
    <OrbitControls
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
