import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import CameraRig from './CameraRig';

// Root of the interactive island. Everything inside <Canvas> is WebGL, so this
// component is hydrated with client:only (it cannot be server-rendered).
// alpha:true lets the page background show through; dpr is capped at 2.
export default function SolarApp() {
  return (
    <Canvas
      className="solar-canvas"
      camera={{ fov: 60, near: 0.1, far: 1000, position: [0, 15, 40] }}
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <CameraRig />
    </Canvas>
  );
}
