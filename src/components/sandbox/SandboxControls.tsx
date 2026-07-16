import { useSandboxStore } from '../../store/sandboxStore';
import { DECORATIONS, SANDBOX_CONFIG, TOOLS } from '../../lib/sandbox/constants';

export default function SandboxControls() {
  const tool = useSandboxStore((state) => state.tool);
  const setTool = useSandboxStore((state) => state.setTool);
  const brushSize = useSandboxStore((state) => state.brushSize);
  const setBrushSize = useSandboxStore((state) => state.setBrushSize);
  const decorType = useSandboxStore((state) => state.decorType);
  const setDecorType = useSandboxStore((state) => state.setDecorType);
  const showUI = useSandboxStore((state) => state.showUI);
  const toggleUI = useSandboxStore((state) => state.toggleUI);
  const reset = useSandboxStore((state) => state.reset);
  const save = useSandboxStore((state) => state.save);
  const towerCount = useSandboxStore((state) => state.towers.length);
  const decorationCount = useSandboxStore((state) => state.decorations.length);

  return (
    <div className="sandbox-app__controls">
      <button
        type="button"
        className="sandbox-app__controls-toggle"
        onClick={toggleUI}
        aria-controls="sandbox-control-panel"
        aria-expanded={showUI}
        aria-label={showUI ? 'Hide sandbox controls' : 'Show sandbox controls'}
      >
        <span aria-hidden="true">{showUI ? '×' : '☰'}</span>
      </button>

      {showUI && (
        <div id="sandbox-control-panel" className="sandbox-app__panel">
          <div className="sandbox-app__control-group">
            <h4>Tools</h4>
            <div className="sandbox-app__tool-palette">
              {TOOLS.map((availableTool) => (
                <button
                  type="button"
                  key={availableTool.type}
                  className={`sandbox-app__tool-button ${tool === availableTool.type ? 'is-active' : ''}`}
                  onClick={() => setTool(availableTool.type)}
                  aria-pressed={tool === availableTool.type}
                  title={availableTool.label}
                >
                  <span className="sandbox-app__tool-icon" aria-hidden="true">
                    {availableTool.icon}
                  </span>
                  <span className="sandbox-app__tool-label">{availableTool.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(tool === 'build' || tool === 'dig' || tool === 'flatten') && (
            <div className="sandbox-app__control-group">
              <label htmlFor="sandbox-brush-size">
                Brush Size: {SANDBOX_CONFIG.BRUSH_SIZES[brushSize]}
              </label>
              <input
                id="sandbox-brush-size"
                type="range"
                min="0"
                max={SANDBOX_CONFIG.BRUSH_SIZES.length - 1}
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="sandbox-app__brush-slider"
              />
            </div>
          )}

          {tool === 'decorate' && (
            <div className="sandbox-app__control-group">
              <h4>Decorations</h4>
              <div className="sandbox-app__tool-palette">
                {DECORATIONS.map((decoration) => (
                  <button
                    type="button"
                    key={decoration.type}
                    className={`sandbox-app__tool-button ${decorType === decoration.type ? 'is-active' : ''}`}
                    onClick={() => setDecorType(decoration.type)}
                    aria-pressed={decorType === decoration.type}
                    title={decoration.label}
                  >
                    <span className="sandbox-app__tool-icon" aria-hidden="true">
                      {decoration.icon}
                    </span>
                    <span className="sandbox-app__tool-label">{decoration.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sandbox-app__control-group sandbox-app__stats">
            <div className="sandbox-app__stat">
              <span className="sandbox-app__stat-label">Towers</span>
              <span className="sandbox-app__stat-value">{towerCount}</span>
            </div>
            <div className="sandbox-app__stat">
              <span className="sandbox-app__stat-label">Decorations</span>
              <span className="sandbox-app__stat-value">{decorationCount}</span>
            </div>
          </div>

          <div className="sandbox-app__control-group sandbox-app__actions">
            <button
              type="button"
              className="sandbox-app__action-button sandbox-app__action-button--secondary"
              onClick={save}
            >
              <span aria-hidden="true">💾</span> Save
            </button>
            <button
              type="button"
              className="sandbox-app__action-button sandbox-app__action-button--danger"
              onClick={reset}
            >
              <span aria-hidden="true">↺</span> Reset
            </button>
            <button
              type="button"
              className="sandbox-app__action-button"
              onClick={toggleUI}
            >
              Hide panel
            </button>
          </div>

          <div className="sandbox-app__control-group sandbox-app__help">
            <p><kbd>LMB</kbd> Drag to sculpt</p>
            <p><kbd>RMB</kbd> Orbit camera</p>
            <p><kbd>Scroll</kbd> Zoom</p>
            <p><kbd>MMB</kbd> Pan</p>
            <p>Touch sculpting is not yet verified.</p>
          </div>
        </div>
      )}
    </div>
  );
}
