import type { Body } from '../../data/planets';

export type SolarMode = 'hero' | 'explore';
export type SolarSpeed = 0 | 0.5 | 1 | 2;

/**
 * The fully serialisable body shape passed across Astro's island boundary.
 * `name` remains the stable English identifier used by routes and Three.js.
 */
export interface SolarBody extends Omit<Body, 'href' | 'type' | 'desc'> {
  /** Localised name presented to visitors. */
  label: string;
  /** Locale-aware route for this body. */
  href: string;
  /** Localised portfolio category label. */
  type: string;
  /** Localised category description. */
  desc: string;
}

export interface SolarSpeedCopy {
  paused: string;
  half: string;
  normal: string;
  double: string;
}

/** All visitor-facing copy used inside the React island. */
export interface SolarCopy {
  canvasLabel: string;
  loadingLabel: string;
  unavailableTitle: string;
  unavailableMessage: string;
  errorTitle: string;
  errorMessage: string;
  contextLostTitle: string;
  contextLostMessage: string;
  speedLabel: string;
  speedOptions: SolarSpeedCopy;
  searchLabel: string;
  searchPlaceholder: string;
  searchNoResults: string;
  closeLabel: string;
  typeLabel: string;
  /** Supports the `{name}` placeholder. */
  exploreLabel: string;
  /** Supports the `{name}` and `{type}` placeholders. */
  previewLabel: string;
  keyboardHelp: string;
}

export interface SolarAppProps {
  mode: SolarMode;
  bodies: SolarBody[];
  copy: SolarCopy;
}

export interface SolarPreviewEventDetail {
  name: string | null;
}

export const SOLAR_PREVIEW_EVENT = 'kayisu:solar-preview';

export function formatSolarCopy(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{([a-z]+)\}/gi, (match, key: string) => values[key] ?? match);
}
