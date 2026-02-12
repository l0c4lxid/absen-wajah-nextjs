'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getFrameRect, QualityIssue } from '@/lib/biometric';

interface FaceScannerProps {
  onFrameAnalysis?: (analysis: FrameAnalysis) => void;
  active?: boolean;
  className?: string;
}

interface DetectionQuality {
  issues: QualityIssue[];
  brightness: number;
  score: number;
}

export interface FrameAnalysis {
  hasFace: boolean;
  descriptor: Float32Array | null;
  quality: DetectionQuality;
}

const MODELS_URL = '/models';
const DETECT_INTERVAL_MS = 120;

const SSD_OPTIONS = new faceapi.SsdMobilenetv1Options({
  minConfidence: 0.55,
  maxResults: 1,
});

function classifyQuality(args: {
  box: faceapi.Box;
  frame: { left: number; top: number; width: number; height: number };
  landmarks: faceapi.FaceLandmarks68;
  brightness: number;
  score: number;
}): DetectionQuality {
  const { box, frame, landmarks, brightness, score } = args;
  const issues: QualityIssue[] = [];

  const frameLeft = frame.left;
  const frameTop = frame.top;
  const frameRight = frame.left + frame.width;
  const frameBottom = frame.top + frame.height;

  if (box.x < frameLeft || box.y < frameTop || box.x + box.width > frameRight || box.y + box.height > frameBottom) {
    issues.push('outside-frame');
  }

  const relativeSize = box.width / frame.width;
  if (relativeSize < 0.34) {
    issues.push('too-small');
  }
  if (relativeSize > 0.86) {
    issues.push('too-large');
  }

  if (brightness < 62) {
    issues.push('too-dark');
  }
  if (brightness > 196) {
    issues.push('too-bright');
  }

  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();

  const eyeLeft = leftEye[0];
  const eyeRight = rightEye[3];
  const noseTip = nose[3];

  const eyeDy = eyeRight.y - eyeLeft.y;
  const eyeDx = eyeRight.x - eyeLeft.x;
  const rollDeg = Math.abs((Math.atan2(eyeDy, eyeDx) * 180) / Math.PI);

  const eyeCenterX = (eyeLeft.x + eyeRight.x) / 2;
  const halfEyeDistance = Math.max(1, Math.abs(eyeDx) / 2);
  const yawRatio = Math.abs(noseTip.x - eyeCenterX) / halfEyeDistance;

  if (rollDeg > 10 || yawRatio > 0.34) {
    issues.push('look-straight');
  }

  if (score < 55) {
    issues.push('no-face');
  }

  return { issues, brightness, score };
}

export default function FaceScanner({ onFrameAnalysis, active = true, className = '' }: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  const setupCanvasSize = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!video || !canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width;
    canvas.height = height;
  }, []);

  const stopLoop = useCallback(() => {
    if (loopTimerRef.current !== null) {
      window.clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    stopLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, [stopLoop]);

  const loadModels = useCallback(async () => {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);
      setModelsLoaded(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setModelError(`Gagal memuat model AI: ${message}`);
    }
  }, []);

  const startStream = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser tidak mendukung akses kamera.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCameraError(`Tidak bisa mengakses kamera: ${message}`);
    }
  }, []);

  const measureBrightness = useCallback((video: HTMLVideoElement, box: faceapi.Box) => {
    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement('canvas');
      sampleCanvasRef.current.width = 64;
      sampleCanvasRef.current.height = 64;
    }

    const sampleCanvas = sampleCanvasRef.current;
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) return 120;

    context.clearRect(0, 0, 64, 64);

    const sx = Math.max(0, Math.floor(box.x));
    const sy = Math.max(0, Math.floor(box.y));
    const sw = Math.max(1, Math.floor(box.width));
    const sh = Math.max(1, Math.floor(box.height));

    context.drawImage(video, sx, sy, sw, sh, 0, 0, 64, 64);
    const imageData = context.getImageData(0, 0, 64, 64).data;

    let sum = 0;
    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    return sum / (imageData.length / 4);
  }, []);

  const drawOverlay = useCallback((box: faceapi.Box | null, issueCount: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!box) return;

    context.lineWidth = 2;
    context.strokeStyle = issueCount === 0 ? '#34d399' : '#f87171';
    context.strokeRect(box.x, box.y, box.width, box.height);
  }, []);

  const analyzeFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !modelsLoaded) return;

    if (!active) {
      drawOverlay(null, 0);
      onFrameAnalysis?.({
        hasFace: false,
        descriptor: null,
        quality: { issues: ['no-face'], brightness: 0, score: 0 },
      });
      return;
    }

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const displaySize = { width: canvas.width, height: canvas.height };
    faceapi.matchDimensions(canvas, displaySize);

    const detection = await faceapi
      .detectSingleFace(video, SSD_OPTIONS)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      drawOverlay(null, 0);
      onFrameAnalysis?.({
        hasFace: false,
        descriptor: null,
        quality: { issues: ['no-face'], brightness: 0, score: 0 },
      });
      return;
    }

    const resized = faceapi.resizeResults(detection, displaySize);
    const frame = getFrameRect(displaySize.width, displaySize.height);
    const brightness = measureBrightness(video, resized.detection.box);
    const score = Math.round(resized.detection.score * 100);

    const quality = classifyQuality({
      box: resized.detection.box,
      frame,
      landmarks: resized.landmarks,
      brightness,
      score,
    });

    drawOverlay(resized.detection.box, quality.issues.length);

    onFrameAnalysis?.({
      hasFace: true,
      descriptor: resized.descriptor,
      quality,
    });
  }, [active, drawOverlay, measureBrightness, modelsLoaded, onFrameAnalysis]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    if (!modelsLoaded || modelError) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    startStream();
    return cleanupStream;
  }, [cleanupStream, modelError, modelsLoaded, startStream]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setupCanvasSize();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
      setupCanvasSize();
    }

    return () => observer.disconnect();
  }, [setupCanvasSize]);

  useEffect(() => {
    if (!modelsLoaded || cameraError || modelError) return;

    let activeLoop = true;

    const runLoop = async () => {
      if (!activeLoop) return;

      try {
        await analyzeFrame();
      } catch {
        // Keep loop alive for transient face-api errors.
      }

      loopTimerRef.current = window.setTimeout(runLoop, DETECT_INTERVAL_MS);
    };

    runLoop();

    return () => {
      activeLoop = false;
      stopLoop();
    };
  }, [analyzeFrame, cameraError, modelError, modelsLoaded, stopLoop]);

  const statusOverlay = useMemo(() => {
    if (modelError) {
      return (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-rose-400" />
          <p className="text-sm font-semibold text-rose-300">Model Error</p>
          <p className="mt-1 text-xs text-slate-300">{modelError}</p>
        </div>
      );
    }

    if (cameraError) {
      return (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-rose-400" />
          <p className="text-sm font-semibold text-rose-300">Camera Error</p>
          <p className="mt-1 text-xs text-slate-300">{cameraError}</p>
        </div>
      );
    }

    if (!modelsLoaded) {
      return (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80">
          <Loader2 className="mb-3 h-9 w-9 animate-spin text-cyan-300" />
          <p className="text-sm text-slate-200">Memuat model biometrik...</p>
        </div>
      );
    }

    return null;
  }, [cameraError, modelError, modelsLoaded]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-slate-950 ${className}`}>
      <div ref={containerRef} className="relative aspect-[4/3] w-full overflow-hidden bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        {statusOverlay}
      </div>
    </div>
  );
}
