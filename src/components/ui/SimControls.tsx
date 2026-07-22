import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { SolarBody, SolarCopy, SolarSpeed } from '../solar/types';
import { useSolarStore } from '../../store/solarStore';

interface SimControlsProps {
  bodies: SolarBody[];
  copy: SolarCopy;
}

interface SpeedOption {
  value: SolarSpeed;
  shortLabel: string;
  label: string;
}

function normaliseSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i');
}

export default function SimControls({ bodies, copy }: SimControlsProps) {
  const speed = useSolarStore((s) => s.speedMultiplier);
  const setSpeed = useSolarStore((s) => s.setSpeed);
  const select = useSolarStore((s) => s.select);
  const selected = useSolarStore((s) => s.selected);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const searchRegionRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const speeds: SpeedOption[] = [
    { value: 0, shortLabel: '0', label: copy.speedOptions.paused },
    { value: 0.5, shortLabel: '0.5×', label: copy.speedOptions.half },
    { value: 1, shortLabel: '1×', label: copy.speedOptions.normal },
    { value: 2, shortLabel: '2×', label: copy.speedOptions.double },
  ];

  const q = normaliseSearchText(query).trim();
  const matches = q
    ? bodies.filter((body) =>
        normaliseSearchText(`${body.label} ${body.name} ${body.type}`).includes(q),
      )
    : [];
  const showResults = open && q.length > 0;

  const choose = (body: SolarBody) => {
    inputRef.current?.focus({ preventScroll: true });
    select(body.name);
    setQuery('');
    setOpen(false);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setQuery('');
      setOpen(false);
    } else if (event.key === 'Enter' && matches[0]) {
      event.preventDefault();
      choose(matches[0]);
    }
  };

  return (
    <div className="solar-controls">
      <fieldset className="solar-speed">
        <legend className="solar-speed__label">{copy.speedLabel}</legend>
        <div className="solar-speed__buttons">
          {speeds.map((option) => (
            <button
              key={option.value}
              type="button"
              className="solar-speed__button"
              aria-label={option.label}
              aria-pressed={speed === option.value}
              title={option.label}
              onClick={() => setSpeed(option.value)}
            >
              {option.shortLabel}
            </button>
          ))}
        </div>
      </fieldset>

      <div
        ref={searchRegionRef}
        className="solar-search"
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <label className="solar-search__label" htmlFor={inputId}>
          {copy.searchLabel}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="solar-search__input"
          type="search"
          placeholder={copy.searchPlaceholder}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
        />
        {showResults && matches.length > 0 && (
          <ul className="solar-search__results">
            {matches.map((body) => (
              <li key={body.name}>
                <button
                  type="button"
                  className="solar-search__result"
                  aria-pressed={selected === body.name}
                  onClick={() => choose(body)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setOpen(false);
                      inputRef.current?.focus();
                    }
                  }}
                >
                  {body.label} · {body.type}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showResults && matches.length === 0 && (
          <p className="solar-search__empty" role="status">
            {copy.searchNoResults}
          </p>
        )}
      </div>

      <p className="solar-keyboard-help">{copy.keyboardHelp}</p>
    </div>
  );
}
