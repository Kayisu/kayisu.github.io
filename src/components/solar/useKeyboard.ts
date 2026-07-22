import { useEffect, useRef } from 'react';

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd']);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, button, a[href]')
  );
}

/** Tracks WASD only while the explore solar shell owns focus. */
export function useKeyboard(enabled: boolean, rootId: string) {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!enabled || !MOVEMENT_KEYS.has(key) || isEditableTarget(e.target)) return;

      const root = document.getElementById(rootId);
      if (!root || !root.contains(document.activeElement)) return;

      e.preventDefault();
      keys.current[key] = true;
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (MOVEMENT_KEYS.has(key)) keys.current[key] = false;
    };
    const clear = () => {
      keys.current = {};
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [enabled, rootId]);

  return keys;
}
