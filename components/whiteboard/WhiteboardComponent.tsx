import React, { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Excalidraw CSS is imported in _app.js

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => {
    const excalidraw = await import('@excalidraw/excalidraw');
    return excalidraw.Excalidraw;
  },
  { 
    ssr: false,
    loading: () => (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        backgroundColor: '#ffffff'
      }}>
        <p>Loading whiteboard...</p>
      </div>
    )
  }
);

// Import exportToCanvas separately
let exportToCanvas: any;
const loadExportToCanvas = async () => {
  if (!exportToCanvas) {
    const excalidraw = await import('@excalidraw/excalidraw');
    exportToCanvas = excalidraw.exportToCanvas;
  }
  return exportToCanvas;
};

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';

interface WhiteboardComponentProps {
  isActive: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamStopped?: () => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WhiteboardComponent
 * 
 * Main whiteboard component that wraps Excalidraw and handles canvas streaming.
 * This component will:
 * 1. Render Excalidraw whiteboard
 * 2. Capture canvas as video stream
 * 3. Provide stream to parent for LiveKit publishing
 * 
 * @param isActive - Whether whiteboard is currently active
 * @param onStreamReady - Callback when stream is ready
 * @param onStreamStopped - Callback when stream is stopped
 * @param onCanvasReady - Callback when canvas is ready for capture
 */
const WhiteboardComponent: React.FC<WhiteboardComponentProps> = ({
  isActive,
  onStreamReady,
  onStreamStopped,
  onCanvasReady,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Removed captureIntervalRef - no longer needed since we capture once

  // Removed captureCanvasStream function - now handled directly in useEffect
  // This is more efficient and avoids unnecessary function calls

  // Start streaming - wait for Excalidraw to be ready
  // IMPORTANT: captureStream() only needs to be called ONCE per canvas
  // The MediaStream automatically updates as the canvas changes - no interval needed!
  useEffect(() => {
    if (!isActive) {
      // Cleanup stream when whiteboard is deactivated
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
        setStream(null);
        setIsStreaming(false);
        onStreamStopped?.();
      }
      return;
    }

    // CRITICAL FIX: Prevent re-initialization if stream already exists
    if (stream && isStreaming) {
      console.log('[WhiteboardComponent] Stream already exists, skipping re-initialization');
      return;
    }

    // Wait for Excalidraw to initialize - check if ref is set
    let retryCount = 0;
    const maxRetries = 10; // Reduced to 5 seconds (10 * 500ms) for faster response
    let isMounted = true;
    
    const checkExcalidrawReady = async () => {
      // Check if component is still mounted
      if (!isMounted) return;
      
      // Check if Excalidraw ref is ready and container has canvas
      if (excalidrawRef.current && containerRef.current) {
        // Check if Excalidraw has rendered by looking for its canvas
        const canvasElement = containerRef.current.querySelector('canvas');
        
        if (canvasElement && canvasElement.captureStream) {
          console.log('[WhiteboardComponent] Excalidraw is ready, capturing stream once');
          
          // Capture stream ONCE - it will automatically update as canvas changes
          // No need for intervals or repeated captures!
          try {
            const mediaStream = canvasElement.captureStream(30); // 30fps
            
            if (mediaStream && mediaStream.active && isMounted) {
              setStream(mediaStream);
              setIsStreaming(true);
              onCanvasReady?.(canvasElement);
              onStreamReady?.(mediaStream);
              console.log('[WhiteboardComponent] Stream captured successfully');
              
              // CRITICAL FIX: Keep stream alive with periodic minimal updates
              // Canvas captureStream can stop producing frames when idle, causing black screen
              // Force periodic redraws to keep the stream active
              const videoTrack = mediaStream.getVideoTracks()[0];
              if (videoTrack && videoTrack.readyState === 'live') {
                // Clear any existing interval
                if (keepAliveIntervalRef.current) {
                  clearInterval(keepAliveIntervalRef.current);
                }
                
                // Force canvas redraw every 100ms to keep stream active
                // This is faster than the 10-second timeout that causes black screen
                keepAliveIntervalRef.current = setInterval(() => {
                  if (canvasElement && isMounted && isActive) {
                    const ctx = (canvasElement as HTMLCanvasElement).getContext('2d');
                    if (ctx && videoTrack.readyState === 'live') {
                      // Minimal operation to keep the stream active
                      // Read a single pixel and write it back (doesn't change visual output)
                      try {
                        const imageData = ctx.getImageData(0, 0, 1, 1);
                        ctx.putImageData(imageData, 0, 0);
                      } catch (e) {
                        // Ignore errors - canvas might be locked
                      }
                    } else if (videoTrack.readyState !== 'live') {
                      // Track ended, clear interval
                      if (keepAliveIntervalRef.current) {
                        clearInterval(keepAliveIntervalRef.current);
                        keepAliveIntervalRef.current = null;
                      }
                    }
                  }
                }, 100); // Every 100ms to prevent 10-second timeout
              }
            } else {
              throw new Error('Stream is not active');
            }
          } catch (error: any) {
            console.error('[WhiteboardComponent] Failed to capture stream:', error);
            if (retryCount < maxRetries && isMounted) {
              retryCount++;
              setTimeout(checkExcalidrawReady, 500);
            }
          }
        } else if (retryCount < maxRetries && isMounted) {
          // Canvas not ready yet, retry
          retryCount++;
          setTimeout(checkExcalidrawReady, 500);
        } else if (isMounted) {
          console.error('[WhiteboardComponent] Excalidraw canvas not found after max retries');
        }
      } else if (retryCount < maxRetries && isMounted) {
        // Refs not ready yet, retry
        retryCount++;
        setTimeout(checkExcalidrawReady, 500);
      } else if (isMounted) {
        console.error('[WhiteboardComponent] Excalidraw refs not available after max retries');
      }
    };

    // Start checking immediately (reduced delay for faster response)
    const initTimeout = setTimeout(checkExcalidrawReady, 200);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      
      // CRITICAL FIX: Clear keep-alive interval
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
      
      // Cleanup on unmount
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      }
    };
  }, [isActive]); // CRITICAL FIX: Remove onStreamReady, onStreamStopped, onCanvasReady from dependencies to prevent loops

  if (!isActive) {
    return null;
  }

  console.log('[WhiteboardComponent] Rendering, isActive:', isActive);

  return (
    <div
      ref={containerRef}
      className={`whiteboard-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: '800px',
        minHeight: '600px',
        ...style,
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '600px',
        minWidth: '800px'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}>
          <Excalidraw
            ref={(api) => {
              // Set ref when Excalidraw is ready
              if (api) {
                excalidrawRef.current = api;
                console.log('[WhiteboardComponent] Excalidraw ref set');
              }
            }}
            onChange={(elements, appState) => {
              // CRITICAL FIX: Force canvas redraw to keep stream active even when idle
              // This prevents the stream from going black after inactivity
              if (containerRef.current) {
                const canvasElement = containerRef.current.querySelector('canvas');
                if (canvasElement && stream) {
                  // Force a minimal redraw to keep the stream active
                  // The canvas.captureStream() will continue producing frames
                  const ctx = (canvasElement as HTMLCanvasElement).getContext('2d');
                  if (ctx) {
                    // Trigger a tiny redraw that doesn't affect the visual output
                    // This keeps the stream active
                    const imageData = ctx.getImageData(0, 0, 1, 1);
                    ctx.putImageData(imageData, 0, 0);
                  }
                }
              }
            }}
            // Disable view mode so host can draw
            viewModeEnabled={false}
            // Keep zen mode off to show all tools
            zenModeEnabled={false}
            // Grid mode disabled
            gridModeEnabled={false}
            // Enable all UI elements and tools
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                export: false,
              },
            }}
            // Ensure all tools are visible
            renderTopRightUI={() => null}
            renderCustomStats={() => null}
            // Make sure theme is light for better visibility
            theme="light"
          />
        </div>
      </div>
    </div>
  );
};

export default WhiteboardComponent;

