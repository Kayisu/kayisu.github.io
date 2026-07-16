import { create } from 'zustand';
import { HeightGrid } from '../lib/sandbox/terrain';
import { WaterGrid } from '../lib/sandbox/water';
import { type ToolType, type DecorationType } from '../lib/sandbox/constants';

interface Tower {
  gx: number;
  gz: number;
  rotation: number;
}

interface Decoration {
  gx: number;
  gz: number;
  type: DecorationType;
  rotation: number;
  scale: number;
}

interface SandboxState {
  // Tools
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  brushSize: number; // index into BRUSH_SIZES
  setBrushSize: (size: number) => void;
  decorType: DecorationType;
  setDecorType: (type: DecorationType) => void;

  // Grids (imperative refs - don't trigger re-renders on mutation)
  heightGrid: HeightGrid;
  waterGrid: WaterGrid;

  // Placed objects
  towers: Tower[];
  addTower: (gx: number, gz: number, rotation: number) => void;
  removeTower: (index: number) => void;

  decorations: Decoration[];
  addDecoration: (gx: number, gz: number, type: DecorationType, rotation: number, scale?: number) => void;
  removeDecoration: (index: number) => void;

  // UI state
  showUI: boolean;
  toggleUI: () => void;
  showGhost: boolean;
  setShowGhost: (show: boolean) => void;
  ghostPosition: { gx: number; gz: number } | null;
  setGhostPosition: (pos: { gx: number; gz: number } | null) => void;
  ghostValid: boolean;
  setGhostValid: (valid: boolean) => void;

  // Persistence
  save: () => void;
  load: () => boolean;
  reset: () => void;
}

const STORAGE_KEY = 'kayisu-sandbox-state';

export const useSandboxStore = create<SandboxState>((set, get) => ({
  // Tools
  tool: 'build',
  setTool: (tool) => set({ tool }),
  brushSize: 2, // index 2 = size 3
  setBrushSize: (size) => set({ brushSize: size }),
  decorType: 'palm',
  setDecorType: (type) => set({ decorType: type }),

  // Grids
  heightGrid: new HeightGrid(),
  waterGrid: new WaterGrid(),

  // Objects
  towers: [],
  addTower: (gx, gz, rotation) =>
    set((state) => ({
      towers: [...state.towers, { gx, gz, rotation }],
    })),
  removeTower: (index) =>
    set((state) => ({
      towers: state.towers.filter((_, i) => i !== index),
    })),

  decorations: [],
  addDecoration: (gx, gz, type, rotation, scale = 1) =>
    set((state) => ({
      decorations: [...state.decorations, { gx, gz, type, rotation, scale }],
    })),
  removeDecoration: (index) =>
    set((state) => ({
      decorations: state.decorations.filter((_, i) => i !== index),
    })),

  // UI
  showUI: true,
  toggleUI: () => set((state) => ({ showUI: !state.showUI })),
  showGhost: false,
  setShowGhost: (show) => set({ showGhost: show }),
  ghostPosition: null,
  setGhostPosition: (pos) => set({ ghostPosition: pos }),
  ghostValid: true,
  setGhostValid: (valid) => set({ ghostValid: valid }),

  // Persistence
  save: () => {
    const state = get();
    const data = {
      heightGrid: state.heightGrid.toJSON(),
      waterGrid: state.waterGrid.toJSON(),
      towers: state.towers,
      decorations: state.decorations,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save sandbox state:', e);
    }
  },

  load: () => {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (!json) return false;
      const data = JSON.parse(json);
      const { heightGrid, waterGrid } = get();
      heightGrid.data.set(JSON.parse(data.heightGrid));
      waterGrid.data.set(JSON.parse(data.waterGrid));
      set({
        towers: data.towers || [],
        decorations: data.decorations || [],
      });
      return true;
    } catch (e) {
      console.warn('Failed to load sandbox state:', e);
      return false;
    }
  },

  reset: () => {
    const { heightGrid, waterGrid } = get();
    heightGrid.reset();
    waterGrid.reset();
    set({
      towers: [],
      decorations: [],
    });
    localStorage.removeItem(STORAGE_KEY);
  },
}));
