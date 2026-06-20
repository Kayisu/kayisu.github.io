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
        // R3F hardcodes inline `position: relative` on its container, which would
        // make the canvas a flex child of <body> and shove the profile aside.
        // Override it to a fixed, full-viewport background (R3F spreads style last).
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
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
