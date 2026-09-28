import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ChatLine, ChatScript } from '../../data/chat';
import './chat.css';

interface Turn { node: string; asked?: string }
interface Props {
  script: ChatScript;
  /** Receives focus back when the panel closes. */
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
}

function Line({ line }: { line: ChatLine }) {
  if (!line.href) return <p>{line.text}</p>;
  const target = line.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return <p><a href={line.href} {...target}>{line.text}</a></p>;
}

export default function ChatPanel({ script, triggerRef, onClose }: Props) {
  const { ui, nodes } = script;
  const [turns, setTurns] = useState<Turn[]>([{ node: 'root' }]);
  const panel = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const firstOption = useRef<HTMLButtonElement>(null);
  const current = nodes[turns[turns.length - 1].node] ?? nodes.root;

  useEffect(() => { panel.current?.focus(); }, []);
  useEffect(() => {
    if (turns.length === 1) return;
    // Keep the newest question at the top of the log and the next choices under the keyboard.
    const latest = log.current?.lastElementChild;
    if (log.current && latest instanceof HTMLElement) log.current.scrollTop = latest.offsetTop;
    firstOption.current?.focus({ preventScroll: true });
  }, [turns]);

  const close = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return <section
    ref={panel}
    className="chat-panel"
    role="dialog"
    aria-labelledby="chat-title"
    aria-describedby="chat-greeting"
    tabIndex={-1}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}
  >
    <header>
      <h2 id="chat-title">{ui.title}</h2>
      <button type="button" onClick={close}>{ui.close}</button>
    </header>
    <div ref={log} className="chat-log" aria-live="polite">
      {turns.map((turn, index) => <div key={index} className="chat-turn" id={index === 0 ? 'chat-greeting' : undefined}>
        {turn.asked && <p className="chat-asked">{turn.asked}</p>}
        {(nodes[turn.node] ?? nodes.root).lines.map((line, lineIndex) => <Line key={lineIndex} line={line} />)}
      </div>)}
    </div>
    <div className="chat-options" role="group" aria-label={ui.options}>
      {current.options.map((option, index) => <button
        key={`${turns.length}-${index}`}
        ref={index === 0 ? firstOption : undefined}
        type="button"
        onClick={() => setTurns((previous) => [...previous, { node: option.target, asked: option.label }])}
      >{option.label}</button>)}
    </div>
    <input className="chat-input" type="text" disabled placeholder={ui.placeholder} aria-label={ui.inputLabel} />
  </section>;
}
