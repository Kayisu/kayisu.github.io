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
    <div className="sandbox-controls">
      {/* Collapse toggle */}
      <button
        className="sandbox-toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand controls' : 'Collapse controls'}
      >
        {collapsed ? '☐' : '☰'}
      </button>

      {!collapsed && (
        <div className="sandbox-panel">
          {/* Tool Palette */}
          <div className="control-group">
            <h4>Tools</h4>
            <div className="tool-palette">
              {TOOLS.map((t) => (
                <button
                  key={t.type}
                  className={`tool-btn ${tool === t.type ? 'active' : ''}`}
                  onClick={() => setTool(t.type)}
                  title={t.label}
                >
                  <span className="tool-icon">{t.icon}</span>
                  <span className="tool-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brush Size (for build/dig/flatten) */}
          {(tool === 'build' || tool === 'dig' || tool === 'flatten') && (
            <div className="control-group">
              <label>
                Brush Size: {SANDBOX_CONFIG.BRUSH_SIZES[brushSize]}
              </label>
              <input
                type="range"
                min="0"
                max={SANDBOX_CONFIG.BRUSH_SIZES.length - 1}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="brush-slider"
              />
            </div>
          )}

          {/* Decoration Selector */}
          {tool === 'decorate' && (
            <div className="control-group">
              <h4>Decorations</h4>
              <div className="tool-palette">
                {DECORATIONS.map((d) => (
                  <button
                    key={d.type}
                    className={`tool-btn ${decorType === d.type ? 'active' : ''}`}
                    onClick={() => setDecorType(d.type)}
                    title={d.label}
                  >
                    <span className="tool-icon">{d.icon}</span>
                    <span className="tool-label">{d.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="control-group stats">
<div className="stat">
              <span className="stat-label">Towers</span>
              <span className="stat-value">{towers.length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Decorations</span>
              <span className="stat-value">{decorations.length}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="control-group actions">
            <button className="action-btn secondary" onClick={save}>
              💾 Save
            </button>
            <button className="action-btn danger" onClick={reset}>
              ↺ Reset
            </button>
            <button className="action-btn" onClick={toggleUI}>
              ✕ Hide UI
            </button>
          </div>

          {/* Help text */}
          <div className="control-group help">
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