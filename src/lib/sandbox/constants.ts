/** Sandbox simulation constants - tuned for 128x128 grid at 0.25 units/cell = 32x32 world */

export const GRID_SIZE = 128;
export const CELL_SIZE = 0.25;
export const WORLD_SIZE = GRID_SIZE * CELL_SIZE; // 32
export const HALF_WORLD = WORLD_SIZE * 0.5; // 16

export const MAX_HEIGHT = 3.0;
export const WATER_THRESHOLD = 0.15;
export const WATER_LEVEL = 0.1;
export const SEA_LEVEL = 0.1;
export const WATER_EVAPORATION = 0.002;
export const WATER_DIFFUSION = 0.25;
export const WATER_STEPS_PER_TICK = 3;
export const WATER_SIMULATION_HZ = 20;
export const MAX_WATER_CATCH_UP_STEPS = 2;
export const WATER_RENDER_THRESHOLD = 0.02;
export const WATER_EVAPORATION_MARGIN = 0.05;

export const BRUSH_SIZES = [1, 2, 3, 4, 5, 6, 8] as const;
export const BRUSH_STRENGTH = 0.12;
export const FLATTEN_STRENGTH = 0.5;

export const TOWER_BASE_RADIUS = 1.2;
export const TOWER_HEIGHT = 2.8;
export const TOWER_FLAG_HEIGHT = 0.6;
export const TOWER_FLATNESS_THRESHOLD = 0.25;
export const MAX_TOWERS = 256;
export const MAX_DECORATIONS = 1024;
export const MAX_WATER_INSTANCES = GRID_SIZE * GRID_SIZE;

export const DECOR_SCALE = {
  palm: 1.0,
  rock: 0.5,
  shell: 0.15,
  starfish: 0.18,
} as const;

export const CAMERA_DEFAULTS = {
  fov: 45,
  position: [0, 22, 26] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  minDistance: 8,
  maxDistance: 50,
  minPolarAngle: 0.15,
  maxPolarAngle: Math.PI * 0.48, // ~86 degrees - top-down but slightly angled
} as const;

export const COLORS = {
  sand: 0xe8d5b7,
  sandDark: 0xd4c4a8,
  sandWet: 0xc8b898,
  water: 0x00b4d8,
  waterDeep: 0x0077b6,
  waterFoam: 0xe0f7fa,
  palmTrunk: 0x8d6e63,
  palmFrond: 0x2e7d32,
  rock: 0x78909c,
  flag: 0xd32f2f,
  shell: 0xf5f5dc,
  starfish: 0xe65100,
} as const;

export const SHADER_UNIFORMS = {
  water: {
    uTime: { value: 0 },
    uWaterColor: { value: COLORS.water },
    uDeepColor: { value: COLORS.waterDeep },
    uFoamColor: { value: COLORS.waterFoam },
  },
} as const;

export type ToolType = 'build' | 'dig' | 'flatten' | 'tower' | 'decorate';
export type DecorationType = 'palm' | 'rock' | 'shell' | 'starfish';

export const TOOLS: { type: ToolType; icon: string; label: string; cursor: string }[] = [
  { type: 'build', icon: '🏗', label: 'Build', cursor: 'crosshair' },
  { type: 'dig', icon: '🕳', label: 'Dig', cursor: 'crosshair' },
  { type: 'flatten', icon: '⏋', label: 'Flatten', cursor: 'crosshair' },
  { type: 'tower', icon: '🏰', label: 'Tower', cursor: 'pointer' },
  { type: 'decorate', icon: '🌴', label: 'Decorate', cursor: 'pointer' },
];

export const DECORATIONS: { type: DecorationType; icon: string; label: string }[] = [
  { type: 'palm', icon: '🌴', label: 'Palm' },
  { type: 'rock', icon: '🪨', label: 'Rock' },
  { type: 'shell', icon: '🐚', label: 'Shell' },
  { type: 'starfish', icon: '⭐', label: 'Starfish' },
];

export const SANDBOX_CONFIG = {
  WORLD_SIZE,
  GRID_SIZE,
  CELL_SIZE,
  MAX_HEIGHT,
  WATER_THRESHOLD,
  WATER_LEVEL,
  SEA_LEVEL,
  WATER_EVAPORATION,
  WATER_DIFFUSION,
  WATER_STEPS_PER_TICK,
  WATER_SIMULATION_HZ,
  WATER_RENDER_THRESHOLD,
  BRUSH_SIZES,
  BRUSH_STRENGTH,
  FLATTEN_STRENGTH,
  TOWER_BASE_RADIUS,
  TOWER_HEIGHT,
  TOWER_FLAG_HEIGHT,
  TOWER_FLATNESS_THRESHOLD,
  DECOR_SCALE,
  CAMERA_DEFAULTS,
  COLORS,
  TOOLS,
  DECORATIONS,
} as const;
