import { useRef, useCallback, useEffect, useState } from 'react';

interface UseCanvasCaptureReturn {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  captureStream: (fps?: number) => MediaStream | null;
  stopCapture: () => void;
  isCapturing: boolean;
}

/**
 * useCanvasCapture Hook
 * 
 * Hook for capturing canvas element as video stream.
 * Uses HTMLCanvasElement.captureStream() API.
 */
export const useCanvasCapture = (): UseCanvasCaptureReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureStream = useCallback((fps: number = 30): MediaStream | null => {
    if (!canvasRef.current) {
      console.warn('[useCanvasCapture] Canvas ref is not available');
      return null;
    }

    const canvas = canvasRef.current;

    // Check if captureStream is supported
    if (!canvas.captureStream) {
      console.error('[useCanvasCapture] captureStream API not supported');
      return null;
    }

    try {
      // Capture canvas as video stream
      const stream = canvas.captureStream(fps);
      streamRef.current = stream;
      setIsCapturing(true);
      
      return stream;
    } catch (error: any) {
      console.error('[useCanvasCapture] Failed to capture stream:', error);
      return null;
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsCapturing(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  return {
    canvasRef,
    captureStream,
    stopCapture,
    isCapturing,
  };
};

export default useCanvasCapture;

