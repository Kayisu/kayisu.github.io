import { create } from 'zustand';

// Shared state between the R3F canvas and the DOM overlay UI (info panel,
// search, speed buttons). Replaces the original script.js globals
// (globalSpeedMultiplier, currentSelectedPlanet, cameraFollowTarget,
// isCameraAnimating) with one small store both sides can read/write.
interface SolarState {
  /** 0 = pause, 1 = play, 5 = fast, 20 = fastest */
  speedMultiplier: number;
  /** body name currently shown in the info panel, or null */
  selected: string | null;
  /** body the camera is tracking, or null */
  followTarget: string | null;
  /** true while the camera is still flying toward the target */
  isAnimating: boolean;

  setSpeed: (n: number) => void;
  /** open the info panel for `name` and smooth-zoom the camera to it */
  select: (name: string) => void;
  /** close the panel and stop tracking */
  close: () => void;
  setAnimating: (b: boolean) => void;
}

export const useSolarStore = create<SolarState>((set) => ({
  speedMultiplier: 1,
  selected: null,
  followTarget: null,
  isAnimating: false,

  setSpeed: (n) => set({ speedMultiplier: n }),
  select: (name) => set({ selected: name, followTarget: name, isAnimating: true }),
  close: () => set({ selected: null, followTarget: null, isAnimating: false }),
  setAnimating: (b) => set({ isAnimating: b }),
}));
