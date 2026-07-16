import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import TerrainMesh from './TerrainMesh';
import WaterMesh from './WaterMesh';
import Towers from './Towers';
import Decorations from './Decorations';
import SkyDome from './SkyDome';
import { useWaterSim } from './hooks/useWaterSim';
import { useSandboxInput } from './hooks/useSandboxInput';
import { CAMERA_DEFAULTS } from '../../lib/sandbox/constants';

export default function SandboxScene() {
  const cameraTarget = useMemo(
    () => new THREE.Vector3(...CAMERA_DEFAULTS.target),
    [],
  );

  // Run water simulation
  useWaterSim();
  // Handle mouse/touch input
  useSandboxInput();

  return (
    <>
      {/* Lighting */}
      <ambientLight color="#fff8e7" intensity={0.6} />
      <directionalLight
        position={[20, 40, 10]}
        color="#fff5e6"
        intensity={2.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />

      {/* Sky dome */}
      <SkyDome />

      {/* Camera controls - orbit with constraints */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        enablePan
        panSpeed={0.8}
        minDistance={8}
        maxDistance={50}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI * 0.48}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
        target={cameraTarget}
      />

      {/* Scene objects */}
      <Suspense fallback={null}>
        <TerrainMesh />
        <WaterMesh />
        <Towers />
        <Decorations />
      </Suspense>
    </>
  );
}
