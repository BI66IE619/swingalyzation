'use client';

import React from 'react';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { DrawingTool } from '@/types';

const TOOLS: { tool: DrawingTool; label: string; icon: string; shortcut: string }[] = [
  { tool: 'select', label: 'Select', icon: '↖', shortcut: 'V' },
  { tool: 'freehand', label: 'Freehand', icon: '✏️', shortcut: 'F' },
  { tool: 'line', label: 'Line', icon: '╱', shortcut: 'L' },
  { tool: 'circle', label: 'Circle', icon: '○', shortcut: 'C' },
  { tool: 'arrow', label: 'Arrow', icon: '→', shortcut: 'A' },
  { tool: 'angle', label: 'Angle', icon: '∠', shortcut: 'G' },
  { tool: 'eraser', label: 'Eraser', icon: '⌫', shortcut: 'E' },
  { tool: 'none', label: 'Pointer', icon: '🖱', shortcut: 'P' },
];

const COLORS = [
  '#ff0000', '#ff6600', '#ffcc00', '#00ff00', '#00ccff',
  '#0066ff', '#9933ff', '#ff00ff', '#ffffff', '#000000',
];

export default function ToolBar() {
  const {
    activeTool, activeColor, activeLineWidth,
    setActiveTool, setActiveColor, setActiveLineWidth,
  } = useAnalysisStore();

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const t = TOOLS.find((t) => t.shortcut.toLowerCase() === e.key.toLowerCase());
      if (t) setActiveTool(t.tool);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setActiveTool]);

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-900 border border-gray-700 rounded-lg">
      <span className="text-xs text-gray-400 font-mono mr-2">TOOLS:</span>
      {TOOLS.map(({ tool, label, icon, shortcut }) => (
        <button
          key={tool}
          onClick={() => setActiveTool(tool)}
          title={`${label} (${shortcut})`}
          className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-mono transition-colors ${
            activeTool === tool
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <span>{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}

      <div className="w-px h-6 bg-gray-700 mx-2" />

      <span className="text-xs text-gray-400 font-mono">COLOR:</span>
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => setActiveColor(color)}
          className={`w-6 h-6 rounded-full border-2 transition-transform ${
            activeColor === color ? 'border-white scale-125' : 'border-gray-600 hover:scale-110'
          }`}
          style={{ backgroundColor: color }}
        />
      ))}

      <div className="w-px h-6 bg-gray-700 mx-2" />

      <span className="text-xs text-gray-400 font-mono">SIZE:</span>
      {[1, 2, 3, 5, 8].map((w) => (
        <button
          key={w}
          onClick={() => setActiveLineWidth(w)}
          className={`flex items-center justify-center w-7 h-7 rounded text-xs ${
            activeLineWidth === w ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {w}
        </button>
      ))}
    </div>
  );
}
