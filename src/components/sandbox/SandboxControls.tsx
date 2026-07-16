import { useState } from 'react';
import { useSandboxStore } from '../../store/sandboxStore';
import { TOOLS, DECORATIONS, SANDBOX_CONFIG } from '../../lib/sandbox/constants';
import type { ToolType, DecorationType } from '../../lib/sandbox/constants';

export default function SandboxControls() {
  const {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    decorType,
    setDecorType,
    showUI,
    toggleUI,
    reset,
    save,
    towers,
    decorations,
  } = useSandboxStore();

  const [collapsed, setCollapsed] = useState(false);

  if (!showUI) return null;

  return (
    <div className="sandbox-app__controls">
      {/* Collapse toggle */}
      <button
        className="sandbox-app__controls-toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand controls' : 'Collapse controls'}
      >
        {collapsed ? '☐' : '☰'}
      </button>

      {!collapsed && (
        <div className="sandbox-app__panel">
          {/* Tool Palette */}
          <div className="sandbox-app__control-group">
            <h4>Tools</h4>
            <div className="sandbox-app__tool-palette">
              {TOOLS.map((t) => (
                <button
                  key={t.type}
                  className={`sandbox-app__tool-button ${tool === t.type ? 'is-active' : ''}`}
                  onClick={() => setTool(t.type)}
                  title={t.label}
                >
                  <span className="sandbox-app__tool-icon">{t.icon}</span>
                  <span className="sandbox-app__tool-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brush Size (for build/dig/flatten) */}
          {(tool === 'build' || tool === 'dig' || tool === 'flatten') && (
            <div className="sandbox-app__control-group">
              <label>
                Brush Size: {SANDBOX_CONFIG.BRUSH_SIZES[brushSize]}
              </label>
              <input
                type="range"
                min="0"
                max={SANDBOX_CONFIG.BRUSH_SIZES.length - 1}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="sandbox-app__brush-slider"
              />
            </div>
          )}

          {/* Decoration Selector */}
          {tool === 'decorate' && (
            <div className="sandbox-app__control-group">
              <h4>Decorations</h4>
              <div className="sandbox-app__tool-palette">
                {DECORATIONS.map((d) => (
                  <button
                    key={d.type}
                    className={`sandbox-app__tool-button ${decorType === d.type ? 'is-active' : ''}`}
                    onClick={() => setDecorType(d.type)}
                    title={d.label}
                  >
                    <span className="sandbox-app__tool-icon">{d.icon}</span>
                    <span className="sandbox-app__tool-label">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="sandbox-app__control-group sandbox-app__stats">
            <div className="sandbox-app__stat">
              <span className="sandbox-app__stat-label">Towers</span>
              <span className="sandbox-app__stat-value">{towers.length}</span>
            </div>
            <div className="sandbox-app__stat">
              <span className="sandbox-app__stat-label">Decorations</span>
              <span className="sandbox-app__stat-value">{decorations.length}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="sandbox-app__control-group sandbox-app__actions">
            <button className="sandbox-app__action-button sandbox-app__action-button--secondary" onClick={save}>
              💾 Save
            </button>
            <button className="sandbox-app__action-button sandbox-app__action-button--danger" onClick={reset}>
              ↺ Reset
            </button>
            <button className="sandbox-app__action-button" onClick={toggleUI}>
              ✕ Hide UI
            </button>
          </div>

          {/* Help text */}
          <div className="sandbox-app__control-group sandbox-app__help">
            <p><kbd>LMB</kbd> Drag to sculpt</p>
            <p><kbd>RMB</kbd> Orbit camera</p>
            <p><kbd>Scroll</kbd> Zoom</p>
            <p><kbd>Shift+LMB</kbd> Pan</p>
          </div>
        </div>
      )}
    </div>
  );
}
