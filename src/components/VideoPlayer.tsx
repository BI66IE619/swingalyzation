'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useAnalysisStore, FPS_OPTIONS } from '@/store/useAnalysisStore';
import { VideoTrack } from '@/types';
import { drawFreehand, drawLine, drawCircle, drawAngle, drawArrow, drawSkeleton } from '@/utils/drawing';
import { detectCrackOfBat } from '@/utils/audioDetection';
import { usePoseEstimation } from '@/hooks/usePoseEstimation';

interface Props {
  track: VideoTrack;
  isGhost?: boolean;
}

function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export default function VideoPlayer({ track, isGhost = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 640, height: 360 });
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  const {
    activeTool, activeColor, activeLineWidth, isPlaying, playbackSpeed, showAngles,
    setCurrentFrame, addDrawing, addLabel, setFps, setContactFrame, removeDrawing,
  } = useAnalysisStore();

  const { isLoading: poseLoading, error: poseError } = usePoseEstimation({
    videoRef,
    trackId: track.id,
    enabled: track.showSkeleton,
    fps: track.fps,
    activeFrame: track.currentFrame,
  });

  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const currentFreehand = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoaded = () => {
      const dur = video.duration;
      const fps = track.fps;
      setDimensions({ width: video.videoWidth, height: video.videoHeight });

      useAnalysisStore.setState((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === track.id
            ? { ...t, duration: dur, totalFrames: Math.floor(dur * fps) }
            : t
        ),
      }));
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [track.id, track.fps]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isGhost) return;
    video.currentTime = track.currentFrame / track.fps;
  }, [track.currentFrame, track.fps, isGhost]);

  const startPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    let lastTime = performance.now();

    const loop = (now: number) => {
      const store = useAnalysisStore.getState();
      if (!store.isPlaying || store.viewMode === 'versus') return;

      const delta = now - lastTime;
      const frameDuration = 1000 / (track.fps * store.playbackSpeed);

      if (delta >= frameDuration) {
        lastTime = now;
        const nextFrame = store.tracks.find((t) => t.id === track.id);
        if (nextFrame) {
          const newFrame = nextFrame.currentFrame + 1;
          if (newFrame >= nextFrame.totalFrames) {
            store.setPlaying(false);
            return;
          }
          store.setCurrentFrame(track.id, newFrame);
          video.currentTime = newFrame / track.fps;
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [track.id, track.fps]);

  useEffect(() => {
    if (isPlaying && !isGhost) {
      startPlayback();
    } else {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, playbackSpeed, track.fps, isGhost]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const skeletonCanvas = skeletonCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    if (track.isFlipped) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    const drawFrame = track.frameData[track.currentFrame];
    if (drawFrame) {
      for (const drawing of drawFrame.drawings) {
        switch (drawing.type) {
          case 'freehand':
            drawFreehand(ctx, drawing.points, drawing.color, drawing.lineWidth);
            break;
          case 'line':
            drawLine(ctx, drawing.start, drawing.end, drawing.color, drawing.lineWidth);
            break;
          case 'circle':
            drawCircle(ctx, drawing.center, drawing.radius, drawing.color, drawing.lineWidth);
            break;
          case 'angle':
            drawAngle(ctx, drawing.vertex, drawing.arm1End, drawing.arm2End, drawing.color, drawing.lineWidth);
            break;
          case 'arrow':
            drawArrow(ctx, drawing.start, drawing.end, drawing.color, drawing.lineWidth);
            break;
        }
      }

      for (const label of drawFrame.labels) {
        ctx.fillStyle = label.color;
        ctx.font = `bold ${label.fontSize}px monospace`;
        const metrics = ctx.measureText(label.text);
        const padding = 4;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(
          label.position.x - padding,
          label.position.y - label.fontSize - padding,
          metrics.width + padding * 2,
          label.fontSize + padding * 2
        );

        ctx.fillStyle = label.color;
        ctx.fillText(label.text, label.position.x, label.position.y);
      }
    }

    ctx.restore();

    if (skeletonCanvas && track.showSkeleton) {
      skeletonCanvas.width = dimensions.width;
      skeletonCanvas.height = dimensions.height;
      const sCtx = skeletonCanvas.getContext('2d');
      if (sCtx) {
        sCtx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);
        const landmarks = track.poseLandmarks[track.currentFrame];
        if (landmarks) {
          sCtx.save();
          if (track.isFlipped) {
            sCtx.translate(skeletonCanvas.width, 0);
            sCtx.scale(-1, 1);
          }
          drawSkeleton(sCtx, landmarks, skeletonCanvas.width, skeletonCanvas.height, showAngles);
          sCtx.restore();
        }
      }
    }
  }, [track, dimensions, showAngles]);

  useEffect(() => {
    renderFrame();
  }, [renderFrame, track.currentFrame]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'none' || activeTool === 'select') return;
    isDragging.current = true;
    const coords = getCanvasCoords(e);
    dragStart.current = coords;

    if (activeTool === 'freehand') {
      currentFreehand.current = [coords];
    }

    if (activeTool === 'eraser') {
      const drawFrame = track.frameData[track.currentFrame];
      if (!drawFrame) return;
      const hit = drawFrame.drawings.findIndex((drawing) => {
        switch (drawing.type) {
          case 'freehand':
            return drawing.points.some(
              (pt) => Math.hypot(pt.x - coords.x, pt.y - coords.y) < 15
            );
          case 'line':
          case 'arrow':
            return (
              distToSegment(coords, drawing.start, drawing.end) < 15
            );
          case 'circle':
            return (
              Math.abs(Math.hypot(coords.x - drawing.center.x, coords.y - drawing.center.y) - drawing.radius) < 15
            );
          case 'angle':
            return (
              distToSegment(coords, drawing.vertex, drawing.arm1End) < 15 ||
              distToSegment(coords, drawing.vertex, drawing.arm2End) < 15
            );
        }
      });
      if (hit >= 0) {
        removeDrawing(track.id, track.currentFrame, hit);
      }
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const coords = getCanvasCoords(e);

    if (activeTool === 'freehand') {
      currentFreehand.current.push(coords);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderFrame();
          const points = currentFreehand.current;
          if (points.length >= 2) {
            drawFreehand(ctx, points, activeColor, activeLineWidth);
          }
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !dragStart.current) return;
    isDragging.current = false;
    const coords = getCanvasCoords(e);

    switch (activeTool) {
      case 'freehand':
        if (currentFreehand.current.length > 1) {
          addDrawing(track.id, track.currentFrame, {
            type: 'freehand',
            points: [...currentFreehand.current],
            color: activeColor,
            lineWidth: activeLineWidth,
          });
        }
        currentFreehand.current = [];
        break;

      case 'line':
        addDrawing(track.id, track.currentFrame, {
          type: 'line',
          start: dragStart.current,
          end: coords,
          color: activeColor,
          lineWidth: activeLineWidth,
        });
        break;

      case 'circle': {
        const radius = Math.hypot(
          coords.x - dragStart.current.x,
          coords.y - dragStart.current.y
        );
        addDrawing(track.id, track.currentFrame, {
          type: 'circle',
          center: dragStart.current,
          radius,
          color: activeColor,
          lineWidth: activeLineWidth,
        });
        break;
      }

      case 'arrow':
        addDrawing(track.id, track.currentFrame, {
          type: 'arrow',
          start: dragStart.current,
          end: coords,
          color: activeColor,
          lineWidth: activeLineWidth,
        });
        break;

      case 'angle': {
        const drawFrame = track.frameData[track.currentFrame];
        const lastLine = drawFrame?.drawings.findLast(
          (d) => d.type === 'line' || d.type === 'arrow'
        );
        if (lastLine) {
          const vertex = lastLine.type === 'line' ? lastLine.end : lastLine.end;
          addDrawing(track.id, track.currentFrame, {
            type: 'angle',
            vertex,
            arm1End: dragStart.current,
            arm2End: coords,
            color: activeColor,
            lineWidth: activeLineWidth,
          });
        } else {
          addDrawing(track.id, track.currentFrame, {
            type: 'line',
            start: dragStart.current,
            end: coords,
            color: activeColor,
            lineWidth: activeLineWidth,
          });
        }
        break;
      }
    }

    dragStart.current = null;
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'none' && activeTool !== 'select' && activeTool !== 'eraser') return;
    const coords = getCanvasCoords(e);
    const text = prompt('Enter label text:');
    if (text) {
      addLabel(track.id, track.currentFrame, {
        id: crypto.randomUUID(),
        text,
        position: coords,
        color: activeColor,
        fontSize: 16,
      });
    }
  };

  const handleFrameStep = (dir: number) => {
    const newFrame = track.currentFrame + dir;
    if (newFrame >= 0 && newFrame <= track.totalFrames) {
      setCurrentFrame(track.id, newFrame);
    }
  };

  const handleAudioSync = async () => {
    const video = videoRef.current;
    if (!video) return;
    setIsAnalyzingAudio(true);
    const frame = await detectCrackOfBat(video, track.fps, setAudioProgress);
    if (frame !== null) {
      setContactFrame(track.id, frame);
      setCurrentFrame(track.id, frame);
    }
    setIsAnalyzingAudio(false);
  };

  const jumpToContact = () => {
    if (track.contactFrame !== null) {
      setCurrentFrame(track.id, track.contactFrame);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${isGhost ? '' : 'flex flex-col items-center w-full'}`}>
      {!isGhost && (
        <div className="text-xs text-gray-400 mb-1 font-mono">
          {track.name} — Frame {track.currentFrame}/{track.totalFrames}
          {track.contactFrame !== null && (
            <span className="ml-2 text-emerald-400">
              [Contact: f{track.contactFrame}]
            </span>
          )}
        </div>
      )}

      <div className="relative" style={{ maxWidth: '100%', aspectRatio: `${dimensions.width}/${dimensions.height}`, background: 'black' }}>
        <video
          ref={videoRef}
          src={track.url}
          className="absolute inset-0 w-full h-full object-contain"
          style={{
            transform: track.isFlipped ? 'scaleX(-1)' : 'none',
            opacity: isGhost ? track.ghostOpacity : 1,
          }}
          muted
          playsInline
          crossOrigin="anonymous"
        />

        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain cursor-crosshair"
          style={{
            transform: track.isFlipped ? 'scaleX(-1)' : 'none',
            background: 'transparent',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { isDragging.current = false; }}
          onDoubleClick={handleDoubleClick}
        />

        {track.showSkeleton && (
          <canvas
            ref={skeletonCanvasRef}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{ transform: track.isFlipped ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {poseLoading && track.showSkeleton && (
          <div className="absolute top-2 left-2 bg-blue-600/80 text-white text-[10px] px-2 py-0.5 rounded font-mono animate-pulse">
            LOADING POSE MODEL...
          </div>
        )}
        {poseError && track.showSkeleton && (
          <div className="absolute top-2 left-2 bg-red-600/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">
            {poseError}
          </div>
        )}

        {isPlaying && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded font-mono animate-pulse">
            PLAYING
          </div>
        )}
      </div>

      {!isGhost && (
      <>
      {/* Frame Controls */}
      <div className="flex items-center gap-2 mt-2 w-full max-w-[700px]">
        <button
          onClick={() => setCurrentFrame(track.id, 0)}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
        >
          ⏮
        </button>
        <button
          onClick={() => handleFrameStep(-1)}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
          title="Previous Frame (←)"
        >
          ◀◀
        </button>
        <button
          onClick={() => {
            const store = useAnalysisStore.getState();
            store.setPlaying(!store.isPlaying);
          }}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-bold"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => handleFrameStep(1)}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
          title="Next Frame (→)"
        >
          ▶▶
        </button>
        <button
          onClick={() => setCurrentFrame(track.id, track.totalFrames)}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
        >
          ⏭
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={track.totalFrames}
            value={track.currentFrame}
            onChange={(e) => setCurrentFrame(track.id, parseInt(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <select
          value={track.fps}
          onChange={(e) => setFps(track.id, parseInt(e.target.value))}
          className="bg-gray-700 text-white text-xs rounded px-1 py-1"
        >
          {FPS_OPTIONS.map((fps) => (
            <option key={fps} value={fps}>{fps} FPS</option>
          ))}
        </select>
      </div>

      {/* Speed Controls */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-gray-400">Speed:</span>
        {[0.25, 0.5, 1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => useAnalysisStore.getState().setPlaybackSpeed(s)}
            className={`px-2 py-0.5 text-xs rounded ${
              playbackSpeed === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Contact Frame & Audio Sync */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleAudioSync}
          disabled={isAnalyzingAudio}
          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 rounded text-xs text-white font-mono"
        >
          {isAnalyzingAudio
            ? `Analyzing Audio... ${Math.round(audioProgress * 100)}%`
            : '🔊 Detect Crack of Bat'}
        </button>
        {track.contactFrame !== null && (
          <button
            onClick={jumpToContact}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white font-mono"
          >
            ⚡ Jump to Contact (f{track.contactFrame})
          </button>
        )}
        <button
          onClick={() => setContactFrame(track.id, track.currentFrame)}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white"
        >
          📍 Set Contact Here
        </button>
      </div>
      </>
      )}
    </div>
  );
}
