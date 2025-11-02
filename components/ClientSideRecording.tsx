import React, { useState, useRef, useCallback } from 'react';

interface ClientSideRecordingProps {
  meetingId: string;
  userId: string;
  meetingName?: string;
  meetingStatus?: string;
  onRecordingComplete?: (recordingUrl: string) => void;
  onError?: (error: string) => void;
}

const ClientSideRecording: React.FC<ClientSideRecordingProps> = ({
  meetingId,
  userId,
  meetingName,
  meetingStatus,
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
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
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
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm;codecs=vp9,opus',
        });
        await uploadRecording(blob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

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

  React.useEffect(() => {
    if (meetingStatus === 'ENDED' && isRecording) {
      stopRecording();
    }
  }, [meetingStatus, isRecording, stopRecording]);

  // Detect mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isUploading}
      style={{
        padding: isMobile ? '10px 20px' : '12px 24px',
        backgroundColor: isRecording ? '#ef4444' : '#3b82f6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: isMobile ? '14px' : '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: isMobile ? '140px' : '160px',
        justifyContent: 'center',
      }}
    >
      {isRecording ? (
        <>
          <span style={{
            width: '10px',
            height: '10px',
            backgroundColor: 'white',
            borderRadius: '50%',
            animation: 'pulse 1s infinite'
          }}></span>
          <span>Stop Recording</span>
        </>
      ) : (
        <>
          <span>🎥</span>
          <span>Start Recording</span>
        </>
      )}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </button>
  );
};

export default ClientSideRecording;
