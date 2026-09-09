import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  AnalysisState,
  Drawing,
  Label,
  ViewMode,
  ComparisonMode,
  DrawingTool,
  PoseLandmark,
} from '@/types';

const FPS_OPTIONS = [24, 25, 30, 60, 120, 240];

export const useAnalysisStore = create<AnalysisState>((set) => ({
  viewMode: 'single',
  comparisonMode: 'side-by-side',
  activeTrackId: null,
  tracks: [],
  activeTool: 'none',
  activeColor: '#ff0000',
  activeLineWidth: 3,
  isPlaying: false,
  playbackSpeed: 1,
  showAngles: false,
  selectedDrawingId: null,

  addTrack: async (file: File) => {
    const id = uuidv4();
    const url = URL.createObjectURL(file);
    const track = {
      id,
      name: file.name,
      file,
      url,
      fps: 30,
      duration: 0,
      currentFrame: 0,
      totalFrames: 0,
      frameData: {} as Record<number, { drawings: Drawing[]; labels: Label[] }>,
      poseLandmarks: {} as Record<number, PoseLandmark[]>,
      contactFrame: null,
      isFlipped: false,
      showSkeleton: false,
      ghostOpacity: 0.5,
    };

    set((state) => ({
      tracks: [...state.tracks, track],
      activeTrackId: state.tracks.length === 0 ? id : state.activeTrackId,
      viewMode: state.tracks.length === 0 ? 'single' : state.viewMode,
    }));
  },

  removeTrack: (id: string) => {
    set((state) => {
      const track = state.tracks.find((t) => t.id === id);
      if (track) URL.revokeObjectURL(track.url);
      const newTracks = state.tracks.filter((t) => t.id !== id);
      return {
        tracks: newTracks,
        activeTrackId:
          state.activeTrackId === id
            ? newTracks.length > 0
              ? newTracks[0].id
              : null
            : state.activeTrackId,
        viewMode: newTracks.length < 2 ? 'single' : state.viewMode,
      };
    });
  },

  setActiveTrack: (id: string) => set({ activeTrackId: id }),
  setViewMode: (mode: ViewMode) => set({ viewMode: mode }),
  setComparisonMode: (mode: ComparisonMode) => set({ comparisonMode: mode }),
  setActiveTool: (tool: DrawingTool) => set({ activeTool: tool }),
  setActiveColor: (color: string) => set({ activeColor: color }),
  setActiveLineWidth: (width: number) => set({ activeLineWidth: width }),

  setCurrentFrame: (trackId: string, frame: number) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, currentFrame: Math.max(0, Math.min(frame, t.totalFrames)) } : t
      ),
    })),

  addDrawing: (trackId: string, frame: number, drawing: Drawing) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const existing = t.frameData[frame] || { drawings: [], labels: [] };
        return {
          ...t,
          frameData: {
            ...t.frameData,
            [frame]: {
              ...existing,
              drawings: [...existing.drawings, drawing],
            },
          },
        };
      }),
    })),

  removeDrawing: (trackId: string, frame: number, drawingIndex: number) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const existing = t.frameData[frame];
        if (!existing) return t;
        return {
          ...t,
          frameData: {
            ...t.frameData,
            [frame]: {
              ...existing,
              drawings: existing.drawings.filter((_, i) => i !== drawingIndex),
            },
          },
        };
      }),
    })),

  addLabel: (trackId: string, frame: number, label: Label) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const existing = t.frameData[frame] || { drawings: [], labels: [] };
        return {
          ...t,
          frameData: {
            ...t.frameData,
            [frame]: {
              ...existing,
              labels: [...existing.labels, label],
            },
          },
        };
      }),
    })),

  updateLabel: (trackId: string, frame: number, labelId: string, updates: Partial<Label>) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const existing = t.frameData[frame];
        if (!existing) return t;
        return {
          ...t,
          frameData: {
            ...t.frameData,
            [frame]: {
              ...existing,
              labels: existing.labels.map((label) =>
                label.id === labelId ? { ...label, ...updates } : label
              ),
            },
          },
        };
      }),
    })),

  removeLabel: (trackId: string, frame: number, labelId: string) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const existing = t.frameData[frame];
        if (!existing) return t;
        return {
          ...t,
          frameData: {
            ...t.frameData,
            [frame]: {
              ...existing,
              labels: existing.labels.filter((l) => l.id !== labelId),
            },
          },
        };
      }),
    })),

  setFps: (trackId: string, fps: number) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, fps, totalFrames: Math.floor(t.duration * fps) } : t
      ),
    })),

  setContactFrame: (trackId: string, frame: number | null) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, contactFrame: frame } : t
      ),
    })),

  toggleFlip: (trackId: string) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, isFlipped: !t.isFlipped } : t
      ),
    })),

  toggleSkeleton: (trackId: string) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, showSkeleton: !t.showSkeleton } : t
      ),
    })),

  setPoseLandmarks: (trackId: string, frame: number, landmarks: PoseLandmark[]) =>
    set((state) => ({
      tracks: state.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          poseLandmarks: {
            ...t.poseLandmarks,
            [frame]: landmarks,
          },
        };
      }),
    })),

  setGhostOpacity: (trackId: string, opacity: number) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, ghostOpacity: opacity } : t
      ),
    })),

  setPlaying: (playing: boolean) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
  setShowAngles: (show: boolean) => set({ showAngles: show }),
  setSelectedDrawingId: (id: string | null) => set({ selectedDrawingId: id }),
}));

export { FPS_OPTIONS };
