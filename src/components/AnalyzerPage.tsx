'use client';

import React, { useEffect, useCallback } from 'react';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import ToolBar from '@/components/ToolBar';
import VideoPlayer from '@/components/VideoPlayer';

export default function AnalyzerPage() {
  const {
    tracks, activeTrackId, viewMode, comparisonMode, isPlaying,
    setViewMode, setComparisonMode, addTrack, removeTrack,
    setActiveTrack, toggleFlip, toggleSkeleton, showAngles, setShowAngles,
    setCurrentFrame, setPlaying,
  } = useAnalysisStore();

  const activeTrack = tracks.find((t) => t.id === activeTrackId);
  const secondTrack = tracks.length > 1 ? tracks.find((t) => t.id !== activeTrackId) : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await addTrack(file);
    }
    e.target.value = '';
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (!activeTrack) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setCurrentFrame(activeTrack.id, activeTrack.currentFrame - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setCurrentFrame(activeTrack.id, activeTrack.currentFrame + 1);
        break;
      case ' ':
        e.preventDefault();
        setPlaying(!isPlaying);
        break;
      case 'Home':
        e.preventDefault();
        setCurrentFrame(activeTrack.id, 0);
        break;
      case 'End':
        e.preventDefault();
        setCurrentFrame(activeTrack.id, activeTrack.totalFrames);
        break;
    }
  }, [activeTrack, isPlaying, setCurrentFrame, setPlaying]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Frame-lock: in versus mode, keep both videos on the same frame
  useEffect(() => {
    if (viewMode !== 'versus' || !activeTrack || !secondTrack) return;
    const off = useAnalysisStore.subscribe((s) => {
      const trk = s.tracks.find((t) => t.id === activeTrackId);
      if (!trk) return;
      const other = s.tracks.find((t) => t.id !== activeTrackId);
      if (other && other.currentFrame !== trk.currentFrame) {
        s.setCurrentFrame(other.id, trk.currentFrame);
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeTrackId, activeTrack?.id, secondTrack?.id]);

  // Master versus playback: advance both tracks in lock-step
  useEffect(() => {
    if (viewMode !== 'versus' || !isPlaying || !activeTrack || !secondTrack) return;

    const fps = Math.max(activeTrack.fps, secondTrack.fps);
    let frameDuration = 1000 / (fps * useAnalysisStore.getState().playbackSpeed);
    let last = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      const store = useAnalysisStore.getState();
      if (!store.isPlaying) return;
      const speed = store.playbackSpeed;
      frameDuration = 1000 / (fps * speed);

      const dt = now - last;
      if (dt >= frameDuration) {
        last = now;
        const next = store.tracks.find((t) => t.id === activeTrackId);
        if (next) {
          const newFrame = next.currentFrame + 1;
          if (newFrame >= next.totalFrames) {
            store.setPlaying(false);
            return;
          }
          store.setCurrentFrame(next.id, newFrame);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isPlaying, activeTrack, secondTrack]);

  const syncOnContact = () => {
    if (!activeTrack || !secondTrack) return;
    const store = useAnalysisStore.getState();

    if (activeTrack.contactFrame !== null && secondTrack.contactFrame !== null) {
      // Jump both videos to their contact frames simultaneously
      store.setCurrentFrame(activeTrack.id, activeTrack.contactFrame);
      store.setCurrentFrame(secondTrack.id, secondTrack.contactFrame);
    } else {
      // Fallback: use time-based alignment at current position
      store.setCurrentFrame(activeTrack.id, activeTrack.currentFrame);
      store.setCurrentFrame(secondTrack.id, secondTrack.currentFrame);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tight">
              <span className="text-blue-500">SWING</span>
              <span className="text-white">ALYZATION</span>
            </h1>
            <span className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded font-mono">
              v1.0
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            {tracks.length >= 2 && (
              <div className="flex bg-gray-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('single')}
                  className={`px-3 py-1 text-xs rounded ${
                    viewMode === 'single' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Single
                </button>
                <button
                  onClick={() => setViewMode('versus')}
                  className={`px-3 py-1 text-xs rounded ${
                    viewMode === 'versus' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  ⚔ Versus
                </button>
              </div>
            )}

            <label className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold cursor-pointer transition-colors">
              + Upload Video
              <input
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {tracks.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-32">
            <div className="text-6xl mb-4">⚾</div>
            <h2 className="text-2xl font-bold mb-2">Drop Your Footage</h2>
            <p className="text-gray-400 text-sm mb-6 text-center max-w-md">
              Upload a video of your swing to begin frame-by-frame analysis.
              Add drawings, skeleton overlays, compare with pros, and more.
            </p>
            <label className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold cursor-pointer transition-all hover:scale-105">
              Select Video File(s)
              <input
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
            <p className="text-gray-600 text-xs mt-4">Supports MP4, WebM, MOV</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Track Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {tracks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTrack(t.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                    t.id === activeTrackId
                      ? 'bg-gray-700 text-white border border-blue-500/50'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{t.name}</span>
                  {t.contactFrame !== null && (
                    <span className="text-emerald-400 text-[10px]">⚡</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(t.id);
                    }}
                    className="text-gray-500 hover:text-red-400 ml-1"
                  >
                    ×
                  </button>
                </button>
              ))}
            </div>

            {/* Toolbar */}
            <ToolBar />

            {/* View Controls */}
            {activeTrack && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleFlip(activeTrack.id)}
                  className={`px-3 py-1 rounded text-xs font-mono ${
                    activeTrack.isFlipped ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  🪞 Flip {activeTrack.isFlipped ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() => toggleSkeleton(activeTrack.id)}
                  className={`px-3 py-1 rounded text-xs font-mono ${
                    activeTrack.showSkeleton ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  🦴 Skeleton {activeTrack.showSkeleton ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() => setShowAngles(!showAngles)}
                  className={`px-3 py-1 rounded text-xs font-mono ${
                    showAngles ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📐 Angles {showAngles ? 'ON' : 'OFF'}
                </button>

                {viewMode === 'versus' && secondTrack && (
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-xs text-gray-400 font-mono">COMPARE:</span>
                    <div className="flex bg-gray-800 rounded p-0.5">
                      <button
                        onClick={() => setComparisonMode('side-by-side')}
                        className={`px-2 py-0.5 text-xs rounded ${
                          comparisonMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'text-gray-400'
                        }`}
                      >
                        Side-by-Side
                      </button>
                      <button
                        onClick={() => setComparisonMode('ghost-overlay')}
                        className={`px-2 py-0.5 text-xs rounded ${
                          comparisonMode === 'ghost-overlay' ? 'bg-blue-600 text-white' : 'text-gray-400'
                        }`}
                      >
                        Ghost Blend
                      </button>
                    </div>
                    <button
                      onClick={syncOnContact}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white font-mono"
                      title="Jump both videos to their contact frames"
                    >
                      ⚡ Sync on Contact
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Video Display */}
            {activeTrack && viewMode === 'single' && (
              <div className="flex justify-center">
                <VideoPlayer track={activeTrack} />
              </div>
            )}

            {activeTrack && viewMode === 'versus' && secondTrack && comparisonMode === 'side-by-side' && (
              <div className="grid grid-cols-2 gap-4">
                <VideoPlayer track={activeTrack} />
                <VideoPlayer track={secondTrack} />
              </div>
            )}

            {activeTrack && viewMode === 'versus' && secondTrack && comparisonMode === 'ghost-overlay' && (
              <div className="flex flex-col items-center">
                <div className="relative w-[min(100%,700px)]">
                  <VideoPlayer track={activeTrack} />
                  <div className="absolute inset-0">
                    <VideoPlayer track={secondTrack} isGhost />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-gray-400 font-mono">GHOST OPACITY:</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={secondTrack.ghostOpacity * 100}
                    onChange={(e) =>
                      useAnalysisStore.getState().setGhostOpacity(
                        secondTrack.id,
                        parseInt(e.target.value) / 100
                      )
                    }
                    className="w-48 accent-blue-500"
                  />
                  <span className="text-xs text-gray-300 font-mono w-10">
                    {Math.round(secondTrack.ghostOpacity * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Keyboard Shortcuts */}
            <div className="mt-4 p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
              <details className="group">
                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 font-mono">
                  ⌨ Keyboard Shortcuts
                </summary>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-400">
                  <div><kbd className="bg-gray-800 px-1 rounded">←</kbd> / <kbd className="bg-gray-800 px-1 rounded">→</kbd> Step Frame</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">Space</kbd> Play/Pause</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">V</kbd> Select</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">F</kbd> Freehand</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">L</kbd> Line</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">C</kbd> Circle</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">A</kbd> Arrow</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">G</kbd> Angle</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">E</kbd> Eraser</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">Home</kbd> First Frame</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">End</kbd> Last Frame</div>
                  <div><kbd className="bg-gray-800 px-1 rounded">Dbl-Click</kbd> Add Label</div>
                </div>
              </details>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
