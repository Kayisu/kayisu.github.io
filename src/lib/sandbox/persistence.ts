import {
  DECORATIONS,
  GRID_SIZE,
  MAX_DECORATIONS,
  MAX_HEIGHT,
  MAX_TOWERS,
  type DecorationType,
} from './constants';

export interface SandboxTower {
  gx: number;
  gz: number;
  rotation: number;
}

export interface SandboxDecoration {
  gx: number;
  gz: number;
  type: DecorationType;
  rotation: number;
  scale: number;
}

export interface SandboxSaveV1 {
  version: 1;
  heights: number[];
  water: number[];
  towers: SandboxTower[];
  decorations: SandboxDecoration[];
}

export interface ParsedSandboxSave {
  data: SandboxSaveV1;
  source: 'v1' | 'legacy';
}

const GRID_CELL_COUNT = GRID_SIZE * GRID_SIZE;
const MAX_SAVED_WATER_DEPTH = 10;
const MIN_DECORATION_SCALE = 0.1;
const MAX_DECORATION_SCALE = 3;
const decorationTypes = new Set<DecorationType>(
  DECORATIONS.map((decoration) => decoration.type),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isGridCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) < GRID_SIZE;
}

function isDecorationType(value: unknown): value is DecorationType {
  return typeof value === 'string' && decorationTypes.has(value as DecorationType);
}

function isNumberGrid(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number[] {
  return Array.isArray(value)
    && value.length === GRID_CELL_COUNT
    && value.every(
      (entry) => isFiniteNumber(entry) && entry >= minimum && entry <= maximum,
    );
}

function isTower(value: unknown): value is SandboxTower {
  return isRecord(value)
    && isGridCoordinate(value.gx)
    && isGridCoordinate(value.gz)
    && isFiniteNumber(value.rotation);
}

function isDecoration(value: unknown): value is SandboxDecoration {
  return isRecord(value)
    && isGridCoordinate(value.gx)
    && isGridCoordinate(value.gz)
    && isDecorationType(value.type)
    && isFiniteNumber(value.rotation)
    && isFiniteNumber(value.scale)
    && value.scale >= MIN_DECORATION_SCALE
    && value.scale <= MAX_DECORATION_SCALE;
}

function validateCandidate(value: unknown): SandboxSaveV1 | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (!isNumberGrid(value.heights, 0, MAX_HEIGHT)) return null;
  if (!isNumberGrid(value.water, 0, MAX_SAVED_WATER_DEPTH)) return null;
  if (!Array.isArray(value.towers) || value.towers.length > MAX_TOWERS) return null;
  if (!value.towers.every(isTower)) return null;
  if (!Array.isArray(value.decorations) || value.decorations.length > MAX_DECORATIONS) return null;
  if (!value.decorations.every(isDecoration)) return null;

  return {
    version: 1,
    heights: [...value.heights],
    water: [...value.water],
    towers: value.towers.map((tower) => ({ ...tower })),
    decorations: value.decorations.map((decoration) => ({ ...decoration })),
  };
}

function parseLegacy(value: unknown): SandboxSaveV1 | null {
  if (!isRecord(value)) return null;
  if (typeof value.heightGrid !== 'string' || typeof value.waterGrid !== 'string') {
    return null;
  }

  try {
    return validateCandidate({
      version: 1,
      heights: JSON.parse(value.heightGrid),
      water: JSON.parse(value.waterGrid),
      towers: value.towers,
      decorations: value.decorations,
    });
  } catch {
    return null;
  }
}

export function parseSandboxSave(raw: string): ParsedSandboxSave | null {
  try {
    const value: unknown = JSON.parse(raw);
    const current = validateCandidate(value);
    if (current) return { data: current, source: 'v1' };

    const legacy = parseLegacy(value);
    if (legacy) return { data: legacy, source: 'legacy' };
    return null;
  } catch {
    return null;
  }
}
