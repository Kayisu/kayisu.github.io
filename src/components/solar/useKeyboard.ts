import { useEffect, useRef } from 'react';

// Tracks which keys are currently held, for WASD camera movement.
// Mirrors script.js: ignores keystrokes while the planet search box is focused
// so typing a query doesn't fly the camera around.
export function useKeyboard() {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (document.activeElement?.id === 'planet-search') return;
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return keys;
}
