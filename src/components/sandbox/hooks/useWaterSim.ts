import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSandboxStore } from '../../../store/sandboxStore';
import {
  MAX_WATER_CATCH_UP_STEPS,
  WATER_SIMULATION_HZ,
} from '../../../lib/sandbox/constants';

const WATER_STEP_SECONDS = 1 / WATER_SIMULATION_HZ;

export function useWaterSim() {
  const accumulator = useRef(0);

  useFrame((_, delta) => {
    accumulator.current = Math.min(
      accumulator.current + delta,
      WATER_STEP_SECONDS * MAX_WATER_CATCH_UP_STEPS,
    );

    let completedSteps = 0;
    while (
      accumulator.current >= WATER_STEP_SECONDS
      && completedSteps < MAX_WATER_CATCH_UP_STEPS
    ) {
      const { heightGrid, waterGrid } = useSandboxStore.getState();
      waterGrid.step(heightGrid);
      accumulator.current -= WATER_STEP_SECONDS;
      completedSteps++;
    }
  });
}
