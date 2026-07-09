import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SandboxScene from './SandboxScene';
import SandboxControls from './SandboxControls';
import { useSandboxStore } from '../../store/sandboxStore';
import { CAMERA_DEFAULTS } from '../../lib/sandbox/constants';

export default function SandboxApp() {
  const { showUI, load } = useSandboxStore();

  // Load persisted state on mount
  const loaded = useRef(false);
  if (!loaded.current) {
    load();
    loaded.current = true;
  }

  return (
    <>
      <Canvas
        className="sandbox-canvas"
        camera={{
          fov: CAMERA_DEFAULTS.fov,
          position: CAMERA_DEFAULTS.position,
          near: 0.1,
          far: 200,
        }}
        gl={{
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.setClearColor(0x050508, 0);
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <SandboxScene />
        </Suspense>
      </Canvas>
      {showUI && <SandboxControls />}
    </>
  );
}