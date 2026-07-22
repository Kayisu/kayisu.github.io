import { useEffect, useState } from 'react';

export interface SolarTheme {
  orbit: string;
  halo: string;
  stars: string;
}

const FALLBACK_THEME: SolarTheme = {
  orbit: '#60717d',
  halo: '#82abc0',
  stars: '#edf0ec',
};

function readTheme(): SolarTheme {
  if (typeof document === 'undefined') return FALLBACK_THEME;

  const styles = getComputedStyle(document.documentElement);
  const read = (property: string, fallback: string) =>
    styles.getPropertyValue(property).trim() || fallback;

  return {
    orbit: read('--solar-orbit', FALLBACK_THEME.orbit),
    halo: read('--solar-halo', FALLBACK_THEME.halo),
    stars: read('--solar-stars', FALLBACK_THEME.stars),
  };
}

/** Tracks theme-token changes without replacing or remounting the WebGL canvas. */
export function useSolarTheme(): SolarTheme {
  const [theme, setTheme] = useState<SolarTheme>(readTheme);

  useEffect(() => {
    const refresh = () => setTheme(readTheme());
    const observer = new MutationObserver(refresh);

    refresh();
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    });
    window.addEventListener('kayisu:theme-change', refresh);

    return () => {
      observer.disconnect();
      window.removeEventListener('kayisu:theme-change', refresh);
    };
  }, []);

  return theme;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);

    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}
