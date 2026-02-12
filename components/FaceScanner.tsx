
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface FaceScannerProps {
  onDetect?: (descriptor: Float32Array) => void;
  autoDetect?: boolean;
  width?: number; // Desired width
  height?: number; // Desired height
  className?: string;
}

export default function FaceScanner({
  onDetect,
  autoDetect = true,
  width = 640,
  height = 480,
  className = '',
}: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const isDetectingRef = useRef(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // --- Effects ---

  // Effect to load models
  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = '/models';
      try {
        await Promise.all([
          // Switch to TinyFaceDetector for mobile performance
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (error: any) {
        console.error('Error loading models:', error);
        setGeneralError(`Failed to load AI models: ${error.message || error}`);
      }
    };
    loadModels();
  }, []);

  // Effect to start/stop video stream
  useEffect(() => {
    if (modelsLoaded && !generalError) {
      startVideo();
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(track => track.stop());
      }
      isDetectingRef.current = false;
    };
  }, [modelsLoaded, generalError, width, height]); // Re-run if width/height props change

  // --- Helper Functions ---

  const startVideo = () => {
    setCameraError(null);
    setGeneralError(null);
    
    // Lower resolution for mobile performance
    const constraints = {
        video: {
            facingMode: 'user',
            width: { ideal: 480 }, // Reduced from width prop to ensure speed
            height: { ideal: 640 }
        }
    };

    // Check if mediaDevices exists (it's often undefined in insecure HTTP contexts on mobile)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera API not available. This browser blocks camera access on HTTP. You must use HTTPS or localhost.");
        return;
    }

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((currentStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
        }
      })
      .catch((err) => {
        console.error('Error accessing webcam:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraError('Camera access denied. Please allow camera permissions.');
        } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found.');
        } else if (err.name === 'NotReadableError') {
             setCameraError('Camera is being used by another application.');
        } else if (err.name === 'OverconstrainedError') {
             setCameraError('Camera does not support required resolution.');
        } else if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
            setCameraError('Camera requires HTTPS or localhost. Security restriction.');
        } else {
            setCameraError(`Camera Error: ${err.message || 'Unable to access camera.'}`);
        }
      });
  };

  const handleVideoPlay = () => {
    if (isDetectingRef.current) return;
    isDetectingRef.current = true;
    detectLoop();
  };

  const checkBrightness = (video: HTMLVideoElement, box: faceapi.Box): boolean => {
    return true; // Skipping brightness check for performance improvement on mobile
  };

  const checkCentering = (box: faceapi.Box, videoWidth: number, videoHeight: number): boolean => {
     const faceCX = box.x + box.width / 2;
    const faceCY = box.y + box.height / 2;
    const videoCX = videoWidth / 2;
    const videoCY = videoHeight / 2;

    // More lenient centering for mobile
    const thresholdX = videoWidth * 0.35; 
    const thresholdY = videoHeight * 0.35; 

    return (
      Math.abs(faceCX - videoCX) < thresholdX &&
      Math.abs(faceCY - videoCY) < thresholdY
    );
  };

  // --- Detection Loop ---

  const detectLoop = async () => {
    if (!videoRef.current || !canvasRef.current || !isDetectingRef.current) return;

    if (videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      requestAnimationFrame(detectLoop);
      return;
    }

    // Wrap detection in try-catch to handle runtime errors
    try {
        const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
        
        // Use TinyFaceDetector
        const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                // Ensure we don't clear if context is lost
                context.clearRect(0, 0, dims.width, dims.height);

                if (detection) {
                    const resizedDetection = faceapi.resizeResults(detection, dims);
                    const box = resizedDetection.detection.box;

                    // Simplified quality checks
                    const isCentered = checkCentering(box, dims.width, dims.height);
                    let boxColor = '#ef4444'; 
                    const score = Math.round(detection.detection.score * 100);
                    setConfidence(score);

                    if (!isCentered) {
                        setFeedback({ message: 'Center your face', type: 'error' });
                    } else {
                        setFeedback({ message: 'Face Detected', type: 'success' });
                        boxColor = '#22c55e';
                    }

                    const drawBox = new faceapi.draw.DrawBox(box, {
                        label: ' ', // Clean box, score shown below
                        boxColor: boxColor,
                        lineWidth: 2
                    });
                    
                    // Force redraw
                    requestAnimationFrame(() => drawBox.draw(canvasRef.current!));

                    if (isCentered && onDetect) {
                        onDetect(resizedDetection.descriptor);
                    }
                } else {
                    setFeedback(null);
                    setConfidence(0);
                }
            }
        }
    } catch (err: any) {
      console.error("Detection error:", err);
      // Only set general error if it's critical, otherwise detection loop retries might fix it
      // setGeneralError(`Detection Failed: ${err.message}`); 
    }

    if (autoDetect && isDetectingRef.current) {
      // Throttle detection slightly to save battery if needed, but RAF is usually fine
       requestAnimationFrame(detectLoop);
    }
  };

  // --- Render ---

  return (
      <div className="relative w-full h-full flex items-center justify-center bg-black rounded-2xl overflow-hidden">
        {generalError ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 bg-gray-900/95 backdrop-blur-sm p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" suppressHydrationWarning />
                <p className="font-bold text-lg text-red-400 mb-2">System Error</p>
                <p className="text-gray-300 text-sm mb-4">{generalError}</p>
                 <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                    Reload Page
                </button>
            </div>
        ) : cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 bg-gray-900/95 backdrop-blur-sm p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" suppressHydrationWarning />
            <p className="font-bold text-lg text-red-400 mb-2">Camera Access Error</p>
            <p className="text-gray-300 text-sm mb-4">{cameraError}</p>
            
            <button 
                onClick={startVideo}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-colors mb-4"
            >
                Retry Permission
            </button>

            {cameraError.includes('Security restriction') && (
                <div className="text-xs text-gray-400 max-w-xs text-left bg-black/50 p-3 rounded border border-gray-700">
                    <p className="font-bold text-yellow-500 mb-1">How to fix on Mobile:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                        <li>Open <span className="font-mono text-white">chrome://flags</span></li>
                        <li>Search for <span className="font-mono text-white">insecure origins</span></li>
                        <li>Enable <strong>"Insecure origins treated as secure"</strong></li>
                        <li>Add your IP: <span className="font-mono text-white">{typeof window !== 'undefined' ? window.location.host : 'this IP'}</span></li>
                        <li>Relaunch Chrome</li>
                    </ol>
                </div>
            )}
            
             {cameraError.includes('API') && (
                <div className="text-xs text-gray-400 max-w-xs text-left bg-black/50 p-3 rounded border border-gray-700 mt-2">
                    <p className="font-bold text-yellow-500 mb-1">Try HTTPS Mode:</p>
                    <p>Ask the developer to run `npm run dev:https`</p>
                </div>
            )}
          </div>
        ) : !modelsLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20 bg-gray-900/90 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" suppressHydrationWarning />
            <p className="font-medium text-gray-300">Initializing AI Models...</p>
          </div>
        )}
        
        <video
          ref={videoRef}
          onPlay={handleVideoPlay}
          muted
          autoPlay
          playsInline
          className="w-full h-full object-cover" 
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
      </div>

      {/* External Status Feedback */}
      <div className="mt-4 flex justify-center min-h-[40px]">
        {feedback ? (
            <div className={`
                flex items-center space-x-2 px-4 py-2 rounded-lg shadow-sm transition-all duration-300
                ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}
            `}>
                {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="font-medium text-sm">{feedback.message}</span>
            </div>
        ) : (
             <div className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-50 text-gray-400 border border-gray-100">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-medium text-sm">Scanning...</span>
            </div>
        )}
      </div>
    </div>
  );
}
