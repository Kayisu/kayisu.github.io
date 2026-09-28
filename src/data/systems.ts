/**
 * A star system groups projects around one star. Today there is a single system with the
 * owner at its centre. A later galaxy view can place several systems side by side; each keeps
 * its own orbits, and project URLs never include the system, so adding one breaks no links.
 */
export const SYSTEM_IDS = ['home'] as const;

export type SystemId = (typeof SYSTEM_IDS)[number];

export interface StarSystemData {
  id: SystemId;
  starColor: string;
  /** Position of the star in galaxy space; the single home system sits at the origin. */
  position: readonly [number, number, number];
}

export const DEFAULT_SYSTEM: SystemId = 'home';

export const SYSTEMS: Record<SystemId, StarSystemData> = {
  home: { id: 'home', starColor: '#f1c27d', position: [0, 0, 0] },
};
