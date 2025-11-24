import React, { useState, useRef, useCallback, useEffect } from 'react';
import { recordingStorage } from '../lib/recording-storage';

interface ClientSideRecordingProps {
  meetingId: string;
  userId: string;
  meetingName?: string;
  meetingStatus?: string;
  liveKitService?: any;
  onRecordingStart?: () => void;
  onRecordingComplete?: (recordingUrl: string) => void;
  onError?: (error: string) => void;
  onUploadStatusChange?: (isUploading: boolean) => void; // ✅ Notify parent about upload status
}

const ClientSideRecording: React.FC<ClientSideRecordingProps> = ({
  meetingId,
  userId,
  meetingName,
  meetingStatus,
  onRecordingStart,
  onRecordingComplete,
  onError,
  onUploadStatusChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIdRef = useRef<string | null>(null);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const isUploadingRef = useRef(false);

  /**
   * Upload recording with retry mechanism
   * Saves to IndexedDB first, then uploads, deletes after success
   */
  const uploadRecording = async (blob: Blob, storageId?: string): Promise<void> => {
    // Prevent multiple simultaneous uploads
    if (isUploadingRef.current) {
      console.warn('[Recording] Upload already in progress, skipping...');
      return;
    }

    isUploadingRef.current = true;
    setIsUploading(true);
    onUploadStatusChange?.(true); // ✅ Notify parent
    setUploadProgress('Saving recording locally...');

    let currentStorageId = storageId;

    try {
      // Step 1: Save to IndexedDB if not already saved
      if (!currentStorageId) {
        currentStorageId = await recordingStorage.saveRecording(
          blob,
          meetingId,
          userId,
          meetingName || `Meeting_${meetingId}_${new Date().toISOString().split('T')[0]}`
        );
        recordingIdRef.current = currentStorageId;
        console.log(`[Recording] ✅ Saved to IndexedDB: ${currentStorageId}`);
      }

      // Step 2: Update status to uploading
      await recordingStorage.updateRecordingStatus(currentStorageId, 'uploading', true);
      setUploadProgress('Uploading to server...');

      // Step 3: Upload to server with retry logic
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          uploadAbortControllerRef.current = new AbortController();
          const fileName = `recording_${Date.now()}.webm`;
          const formData = new FormData();
          formData.append('recording', blob, fileName);
          formData.append('meetingId', meetingId);
          formData.append('userId', userId);
          formData.append('recordingName', meetingName || `Meeting_${meetingId}_${new Date().toISOString().split('T')[0]}`);

          setUploadProgress(`Uploading to server... (Attempt ${attempt}/${maxRetries})`);

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007'}/recording-upload/client-recording`,
            {
              method: 'POST',
              body: formData,
              signal: uploadAbortControllerRef.current.signal,
            }
          );

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
          }

          const result = await response.json();
          
          // Step 4: Upload successful - delete from IndexedDB
          await recordingStorage.deleteRecording(currentStorageId);
          setUploadProgress('Upload complete!');
          console.log(`[Recording] ✅ Upload successful, deleted from IndexedDB: ${currentStorageId}`);

          setRecordingUrl(result.recordingId);
          onRecordingComplete?.(result.recordingId);
          
          isUploadingRef.current = false;
          setIsUploading(false);
          onUploadStatusChange?.(false); // ✅ Notify parent
          setUploadProgress('');
          return;

        } catch (error: any) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          // Don't retry if aborted (user navigated away)
          if (error.name === 'AbortError') {
            console.log('[Recording] Upload aborted');
            await recordingStorage.updateRecordingStatus(currentStorageId, 'pending', false);
            isUploadingRef.current = false;
            setIsUploading(false);
            onUploadStatusChange?.(false); // ✅ Notify parent
            setUploadProgress('');
            return;
          }

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
            console.warn(`[Recording] Upload attempt ${attempt} failed, retrying in ${delay}ms...`, error);
            setUploadProgress(`Upload failed, retrying... (${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All retries failed - mark as failed in IndexedDB
      await recordingStorage.updateRecordingStatus(currentStorageId, 'failed', false);
      setUploadProgress('Upload failed - saved locally for retry');
      console.error(`[Recording] ❌ All upload attempts failed:`, lastError);
      onError?.(lastError?.message || 'Failed to upload recording after multiple attempts. Recording saved locally.');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save/upload recording';
      console.error('[Recording] ❌ Error:', error);
      onError?.(errorMessage);
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
      onUploadStatusChange?.(false); // ✅ Notify parent
      uploadAbortControllerRef.current = null;
    }
  };

  /**
   * Upload using sendBeacon (for page unload scenarios)
   * Note: sendBeacon doesn't support FormData well, so we'll just mark it for retry
   */
  const uploadWithBeacon = (storageId: string): boolean => {
    try {
      // sendBeacon doesn't work well with FormData, so we'll just ensure
      // the recording is marked as pending for retry on next page load
      recordingStorage.updateRecordingStatus(storageId, 'pending', false).then(() => {
        console.log('[Recording] ✅ Marked recording for retry on next page load');
      }).catch(err => {
        console.error('[Recording] ❌ Failed to mark for retry:', err);
      });
      return true;
    } catch (error) {
      console.error('[Recording] ❌ sendBeacon preparation failed:', error);
    }
    return false;
  };

  const startRecording = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        } as MediaTrackConstraints,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });
      } catch (micError) {
        // Mic permission not available
      }

      const audioEls = document.querySelectorAll('audio');
      const participantAudioStream = new MediaStream();
      
      audioEls.forEach((audioEl) => {
        if (audioEl.srcObject) {
          const tracks = (audioEl.srcObject as MediaStream).getAudioTracks();
          tracks.forEach(track => {
            if (!track.muted) {
              participantAudioStream.addTrack(track);
            }
          });
        }
      });
      
      const combinedStream = new MediaStream();
      
      screenStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
      
      const allAudioTracks = [
        ...screenStream.getAudioTracks(),
        ...(micStream ? micStream.getAudioTracks() : []),
        ...participantAudioStream.getAudioTracks()
      ];
      
      allAudioTracks.forEach(track => {
        combinedStream.addTrack(track);
      });

      streamRef.current = combinedStream;

      let mimeType = 'video/webm';
      
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
        mimeType = 'video/mp4;codecs=h264,aac';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      }

      const options: any = {
        mimeType: mimeType,
        videoBitsPerSecond: 2000000,
        audioBitsPerSecond: 128000,
      };
      
      const mediaRecorder = new MediaRecorder(combinedStream, options);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          // Wait a bit to ensure all chunks are collected
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const blob = new Blob(recordedChunksRef.current, {
            type: mimeType,
          });

          console.log(`[Recording] 📦 Recording stopped, blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
          
          // ✅ CRITICAL FIX: Save to IndexedDB IMMEDIATELY (synchronously) before any async operations
          // This ensures recording is saved even if page unloads
          let storageId: string | undefined;
          try {
            storageId = await recordingStorage.saveRecording(
              blob,
              meetingId,
              userId,
              meetingName || `Meeting_${meetingId}_${new Date().toISOString().split('T')[0]}`
            );
            recordingIdRef.current = storageId;
            console.log(`[Recording] ✅ CRITICAL: Saved to IndexedDB BEFORE upload: ${storageId}`);
          } catch (saveError) {
            console.error('[Recording] ❌ Failed to save to IndexedDB:', saveError);
            // Continue anyway - try to upload directly
          }
          
          // Start upload (will use existing storageId if saved, or save again)
          uploadRecording(blob, storageId).catch(error => {
            console.error('[Recording] ❌ Upload error:', error);
          });
        } catch (error) {
          console.error('[Recording] ❌ Error in onstop handler:', error);
          // Try to save chunks directly if blob creation failed
          if (recordedChunksRef.current.length > 0) {
            try {
              const emergencyBlob = new Blob(recordedChunksRef.current, { type: mimeType });
              recordingStorage.saveRecording(
                emergencyBlob,
                meetingId,
                userId,
                meetingName || `Meeting_${meetingId}_${new Date().toISOString().split('T')[0]}`
              ).then(id => {
                console.log(`[Recording] ✅ Emergency save successful: ${id}`);
                recordingIdRef.current = id;
              }).catch(err => {
                console.error('[Recording] ❌ Emergency save failed:', err);
              });
            } catch (emergencyError) {
              console.error('[Recording] ❌ Emergency blob creation failed:', emergencyError);
            }
          }
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      onRecordingStart?.();

      combinedStream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to start recording');
    }
  }, [meetingId, userId, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setIsRecording(false);
    }
  }, [isRecording]);

  /**
   * Handle meeting end - wait for upload to complete before allowing redirect
   */
  React.useEffect(() => {
    if (meetingStatus === 'ENDED' && isRecording) {
      console.log('[Recording] Meeting ended, stopping recording...');
      stopRecording();
    }
  }, [meetingStatus, isRecording, stopRecording]);

  /**
   * Handle page unload - try to upload using sendBeacon if upload is in progress
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // ✅ FIX: Disable browser reload confirmation dialog
      // Recording is saved to IndexedDB, so reload is safe
      // Upload will retry automatically on next page load
      // Don't prevent reload - allow it without confirmation
      return;
    };

    const handlePageHide = () => {
      // If recording was stopped but upload hasn't completed, mark for retry
      if (recordingIdRef.current && !isUploadingRef.current) {
        recordingStorage.getRecording(recordingIdRef.current).then(metadata => {
          if (metadata && (metadata.status === 'pending' || metadata.status === 'uploading')) {
            console.log('[Recording] Page unloading, marking recording for retry...');
            uploadWithBeacon(recordingIdRef.current!);
          }
        }).catch(err => {
          console.error('[Recording] Failed to get recording for retry:', err);
        });
      }

      // Abort ongoing upload if any (but don't delete from IndexedDB)
      if (uploadAbortControllerRef.current) {
        uploadAbortControllerRef.current.abort();
        // Mark as pending for retry
        if (recordingIdRef.current) {
          recordingStorage.updateRecordingStatus(recordingIdRef.current, 'pending', false)
            .catch(err => console.error('[Recording] Failed to mark for retry:', err));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isUploading]);

  /**
   * Retry failed uploads on component mount
   */
  useEffect(() => {
    const retryFailedUploads = async () => {
      try {
        const failedRecordings = await recordingStorage.getFailedRecordings();
        const pendingRecordings = await recordingStorage.getPendingRecordings();
        
        const allRecordings = [...failedRecordings, ...pendingRecordings];
        
        if (allRecordings.length > 0) {
          console.log(`[Recording] 🔄 Found ${allRecordings.length} recordings to retry`);
          
          // Retry uploads for this meeting
          for (const recording of allRecordings) {
            if (recording.meetingId === meetingId && !isUploadingRef.current) {
              console.log(`[Recording] 🔄 Retrying upload: ${recording.id}`);
              uploadRecording(recording.blob, recording.id).catch(err => {
                console.error(`[Recording] Retry failed for ${recording.id}:`, err);
              });
            }
          }
        }
      } catch (error) {
        console.error('[Recording] Failed to retry uploads:', error);
      }
    };

    retryFailedUploads();
  }, [meetingId]);

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  }, [isRecording, isUploading, startRecording, stopRecording]);

  return (
    <button
      onClick={handleClick}
      onTouchEnd={handleClick}
      disabled={isUploading}
      title={
        isUploading 
          ? uploadProgress || 'Uploading recording...' 
          : isRecording 
          ? 'Stop Recording' 
          : 'Start Recording'
      }
      aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
      style={{
        width: isMobile ? '44px' : '48px',
        height: isMobile ? '44px' : '48px',
        padding: '0',
        backgroundColor: isRecording ? '#ef4444' : '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        cursor: isUploading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isRecording ? '0 4px 12px rgba(239, 68, 68, 0.4)' : '0 4px 12px rgba(59, 130, 246, 0.4)',
        position: 'relative',
        opacity: isUploading ? 0.6 : 1,
        zIndex: 1000,
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {isRecording ? (
        <>
          {/* Stop Recording Icon (Square) */}
          <svg 
            width={isMobile ? "20" : "24"} 
            height={isMobile ? "20" : "24"} 
            viewBox="0 0 24 24" 
            fill="none"
            style={{
              animation: 'pulse 1.5s infinite'
            }}
          >
            <rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>
          </svg>
          {/* Pulsing dot indicator */}
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '8px',
            height: '8px',
            backgroundColor: 'white',
            borderRadius: '50%',
            animation: 'pulse 1s infinite',
            pointerEvents: 'none'
          }}></div>
          {/* Upload progress text */}
          {isUploading && uploadProgress && (
            <div style={{
              position: 'absolute',
              bottom: '-30px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '11px',
              color: '#3b82f6',
              whiteSpace: 'nowrap',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 6px',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              zIndex: 1001
            }}>
              {uploadProgress}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Start Recording Icon (Record Circle) */}
          <svg 
            width={isMobile ? "20" : "24"} 
            height={isMobile ? "20" : "24"} 
            viewBox="0 0 24 24" 
            fill="none"
          >
            <circle cx="12" cy="12" r="8" fill="white"/>
            <circle cx="12" cy="12" r="3" fill="#3b82f6"/>
          </svg>
        </>
      )}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { 
            opacity: 1; 
            transform: scale(1);
          }
          50% { 
            opacity: 0.7; 
            transform: scale(1.1);
          }
        }
      `}</style>
    </button>
  );
};

export default ClientSideRecording;
