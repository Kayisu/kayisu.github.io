import { useState } from 'react';
import { BODIES } from '../../data/planets';
import { useSolarStore } from '../../store/solarStore';

// Top-left simulation speed buttons + planet search, ported from script.js.
const SPEEDS = [
  { value: 0, icon: 'fa-pause', title: 'Pause' },
  { value: 1, icon: 'fa-play', title: 'Play (1x)' },
  { value: 5, icon: 'fa-forward', title: 'Fast (5x)' },
  { value: 20, icon: 'fa-fast-forward', title: 'Fastest (20x)' },
];

const BODY_NAMES = BODIES.map((b) => b.name); // sun + 9 planets

export default function SimControls() {
  const speed = useSolarStore((s) => s.speedMultiplier);
  const setSpeed = useSolarStore((s) => s.setSpeed);
  const select = useSolarStore((s) => s.select);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const q = query.toLowerCase().trim();
  const matches = q ? BODY_NAMES.filter((name) => name.includes(q)) : [];
  const showResults = focused && matches.length > 0;

  return (
    <div className="sim-controls">
      <div className="speed-controls">
        {SPEEDS.map((s) => (
          <button
            key={s.value}
            className={`speed-btn${speed === s.value ? ' active' : ''}`}
            title={s.title}
            onClick={() => setSpeed(s.value)}
          >
            <i className={`fas ${s.icon}`}></i>
          </button>
        ))}
      </div>

      <div className="search-container">
        <i className="fas fa-search search-icon"></i>
        <input
          id="planet-search"
          type="text"
          placeholder="Search a planet..."
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          // Delay so a result's onMouseDown fires before the list hides.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        <div className={`search-results${showResults ? '' : ' hidden'}`}>
          {matches.map((name) => (
            <div
              key={name}
              className="search-item"
              // mousedown fires before the input's blur
              onMouseDown={() => {
                select(name);
                setQuery('');
              }}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
