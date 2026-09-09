'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { PoseLandmark as PoseLandmarkType } from '@/types';

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';

interface NormalizedLandmarkLike {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface PoseResults {
  poseLandmarks?: NormalizedLandmarkLike[];
}

interface PoseInstanceLike {
  setOptions(options: Record<string, unknown>): void;
  onResults(listener: (results: PoseResults) => void): void;
  initialize(): Promise<void>;
  send(inputs: { image: HTMLVideoElement }): Promise<void>;
  close(): Promise<void>;
}

interface PoseConstructor {
  new (config: { locateFile: (file: string) => string }): PoseInstanceLike;
}

declare global {
  interface Window {
    Pose: PoseConstructor;
  }
}

function loadMediaPipeScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Pose) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mediapipe-pose]'
    );
    if (existing) {
      existing.addEventListener(
        'load',
        () => resolve(),
        { once: true }
      );
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load MediaPipe script')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = `${MEDIAPIPE_CDN}pose.js`;
    script.setAttribute('data-mediapipe-pose', '');
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load MediaPipe script'));
    document.head.appendChild(script);
  });
}

interface PoseHookOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  trackId: string;
  enabled: boolean;
  fps: number;
  activeFrame: number;
}

export function usePoseEstimation({
  videoRef,
  trackId,
  enabled,
  fps,
  activeFrame,
}: PoseHookOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poseRef = useRef<PoseInstanceLike | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;

    let cancelled = false;

    let poseInstance: PoseInstanceLike | null = null;

    const setup = async () => {
      try {
        await loadMediaPipeScript();
        if (cancelled) return;

        poseInstance = new window.Pose({
          locateFile: (file: string) => `${MEDIAPIPE_CDN}${file}`,
        });
        poseRef.current = poseInstance;

        poseInstance.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        poseInstance.onResults((results: PoseResults) => {
          if (cancelled) return;
          setIsReady(true);
          setError(null);

          const store = useAnalysisStore.getState();
          const track = store.tracks.find((t) => t.id === trackId);
          if (!track || !video) return;

          const landmarks: PoseLandmarkType[] = results.poseLandmarks
            ? results.poseLandmarks.map((lm) => ({
                x: lm.x,
                y: lm.y,
                z: lm.z,
                visibility: lm.visibility,
              }))
            : [];

          const currentFrame = Math.floor(video.currentTime * fps);
          if (landmarks.length > 0 && currentFrame >= 0) {
            store.setPoseLandmarks(trackId, currentFrame, landmarks);
          }
          processingRef.current = false;
        });

        poseInstance.initialize().catch((err: unknown) => {
          if (!cancelled) {
            console.error('Pose init failed:', err);
            setError('Failed to initialize pose model.');
            setIsReady(false);
          }
        });
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('MediaPipe load failed:', err);
          setError('Failed to load pose model. Check your connection.');
          setIsReady(false);
        }
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (poseInstance) {
        poseInstance.close();
      }
      poseRef.current = null;
      processingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trackId, fps]);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video || !poseRef.current) return;
    if (processingRef.current) return;
    setIsLoading(true);

    processingRef.current = true;
    const run = async () => {
      try {
        await poseRef.current!.send({ image: video });
        setIsLoading(false);
      } catch (err: unknown) {
        console.error('Pose send failed:', err);
        processingRef.current = false;
        setIsLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeFrame]);

  return { isLoading, isReady, error };
}