import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import SandboxScene from './SandboxScene';
import SandboxControls from './SandboxControls';
import SandboxErrorBoundary from './SandboxErrorBoundary';
import { useSandboxStore } from '../../store/sandboxStore';
import { CAMERA_DEFAULTS } from '../../lib/sandbox/constants';

export default function SandboxApp() {
  const { showUI, load } = useSandboxStore();
  const [canvasReady, setCanvasReady] = useState(false);
  const [webGLAvailable, setWebGLAvailable] = useState<boolean | null>(null);

  // Load persisted state on mount
  const loaded = useRef(false);
  if (!loaded.current) {
    load();
    loaded.current = true;
  }

  useEffect(() => {
    const probe = document.createElement('canvas');
    const context = (
      probe.getContext('webgl2') ?? probe.getContext('webgl')
    ) as WebGLRenderingContext | WebGL2RenderingContext | null;

    setWebGLAvailable(context !== null);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  }, []);

  const isPreparing = webGLAvailable === null || (webGLAvailable && !canvasReady);

  return (
    <div className="sandbox-app">
      {isPreparing && (
        <div className="sandbox-app__status" role="status">
          Preparing the sandbox&hellip;
        </div>
      )}

      {webGLAvailable === false && (
        <div className="sandbox-app__status sandbox-app__status--error" role="alert">
          This game needs WebGL, but WebGL is not available in this browser.
        </div>
      )}

      {webGLAvailable && (
        <SandboxErrorBoundary>
          <Canvas
            className="sandbox-app__canvas"
            aria-label="Interactive sandcastle terrain sandbox"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
            }}
            camera={{
              fov: CAMERA_DEFAULTS.fov,
              position: CAMERA_DEFAULTS.position,
              near: 0.1,
              far: 200,
            }}
            gl={{
              alpha: true,
              antialias: true,
            }}
            dpr={[1, 2]}
            onCreated={({ gl }) => {
              gl.setClearColor(0x050508, 0);
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
              setCanvasReady(true);
            }}
          >
            <Suspense fallback={null}>
              <SandboxScene />
            </Suspense>
          </Canvas>
        </SandboxErrorBoundary>
      )}

      {showUI && <SandboxControls />}
    </div>
  );
}
