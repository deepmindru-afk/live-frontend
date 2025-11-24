import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ClientSideRecordingProps {
  meetingId: string;
  userId: string;
  meetingName?: string;
  meetingStatus?: string;
  onRecordingStart?: () => void;
  onRecordingComplete?: (recordingUrl: string) => void;
  onError?: (error: string) => void;
}

const ClientSideRecording: React.FC<ClientSideRecordingProps> = ({
  meetingId,
  userId,
  meetingName,
  meetingStatus,
  onRecordingStart,
  onRecordingComplete,
  onError,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const uploadRecording = async (blob: Blob) => {
    setIsUploading(true);
    
    try {
      const fileName = `recording_${Date.now()}.webm`;
      const formData = new FormData();
      formData.append('recording', blob, fileName);
      formData.append('meetingId', meetingId);
      formData.append('userId', userId);
      formData.append('recordingName', meetingName || `Meeting_${meetingId}_${new Date().toISOString().split('T')[0]}`);

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007'}/recording-upload/client-recording`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setRecordingUrl(result.recordingId);
      onRecordingComplete?.(result.recordingId);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to upload recording');
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = useCallback(async () => {
    const isIOS = (() => {
      if (typeof navigator === 'undefined') {
        return false;
      }
      const platform = navigator?.platform || '';
      const userAgent = navigator?.userAgent || '';
      return /iP(ad|hone|od)/i.test(userAgent) || (platform === 'MacIntel' && (navigator?.maxTouchPoints || 0) > 1);
    })();

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      const message = isIOS
        ? 'iOS Safari에서는 브라우저 제한으로 인해 화면 녹화가 지원되지 않습니다. 데스크톱 또는 Android 브라우저를 이용해 주세요.'
        : '이 브라우저에서는 화면 녹화를 지원하지 않습니다. 최신 버전의 Chromium 기반 브라우저를 사용해 주세요.';
      onError?.(message);
      return;
    }

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
        // Wait a bit to ensure all chunks are collected
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create blob with proper MIME type
        const blob = new Blob(recordedChunksRef.current, {
          type: mimeType,
        });
        
        // For better seeking support, we'll let the backend convert to MP4
        // But ensure the WebM is properly finalized
        await uploadRecording(blob);
      };

      // Use smaller timeslice for better chunk handling, but not too small
      // This helps with proper metadata writing
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

  useEffect(() => {
    const handleExternalStop = (event: Event) => {
      if (!isRecording) {
        return;
      }

      const customEvent = event as CustomEvent<{ meetingId?: string }>;
      const targetMeetingId = customEvent?.detail?.meetingId;
      if (targetMeetingId && targetMeetingId !== meetingId) {
        return;
      }
      stopRecording();
    };

    window.addEventListener('hrde-stop-recording', handleExternalStop);
    return () => {
      window.removeEventListener('hrde-stop-recording', handleExternalStop);
    };
  }, [isRecording, meetingId, stopRecording]);

  React.useEffect(() => {
    if (meetingStatus === 'ENDED' && isRecording) {
      stopRecording();
    }
  }, [meetingStatus, isRecording, stopRecording]);

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
      title={isRecording ? 'Stop Recording' : 'Start Recording'}
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
