import { create } from 'zustand';
import { HeightGrid } from '../lib/sandbox/terrain';
import { WaterGrid } from '../lib/sandbox/water';
import {
  MAX_DECORATIONS,
  MAX_TOWERS,
  type DecorationType,
  type ToolType,
} from '../lib/sandbox/constants';
import {
  parseSandboxSave,
  type SandboxDecoration,
  type SandboxSaveV1,
  type SandboxTower,
} from '../lib/sandbox/persistence';

export type SandboxLoadResult = 'empty' | 'loaded' | 'legacy' | 'invalid';

interface SandboxState {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  decorType: DecorationType;
  setDecorType: (type: DecorationType) => void;

  heightGrid: HeightGrid;
  waterGrid: WaterGrid;

  towers: SandboxTower[];
  addTower: (gx: number, gz: number, rotation: number) => void;
  removeTower: (index: number) => void;

  decorations: SandboxDecoration[];
  addDecoration: (
    gx: number,
    gz: number,
    type: DecorationType,
    rotation: number,
    scale?: number,
  ) => void;
  removeDecoration: (index: number) => void;

  showUI: boolean;
  toggleUI: () => void;
  showGhost: boolean;
  setShowGhost: (show: boolean) => void;
  ghostPosition: { gx: number; gz: number } | null;
  setGhostPosition: (position: { gx: number; gz: number } | null) => void;
  ghostValid: boolean;
  setGhostValid: (valid: boolean) => void;

  save: () => void;
  load: () => SandboxLoadResult;
  reset: () => void;
}

export const SANDBOX_STORAGE_KEY = 'kayisu-sandbox-state';

function clearSession(
  heightGrid: HeightGrid,
  waterGrid: WaterGrid,
  set: (partial: Partial<SandboxState>) => void,
) {
  heightGrid.reset();
  waterGrid.reset();
  set({
    towers: [],
    decorations: [],
    showGhost: false,
    ghostPosition: null,
  });
}

function removeStoredSession() {
  try {
    localStorage.removeItem(SANDBOX_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to remove sandbox state:', error);
  }
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
  tool: 'build',
  setTool: (tool) => set({ tool }),
  brushSize: 2,
  setBrushSize: (brushSize) => set({ brushSize }),
  decorType: 'palm',
  setDecorType: (decorType) => set({ decorType }),

  heightGrid: new HeightGrid(),
  waterGrid: new WaterGrid(),

  towers: [],
  addTower: (gx, gz, rotation) => set((state) => {
    if (state.towers.length >= MAX_TOWERS) return state;
    return { towers: [...state.towers, { gx, gz, rotation }] };
  }),
  removeTower: (index) => set((state) => ({
    towers: state.towers.filter((_, towerIndex) => towerIndex !== index),
  })),

  decorations: [],
  addDecoration: (gx, gz, type, rotation, scale = 1) => set((state) => {
    if (state.decorations.length >= MAX_DECORATIONS) return state;
    return {
      decorations: [
        ...state.decorations,
        { gx, gz, type, rotation, scale },
      ],
    };
  }),
  removeDecoration: (index) => set((state) => ({
    decorations: state.decorations.filter(
      (_, decorationIndex) => decorationIndex !== index,
    ),
  })),

  showUI: true,
  toggleUI: () => set((state) => ({ showUI: !state.showUI })),
  showGhost: false,
  setShowGhost: (showGhost) => set({ showGhost }),
  ghostPosition: null,
  setGhostPosition: (ghostPosition) => set({ ghostPosition }),
  ghostValid: true,
  setGhostValid: (ghostValid) => set({ ghostValid }),

  save: () => {
    const state = get();
    const data: SandboxSaveV1 = {
      version: 1,
      heights: Array.from(state.heightGrid.data),
      water: Array.from(state.waterGrid.data),
      towers: state.towers.map((tower) => ({ ...tower })),
      decorations: state.decorations.map((decoration) => ({ ...decoration })),
    };

    try {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save sandbox state:', error);
    }
  },

  load: () => {
    try {
      const raw = localStorage.getItem(SANDBOX_STORAGE_KEY);
      if (!raw) return 'empty';

      const parsed = parseSandboxSave(raw);
      const { heightGrid, waterGrid } = get();

      if (!parsed) {
        clearSession(heightGrid, waterGrid, set);
        removeStoredSession();
        console.warn('Discarded invalid sandbox state.');
        return 'invalid';
      }

      heightGrid.replace(parsed.data.heights);
      waterGrid.replace(parsed.data.water);
      set({
        towers: parsed.data.towers,
        decorations: parsed.data.decorations,
      });

      return parsed.source === 'legacy' ? 'legacy' : 'loaded';
    } catch (error) {
      const { heightGrid, waterGrid } = get();
      clearSession(heightGrid, waterGrid, set);
      console.warn('Failed to load sandbox state:', error);
      return 'invalid';
    }
  },

  reset: () => {
    const { heightGrid, waterGrid } = get();
    clearSession(heightGrid, waterGrid, set);
    removeStoredSession();
  },
}));
