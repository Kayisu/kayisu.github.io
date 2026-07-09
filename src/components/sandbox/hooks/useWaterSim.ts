import { useFrame } from '@react-three/fiber';
import { useSandboxStore } from '../../../store/sandboxStore';

export function useWaterSim() {
  const { heightGrid, waterGrid } = useSandboxStore();

  useFrame(() => {
    waterGrid.step(heightGrid);
  });
}