import { useEffect, useRef } from 'react';
import type { SolarBody, SolarCopy, SolarMode } from '../solar/types';
import { formatSolarCopy } from '../solar/types';
import { useSolarStore } from '../../store/solarStore';

interface InfoPanelProps {
  bodies: SolarBody[];
  copy: SolarCopy;
  mode: SolarMode;
}

export default function InfoPanel({ bodies, copy, mode }: InfoPanelProps) {
  const selected = useSolarStore((s) => s.selected);
  const close = useSolarStore((s) => s.close);
  const body = selected ? bodies.find((candidate) => candidate.name === selected) : undefined;
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  useEffect(() => {
    if (body) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !panelRef.current?.contains(active)) {
        returnFocusRef.current = active;
      }
      panelRef.current?.focus({ preventScroll: true });
      return;
    }

    const returnTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
  }, [body]);

  // Removing the panel also removes every hidden control from the tab order.
  if (!body) return null;

  const titleId = `solar-info-${mode}-${body.name}`;
  return (
    <aside
      ref={panelRef}
      className="solar-info"
      aria-labelledby={titleId}
      aria-live="polite"
      tabIndex={-1}
    >
      <button
        type="button"
        className="solar-info__close"
        aria-label={copy.closeLabel}
        title={copy.closeLabel}
        onClick={close}
      >
        <span aria-hidden="true">×</span>
      </button>
      <h2 id={titleId} className="solar-info__title">{body.label}</h2>
      <p className="solar-info__description">{body.desc}</p>
      <p className="solar-info__type">
        <strong>{copy.typeLabel}:</strong> {body.type}
      </p>
      <a className="solar-info__link" href={body.href}>
        {formatSolarCopy(copy.exploreLabel, { name: body.label })}
      </a>
    </aside>
  );
}
