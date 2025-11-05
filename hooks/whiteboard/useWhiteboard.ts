import { useState, useCallback, useRef, useEffect } from 'react';
import { LocalVideoTrack, Track } from 'livekit-client';
import { LiveKitService } from '../../lib/livekit-service';

interface UseWhiteboardOptions {
  meetingId: string;
  isHost: boolean;
  liveKitService: LiveKitService | null;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamStopped?: () => void;
  onWhiteboardStateChange?: (isActive: boolean) => void;
}

interface UseWhiteboardReturn {
  isWhiteboardActive: boolean;
  isStreaming: boolean;
  startWhiteboard: (stream: MediaStream) => Promise<void>;
  stopWhiteboard: () => Promise<void>;
  clearWhiteboard: () => void;
  whiteboardStream: MediaStream | null;
  publishedTrack: LocalVideoTrack | null;
  error: string | null;
}

/**
 * useWhiteboard Hook
 * 
 * Main hook for managing whiteboard state and LiveKit streaming.
 * Handles:
 * - Whiteboard active/inactive state
 * - Canvas stream capture
 * - LiveKit track publishing
 * - Host permission checks
 */
export const useWhiteboard = ({
  meetingId,
  isHost,
  liveKitService,
  onStreamReady,
  onStreamStopped,
  onWhiteboardStateChange,
}: UseWhiteboardOptions): UseWhiteboardReturn => {
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [whiteboardStream, setWhiteboardStream] = useState<MediaStream | null>(null);
  const [publishedTrack, setPublishedTrack] = useState<LocalVideoTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (whiteboardStream) {
        whiteboardStream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      }
      if (publishedTrack && typeof publishedTrack.stop === 'function') {
        publishedTrack.stop();
      }
    };
  }, [whiteboardStream, publishedTrack]);

  const startWhiteboard = useCallback(async (stream: MediaStream) => {
    console.log('[useWhiteboard] startWhiteboard called with stream:', stream);
    
    if (!isHost) {
      console.warn('[useWhiteboard] Not host, cannot start whiteboard');
      setError('Only the host can use the whiteboard');
      return;
    }

    if (!liveKitService?.room) {
      console.error('[useWhiteboard] Not connected to LiveKit room');
      setError('Not connected to LiveKit room');
      return;
    }

    try {
      setError(null);
      
      // CRITICAL FIX: Unpublish any existing screen share track before publishing whiteboard
      // This prevents "publishing a second track with the same source" error
      const existingScreenSharePublications = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
        .filter(pub => {
          const source = pub.source || pub.track?.source;
          return source === Track.Source.ScreenShare;
        });
      
      console.log('[useWhiteboard] Found existing screen share publications:', existingScreenSharePublications.length);
      
      // Unpublish all existing screen share tracks
      for (const pub of existingScreenSharePublications) {
        if (pub.track) {
          console.log('[useWhiteboard] Unpublishing existing screen share track');
          try {
            await liveKitService.room.localParticipant.unpublishTrack(pub.track);
            // CRITICAL FIX: Check if track exists and has stop method before calling
            if (pub.track && typeof pub.track.stop === 'function') {
              pub.track.stop();
            }
          } catch (err: any) {
            console.warn('[useWhiteboard] Error unpublishing existing track:', err);
            // Continue anyway - track might already be stopped
          }
        }
      }
      
      // Wait a moment for unpublish to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get video track from stream
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track found in stream');
      }

      console.log('[useWhiteboard] Video track found:', videoTrack);

      // Create LocalVideoTrack from MediaStreamTrack
      // LocalVideoTrack can be created from an existing MediaStreamTrack
      const localVideoTrack = new LocalVideoTrack(videoTrack, {
        name: 'whiteboard',
        source: Track.Source.ScreenShare,
      });

      console.log('[useWhiteboard] Created LocalVideoTrack:', localVideoTrack);

      // Publish track to LiveKit room as screen share
      const publication = await liveKitService.room.localParticipant.publishTrack(localVideoTrack, {
        source: Track.Source.ScreenShare,
      });
      
      console.log('[useWhiteboard] Published track, publication:', publication);
      console.log('[useWhiteboard] Track ID:', publication?.trackSid);
      console.log('[useWhiteboard] Publication track:', publication?.track);

      console.log('[useWhiteboard] Published track to LiveKit');

      setWhiteboardStream(stream);
      setPublishedTrack(localVideoTrack);
      setIsWhiteboardActive(true);
      setIsStreaming(true);
      onStreamReady?.(stream);
      onWhiteboardStateChange?.(true);
      
    } catch (err: any) {
      console.error('[useWhiteboard] Failed to start whiteboard:', err);
      setError(err.message || 'Failed to start whiteboard');
      setIsWhiteboardActive(false);
      setIsStreaming(false);
      
      // Cleanup on error
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      }
    }
  }, [isHost, liveKitService, onStreamReady, onWhiteboardStateChange]);

  const stopWhiteboard = useCallback(async () => {
    try {
      // Stop LiveKit track
      if (liveKitService?.room && publishedTrack) {
        try {
          await liveKitService.room.localParticipant.unpublishTrack(publishedTrack);
        } catch (err: any) {
          console.warn('[useWhiteboard] Error unpublishing track:', err);
        }
        // CRITICAL FIX: Check if track exists and has stop method before calling
        if (publishedTrack && typeof publishedTrack.stop === 'function') {
          publishedTrack.stop();
        }
        setPublishedTrack(null);
      }

      // Stop stream tracks
      if (whiteboardStream) {
        whiteboardStream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
        setWhiteboardStream(null);
      }

      setIsWhiteboardActive(false);
      setIsStreaming(false);
      onStreamStopped?.();
      onWhiteboardStateChange?.(false);
    } catch (err: any) {
      console.error('[useWhiteboard] Failed to stop whiteboard:', err);
      setError(err.message || 'Failed to stop whiteboard');
      
      // Force cleanup even if unpublish fails
      setIsWhiteboardActive(false);
      setIsStreaming(false);
      if (whiteboardStream) {
        whiteboardStream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
        setWhiteboardStream(null);
      }
      if (publishedTrack && typeof publishedTrack.stop === 'function') {
        publishedTrack.stop();
        setPublishedTrack(null);
      }
    }
  }, [liveKitService, whiteboardStream, publishedTrack, onStreamStopped, onWhiteboardStateChange]);

  const clearWhiteboard = useCallback(() => {
    // This will be handled by the WhiteboardComponent
    // Excalidraw has its own clear functionality
  }, []);

  return {
    isWhiteboardActive,
    isStreaming,
    startWhiteboard,
    stopWhiteboard,
    clearWhiteboard,
    whiteboardStream,
    publishedTrack,
    error,
  };
};

export default useWhiteboard;

