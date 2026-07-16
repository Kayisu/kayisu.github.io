import { useFrame } from '@react-three/fiber';
import { useSandboxStore } from '../../../store/sandboxStore';

export function useWaterSim() {
  useFrame(() => {
    const { heightGrid, waterGrid } = useSandboxStore.getState();
    waterGrid.step(heightGrid);
  });
}
