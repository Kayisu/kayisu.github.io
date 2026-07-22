import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ErrorInfo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import Scene from './Scene';
import CameraRig from './CameraRig';
import SimControls from '../ui/SimControls';
import InfoPanel from '../ui/InfoPanel';
import { useSolarStore } from '../../store/solarStore';
import { usePrefersReducedMotion, useSolarTheme } from './solarTheme';
import {
  SOLAR_PREVIEW_EVENT,
  formatSolarCopy,
  type SolarAppProps,
  type SolarBody,
  type SolarCopy,
  type SolarPreviewEventDetail,
} from './types';
import './solar.css';

export type { SolarAppProps, SolarBody, SolarCopy } from './types';

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

class SolarErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The localised, recoverable UI is intentional; reporting belongs to the host.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Fallback({ title, message, alert = false }: {
  title: string;
  message: string;
  alert?: boolean;
}) {
  return (
    <div className="solar-fallback" role={alert ? 'alert' : 'status'}>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

function LoadingIndicator({ label }: { label: string }) {
  const active = useProgress((state) => state.active);
  if (!active) return null;

  return (
    <div className="solar-loading" role="status" aria-live="polite">
      {label}
    </div>
  );
}

function ContextMonitor({ onLostChange }: { onLostChange: (lost: boolean) => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      onLostChange(true);
    };
    const onRestored = () => onLostChange(false);

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, onLostChange]);

  return null;
}

function SolarStatus({ bodies, copy }: { bodies: SolarBody[]; copy: SolarCopy }) {
  const hovered = useSolarStore((state) => state.hovered);
  const previewed = useSolarStore((state) => state.previewed);
  const activeName = hovered ?? previewed;
  const body = activeName ? bodies.find((candidate) => candidate.name === activeName) : undefined;

  if (!body) return null;
  return (
    <p className="solar-status" role="status" aria-live="polite">
      {formatSolarCopy(copy.previewLabel, { name: body.label, type: body.type })}
    </p>
  );
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const supported = Boolean(window.WebGLRenderingContext && context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return supported;
  } catch {
    return false;
  }
}

/**
 * Accepts explicit preview events and bridges focus/hover from ordinary static
 * links. Only stable names present in this island's body list reach the store.
 */
function useSolarPreviewBridge(bodies: SolarBody[]) {
  const validNames = useMemo(() => new Set(bodies.map((body) => body.name)), [bodies]);

  useEffect(() => {
    const setPreviewed = useSolarStore.getState().setPreviewed;
    const readName = (target: EventTarget | null): string | null | undefined => {
      if (!(target instanceof Element)) return undefined;
      const link = target.closest<HTMLElement>('[data-solar-body]');
      if (!link) return undefined;
      const name = link.dataset.solarBody;
      return name && validNames.has(name) ? name : undefined;
    };
    const dispatch = (name: string | null) => {
      const detail: SolarPreviewEventDetail = { name };
      window.dispatchEvent(new CustomEvent(SOLAR_PREVIEW_EVENT, { detail }));
    };
    const onPreview = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (!detail || typeof detail !== 'object' || !('name' in detail)) return;

      const name = (detail as { name?: unknown }).name;
      if (name === null) setPreviewed(null);
      else if (typeof name === 'string' && validNames.has(name)) setPreviewed(name);
    };
    let pointerName: string | null = null;
    let focusName: string | null = null;
    const publishActivePreview = () => dispatch(pointerName ?? focusName);
    const onPointerEnter = (event: Event) => {
      const name = readName(event.target);
      if (name) {
        pointerName = name;
        publishActivePreview();
      }
    };
    const onPointerLeave = (event: Event) => {
      const current = readName(event.target);
      if (!current) return;
      const next = readName((event as PointerEvent | FocusEvent).relatedTarget);
      if (next !== current) {
        pointerName = null;
        publishActivePreview();
      }
    };
    const onFocusEnter = (event: Event) => {
      const name = readName(event.target);
      if (name) {
        focusName = name;
        publishActivePreview();
      }
    };
    const onFocusLeave = (event: Event) => {
      const current = readName(event.target);
      if (!current) return;
      const next = readName((event as FocusEvent).relatedTarget);
      if (next !== current) {
        focusName = null;
        publishActivePreview();
      }
    };

    window.addEventListener(SOLAR_PREVIEW_EVENT, onPreview);
    document.addEventListener('pointerover', onPointerEnter);
    document.addEventListener('pointerout', onPointerLeave);
    document.addEventListener('focusin', onFocusEnter);
    document.addEventListener('focusout', onFocusLeave);

    return () => {
      window.removeEventListener(SOLAR_PREVIEW_EVENT, onPreview);
      document.removeEventListener('pointerover', onPointerEnter);
      document.removeEventListener('pointerout', onPointerLeave);
      document.removeEventListener('focusin', onFocusEnter);
      document.removeEventListener('focusout', onFocusLeave);
      setPreviewed(null);
    };
  }, [validNames]);
}

function SolarExperience({ mode, bodies, copy, rootId }: SolarAppProps & { rootId: string }) {
  const [contextLost, setContextLost] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const theme = useSolarTheme();
  const onContextLostChange = useCallback((lost: boolean) => setContextLost(lost), []);

  return (
    <>
      <Canvas
        className="solar-app__canvas"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        role="img"
        aria-label={copy.canvasLabel}
        camera={{ fov: 60, near: 0.1, far: 1000, position: [0, 15, 40] }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        fallback={(
          <Fallback title={copy.unavailableTitle} message={copy.unavailableMessage} />
        )}
        onPointerMissed={() => useSolarStore.getState().close()}
      >
        <Suspense fallback={null}>
          <Scene
            bodies={bodies}
            mode={mode}
            reducedMotion={reducedMotion}
            theme={theme}
          />
        </Suspense>
        <CameraRig
          bodies={bodies}
          mode={mode}
          reducedMotion={reducedMotion}
          rootId={rootId}
        />
        <ContextMonitor onLostChange={onContextLostChange} />
      </Canvas>

      <LoadingIndicator label={copy.loadingLabel} />
      {mode === 'explore' && <SimControls bodies={bodies} copy={copy} />}
      <InfoPanel bodies={bodies} copy={copy} mode={mode} />
      <SolarStatus bodies={bodies} copy={copy} />
      {contextLost && (
        <Fallback title={copy.contextLostTitle} message={copy.contextLostMessage} alert />
      )}
    </>
  );
}

export default function SolarApp({ mode, bodies, copy }: SolarAppProps) {
  const generatedId = useId().replace(/[^a-z0-9_-]/gi, '');
  const rootId = `solar-${mode}-${generatedId}`;
  const [webGLState, setWebGLState] = useState<'checking' | 'supported' | 'unsupported'>(
    'checking',
  );

  useSolarPreviewBridge(bodies);

  useEffect(() => {
    useSolarStore.getState().reset();
    setWebGLState(supportsWebGL() ? 'supported' : 'unsupported');
    return () => useSolarStore.getState().reset();
  }, []);

  const errorFallback = <Fallback title={copy.errorTitle} message={copy.errorMessage} alert />;

  return (
    <section
      id={rootId}
      className={`solar-app solar-app--${mode}`}
      data-solar-mode={mode}
      aria-label={copy.canvasLabel}
      tabIndex={mode === 'explore' ? 0 : -1}
      onPointerDown={(event: ReactPointerEvent<HTMLElement>) => {
        if (event.target instanceof HTMLCanvasElement) {
          event.currentTarget.focus({ preventScroll: true });
        }
      }}
      onPointerLeave={() => {
        useSolarStore.getState().setHovered(null);
      }}
    >
      {webGLState === 'checking' && (
        <div className="solar-loading" role="status" aria-live="polite">
          {copy.loadingLabel}
        </div>
      )}
      {webGLState === 'unsupported' && (
        <Fallback title={copy.unavailableTitle} message={copy.unavailableMessage} />
      )}
      {webGLState === 'supported' && (
        <SolarErrorBoundary fallback={errorFallback}>
          <SolarExperience mode={mode} bodies={bodies} copy={copy} rootId={rootId} />
        </SolarErrorBoundary>
      )}
    </section>
  );
}
