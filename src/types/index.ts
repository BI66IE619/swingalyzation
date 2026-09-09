export type DrawingTool = 'freehand' | 'line' | 'circle' | 'angle' | 'arrow' | 'select' | 'eraser' | 'none';

export type Point = { x: number; y: number };

export interface FreehandDrawing {
  type: 'freehand';
  points: Point[];
  color: string;
  lineWidth: number;
}

export interface LineDrawing {
  type: 'line';
  start: Point;
  end: Point;
  color: string;
  lineWidth: number;
}

export interface CircleDrawing {
  type: 'circle';
  center: Point;
  radius: number;
  color: string;
  lineWidth: number;
}

export interface AngleDrawing {
  type: 'angle';
  vertex: Point;
  arm1End: Point;
  arm2End: Point;
  color: string;
  lineWidth: number;
}

export interface ArrowDrawing {
  type: 'arrow';
  start: Point;
  end: Point;
  color: string;
  lineWidth: number;
}

export type Drawing = FreehandDrawing | LineDrawing | CircleDrawing | AngleDrawing | ArrowDrawing;

export interface Label {
  id: string;
  text: string;
  position: Point;
  color: string;
  fontSize: number;
}

export interface FrameData {
  drawings: Drawing[];
  labels: Label[];
}

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface AngleMeasurement {
  name: string;
  angle: number;
  joints: { a: PoseLandmark; b: PoseLandmark; c: PoseLandmark };
}

export type ComparisonMode = 'side-by-side' | 'ghost-overlay';
export type ViewMode = 'single' | 'versus';

export interface VideoTrack {
  id: string;
  name: string;
  file: File;
  url: string;
  fps: number;
  duration: number;
  currentFrame: number;
  totalFrames: number;
  frameData: Record<number, FrameData>;
  poseLandmarks: Record<number, PoseLandmark[]>;
  contactFrame: number | null;
  isFlipped: boolean;
  showSkeleton: boolean;
  ghostOpacity: number;
}

export interface AnalysisState {
  viewMode: ViewMode;
  comparisonMode: ComparisonMode;
  activeTrackId: string | null;
  tracks: VideoTrack[];
  activeTool: DrawingTool;
  activeColor: string;
  activeLineWidth: number;
  isPlaying: boolean;
  playbackSpeed: number;
  showAngles: boolean;
  selectedDrawingId: string | null;

  addTrack: (file: File) => Promise<void>;
  removeTrack: (id: string) => void;
  setActiveTrack: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setComparisonMode: (mode: ComparisonMode) => void;
  setActiveTool: (tool: DrawingTool) => void;
  setActiveColor: (color: string) => void;
  setActiveLineWidth: (width: number) => void;
  setCurrentFrame: (trackId: string, frame: number) => void;
  addDrawing: (trackId: string, frame: number, drawing: Drawing) => void;
  removeDrawing: (trackId: string, frame: number, drawingIndex: number) => void;
  addLabel: (trackId: string, frame: number, label: Label) => void;
  updateLabel: (trackId: string, frame: number, labelId: string, updates: Partial<Label>) => void;
  removeLabel: (trackId: string, frame: number, labelId: string) => void;
  setFps: (trackId: string, fps: number) => void;
  setContactFrame: (trackId: string, frame: number | null) => void;
  toggleFlip: (trackId: string) => void;
  toggleSkeleton: (trackId: string) => void;
  setPoseLandmarks: (trackId: string, frame: number, landmarks: PoseLandmark[]) => void;
  setGhostOpacity: (trackId: string, opacity: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  setShowAngles: (show: boolean) => void;
  setSelectedDrawingId: (id: string | null) => void;
}
