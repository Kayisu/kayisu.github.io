import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene from './Scene';
import CameraRig from './CameraRig';
import SimControls from '../ui/SimControls';
import InfoPanel from '../ui/InfoPanel';

// Root of the interactive island: the WebGL <Canvas> plus its DOM overlay
// (speed/search controls + info panel). They share the zustand store, so they
// must live in one React tree. Hydrated client:only — WebGL can't be SSR'd.
// alpha:true lets the page background show through; dpr is capped at 2.
export default function SolarApp() {
  return (
    <>
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

      <SimControls />
      <InfoPanel />
    </>
  );
}
