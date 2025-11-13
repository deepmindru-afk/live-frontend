/**
 * Whiteboard Service
 * 
 * Service for whiteboard-related utilities and helpers.
 * Handles canvas stream management and LiveKit integration.
 */

export interface WhiteboardStreamOptions {
  fps?: number;
  width?: number;
  height?: number;
}

/**
 * Capture canvas element as MediaStream
 */
export const captureCanvasStream = (
  canvas: HTMLCanvasElement,
  options: WhiteboardStreamOptions = {}
): MediaStream | null => {
  const { fps = 30 } = options;

  if (!canvas) {
    console.error('[whiteboard-service] Canvas element is required');
    return null;
  }

  if (!canvas.captureStream) {
    console.error('[whiteboard-service] captureStream API not supported');
    return null;
  }

  try {
    return canvas.captureStream(fps);
  } catch (error: any) {
    console.error('[whiteboard-service] Failed to capture stream:', error);
    return null;
  }
};

/**
 * Stop all tracks in a MediaStream
 */
export const stopStream = (stream: MediaStream | null): void => {
  if (!stream) return;

  stream.getTracks().forEach(track => {
    track.stop();
  });
};

/**
 * Check if canvas capture is supported
 */
export const isCanvasCaptureSupported = (): boolean => {
  if (typeof HTMLCanvasElement === 'undefined') {
    return false;
  }

  const canvas = document.createElement('canvas');
  return typeof canvas.captureStream === 'function';
};

/**
 * Get optimal FPS for canvas capture
 */
export const getOptimalFPS = (): number => {
  // Default to 30fps for good balance of quality and performance
  // Can be adjusted based on canvas complexity
  return 30;
};




