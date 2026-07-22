import { create } from 'zustand';
import type { SolarSpeed } from '../components/solar/types';

// Shared state between the R3F canvas and the DOM overlay UI (info panel,
// search, speed buttons). Replaces the original script.js globals
// (globalSpeedMultiplier, currentSelectedPlanet, cameraFollowTarget,
// isCameraAnimating) with one small store both sides can read/write.
export interface SolarState {
  speedMultiplier: SolarSpeed;
  /** body name currently shown in the info panel, or null */
  selected: string | null;
  /** body the camera is tracking, or null */
  followTarget: string | null;
  /** true while the camera is still flying toward the target */
  isAnimating: boolean;
  /** Canvas pointer hover, kept separate from static-link previews. */
  hovered: string | null;
  /** Body preview requested by a static `data-solar-body` link. */
  previewed: string | null;

  setSpeed: (n: SolarSpeed) => void;
  /** open the info panel for `name` and smooth-zoom the camera to it */
  select: (name: string) => void;
  /** close the panel and stop tracking */
  close: () => void;
  setAnimating: (b: boolean) => void;
  stopFollowing: () => void;
  setHovered: (name: string | null) => void;
  clearHovered: (name: string) => void;
  setPreviewed: (name: string | null) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  speedMultiplier: 1 as SolarSpeed,
  selected: null,
  followTarget: null,
  isAnimating: false,
  hovered: null,
  previewed: null,
};

const SPEEDS = new Set<SolarSpeed>([0, 0.5, 1, 2]);

export const useSolarStore = create<SolarState>((set) => ({
  ...INITIAL_STATE,

  setSpeed: (n) => {
    if (SPEEDS.has(n)) set({ speedMultiplier: n });
  },
  select: (name) => set({ selected: name, followTarget: name, isAnimating: true }),
  close: () => set({ selected: null, followTarget: null, isAnimating: false }),
  setAnimating: (b) => set({ isAnimating: b }),
  stopFollowing: () => set({ followTarget: null, isAnimating: false }),
  setHovered: (name) => set({ hovered: name }),
  clearHovered: (name) => set((state) => (state.hovered === name ? { hovered: null } : state)),
  setPreviewed: (name) => set({ previewed: name }),
  reset: () => set(INITIAL_STATE),
}));
