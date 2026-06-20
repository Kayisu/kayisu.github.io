import { useRef } from 'react';
import { getBody } from '../../data/planets';
import { useSolarStore } from '../../store/solarStore';

// The top-right info panel. Mirrors the original #planet-info-panel: shows the
// selected body's name/desc/type, an "Explore" link to its dedicated page, and
// a close button that also stops the camera follow. Stays mounted and toggles
// the `hidden` class so the CSS slide/fade transition runs.
export default function InfoPanel() {
  const selected = useSolarStore((s) => s.selected);
  const close = useSolarStore((s) => s.close);

  const body = selected ? getBody(selected) : null;

  // Keep the last body's content during the fade-out so text doesn't vanish
  // before the panel finishes sliding away.
  const lastBody = useRef(body);
  if (body) lastBody.current = body;
  const shown = body ?? lastBody.current;

  return (
    <div className={`planet-info-panel${body ? '' : ' hidden'}`}>
      <button className="close-btn" aria-label="Close" onClick={close}>
        <i className="fas fa-times"></i>
      </button>
      <h2 className="planet-name">{shown?.name ?? ''}</h2>
      <p className="planet-desc">{shown?.desc ?? ''}</p>
      <div className="planet-stats">
        <div className="stat">
          <span className="label">Type:</span> {shown?.type ?? ''}
        </div>
      </div>
      {shown && (
        <a className="explore-btn" href={shown.href}>
          Explore {shown.name}
        </a>
      )}
    </div>
  );
}
