/**
 * Canvas Capture Utilities
 * 
 * Low-level utilities for capturing canvas elements as video streams.
 */

export interface CanvasCaptureOptions {
  fps?: number;
  width?: number;
  height?: number;
}

/**
 * Capture a canvas element as a MediaStream
 */
export function captureCanvasAsStream(
  canvas: HTMLCanvasElement,
  options: CanvasCaptureOptions = {}
): MediaStream | null {
  const { fps = 30 } = options;

  if (!canvas) {
    console.warn('[canvas-capture] Canvas element is required');
    return null;
  }

  // Check browser support
  if (typeof canvas.captureStream !== 'function') {
    console.error('[canvas-capture] captureStream API not supported in this browser');
    return null;
  }

  try {
    const stream = canvas.captureStream(fps);
    return stream;
  } catch (error: any) {
    console.error('[canvas-capture] Failed to capture canvas stream:', error);
    return null;
  }
}

/**
 * Stop all tracks in a MediaStream
 */
export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;

  stream.getTracks().forEach(track => {
    track.stop();
    track.enabled = false;
  });
}

/**
 * Check if browser supports canvas capture
 */
export function isCanvasCaptureSupported(): boolean {
  if (typeof HTMLCanvasElement === 'undefined') {
    return false;
  }

  try {
    const testCanvas = document.createElement('canvas');
    return typeof testCanvas.captureStream === 'function';
  } catch {
    return false;
  }
}

/**
 * Get video track from MediaStream
 */
export function getVideoTrack(stream: MediaStream | null): MediaStreamTrack | null {
  if (!stream) return null;

  const videoTracks = stream.getVideoTracks();
  return videoTracks.length > 0 ? videoTracks[0] : null;
}

/**
 * Create a MediaStream from a video track
 */
export function createStreamFromTrack(track: MediaStreamTrack): MediaStream {
  return new MediaStream([track]);
}



