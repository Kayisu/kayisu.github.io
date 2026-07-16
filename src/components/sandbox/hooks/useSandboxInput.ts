import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSandboxStore } from '../../../store/sandboxStore';
import { worldToGrid } from '../../../lib/sandbox/grid';
import {
  BRUSH_STRENGTH,
  SANDBOX_CONFIG,
  TOWER_FLATNESS_THRESHOLD,
} from '../../../lib/sandbox/constants';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function useSandboxInput() {
  const { gl, camera } = useThree();
  const canvas = gl.domElement;
  const isDragging = useRef(false);
  const lastGridPosition = useRef<{ gx: number; gz: number } | null>(null);
  const pointer = useRef(new THREE.Vector2()).current;
  const raycaster = useRef(new THREE.Raycaster()).current;
  const intersection = useRef(new THREE.Vector3()).current;

  const applyToolAtPoint = useCallback((
    clientX: number,
    clientY: number,
    eventType: 'pointerdown' | 'pointermove',
  ) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);

    if (!raycaster.ray.intersectPlane(groundPlane, intersection)) return;
    const { gx, gz } = worldToGrid(intersection.x, intersection.z);

    if (
      lastGridPosition.current?.gx === gx
      && lastGridPosition.current.gz === gz
    ) {
      return;
    }
    lastGridPosition.current = { gx, gz };

    const state = useSandboxStore.getState();
    const radius = SANDBOX_CONFIG.BRUSH_SIZES[state.brushSize];

    switch (state.tool) {
      case 'build':
        state.heightGrid.build(gx, gz, radius, BRUSH_STRENGTH);
        break;
      case 'dig': {
        state.heightGrid.dig(gx, gz, radius, BRUSH_STRENGTH);
        if (state.heightGrid.get(gx, gz) < SANDBOX_CONFIG.WATER_LEVEL) {
          state.waterGrid.add(gx, gz, 0.3);
        }
        break;
      }
      case 'flatten':
        state.heightGrid.flatten(gx, gz, radius, 0.5);
        break;
      case 'tower':
        if (
          eventType === 'pointerdown'
          && state.heightGrid.isFlat(gx, gz, 2, TOWER_FLATNESS_THRESHOLD)
          && !state.towers.some((tower) => tower.gx === gx && tower.gz === gz)
        ) {
          state.addTower(gx, gz, Math.random() * Math.PI * 2);
          state.setShowGhost(false);
        }
        break;
      case 'decorate':
        if (
          eventType === 'pointerdown'
          && !state.decorations.some(
            (decoration) => decoration.gx === gx && decoration.gz === gz,
          )
        ) {
          state.addDecoration(
            gx,
            gz,
            state.decorType,
            Math.random() * Math.PI * 2,
            0.8 + Math.random() * 0.4,
          );
        }
        break;
    }
  }, [camera, canvas, intersection, pointer, raycaster]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
    };

    canvas.addEventListener('pointermove', onPointerMove);
    return () => canvas.removeEventListener('pointermove', onPointerMove);
  }, [canvas, pointer]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.target !== canvas || !event.isPrimary) return;
      isDragging.current = true;
      canvas.setPointerCapture(event.pointerId);
      applyToolAtPoint(event.clientX, event.clientY, 'pointerdown');
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging.current || !event.isPrimary) return;
      applyToolAtPoint(event.clientX, event.clientY, 'pointermove');
    };

    const stopDragging = () => {
      isDragging.current = false;
      lastGridPosition.current = null;
      const state = useSandboxStore.getState();
      if (state.showGhost) state.setShowGhost(false);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', stopDragging);
    canvas.addEventListener('pointerleave', stopDragging);
    canvas.addEventListener('pointercancel', stopDragging);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', stopDragging);
      canvas.removeEventListener('pointerleave', stopDragging);
      canvas.removeEventListener('pointercancel', stopDragging);
    };
  }, [applyToolAtPoint, canvas]);

  useFrame(() => {
    const state = useSandboxStore.getState();
    if (state.tool !== 'tower') {
      if (state.showGhost) state.setShowGhost(false);
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(groundPlane, intersection)) {
      if (state.showGhost) state.setShowGhost(false);
      return;
    }

    const { gx, gz } = worldToGrid(intersection.x, intersection.z);
    const valid = state.heightGrid.isFlat(
      gx,
      gz,
      2,
      TOWER_FLATNESS_THRESHOLD,
    ) && !state.towers.some((tower) => tower.gx === gx && tower.gz === gz);

    if (state.ghostPosition?.gx !== gx || state.ghostPosition.gz !== gz) {
      state.setGhostPosition({ gx, gz });
    }
    if (state.ghostValid !== valid) state.setGhostValid(valid);
    if (!state.showGhost) state.setShowGhost(true);
  });
}
