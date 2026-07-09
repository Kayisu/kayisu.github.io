import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSandboxStore } from '../../../store/sandboxStore';
import { worldToGrid, gridToWorld } from '../../../lib/sandbox/grid';
import { SANDBOX_CONFIG, BRUSH_STRENGTH, TOWER_FLATNESS_THRESHOLD } from '../../../lib/sandbox/constants';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const pointer = { x: 0, y: 0 };

export function useSandboxInput() {
  const { gl, camera } = useThree();
  const canvas = gl.domElement;
  const isDragging = useRef(false);
  const lastGridPos = useRef<{ gx: number; gz: number } | null>(null);

  const {
    tool,
    brushSize,
    activeDecoration,
    heightGrid,
    waterGrid,
    towers,
    decorations,
    addTower,
    addDecoration,
    setGhostPosition,
    setGhostValid,
    setShowGhost,
    setCameraTarget,
  } = useSandboxStore();

  // Track pointer position
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    canvas.addEventListener('pointermove', onPointerMove);
    return () => canvas.removeEventListener('pointermove', onPointerMove);
  }, [canvas]);

  // Handle pointer events
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.target !== canvas) return;
      
      // Ignore clicks on UI
      const target = e.target as HTMLElement;
      if (target.closest('.sandbox-controls')) return;
      
      isDragging.current = true;
      canvas.setPointerCapture(e.pointerId);
      applyToolAtPoint(e.clientX, e.clientY, 'pointerdown');
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      applyToolAtPoint(e.clientX, e.clientY, 'pointermove');
    };

    const onPointerUp = () => {
      isDragging.current = false;
      lastGridPos.current = null;
      if (tool === 'tower') setShowGhost(false);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [canvas, tool, setShowGhost]);

  function applyToolAtPoint(clientX: number, clientY: number, type: string) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * 2 - 1;
    const py = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(new THREE.Vector2(px, py), camera);
    
    const intersect = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, intersect)) return;

    const { gx, gz } = worldToGrid(intersect.x, intersect.z);
    
    // Skip if same cell for continuous tools
    if (lastGridPos.current && 
        lastGridPos.current.gx === gx && 
        lastGridPos.current.gz === gz) {
      return;
    }
    lastGridPos.current = { gx, gz };

    const radius = SANDBOX_CONFIG.BRUSH_SIZES[brushSize];

    switch (tool) {
      case 'build':
        heightGrid.build(gx, gz, radius, BRUSH_STRENGTH);
        break;
      case 'dig':
        heightGrid.dig(gx, gz, radius, BRUSH_STRENGTH);
        // Add water if dug deep enough
        const h = heightGrid.get(gx, gz);
        if (h < SANDBOX_CONFIG.WATER_LEVEL) {
          waterGrid.add(gx, gz, 0.3);
        }
        break;
      case 'flatten':
        heightGrid.flatten(gx, gz, radius, 0.5);
        break;
      case 'tower':
        if (type === 'pointerdown') {
          const valid = heightGrid.isFlat(gx, gz, 2, TOWER_FLATNESS_THRESHOLD);
          if (valid && !isTowerAt(gx, gz)) {
            addTower(gx, gz, Math.random() * Math.PI * 2);
            setShowGhost(false);
          }
        }
        break;
      case 'decorate':
        if (type === 'pointerdown' && !isDecorationAt(gx, gz)) {
          addDecoration(gx, gz, activeDecoration, Math.random() * Math.PI * 2, 0.8 + Math.random() * 0.4);
        }
        break;
    }
  }

  function isTowerAt(gx: number, gz: number): boolean {
    return towers.some((t) => t.gx === gx && t.gz === gz);
  }

  function isDecorationAt(gx: number, gz: number): boolean {
    return decorations.some((d) => d.gx === gx && d.gz === gz);
  }

  // Update ghost preview for tower tool
  useFrame(() => {
    if (tool !== 'tower') {
      setShowGhost(false);
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, intersect)) {
      const { gx, gz } = worldToGrid(intersect.x, intersect.z);
      const valid = heightGrid.isFlat(gx, gz, 2, TOWER_FLATNESS_THRESHOLD) && !isTowerAt(gx, gz);
      setGhostPosition({ gx, gz });
      setGhostValid(valid);
      setShowGhost(true);
    }
  });

  // Keep camera target centered on sandbox
  useFrame(() => {
    setCameraTarget({ x: 0, z: 0 });
  });
}