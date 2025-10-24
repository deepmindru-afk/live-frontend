import React, { useState, useRef, useCallback } from 'react';

interface ClientSideRecordingProps {
  meetingId: string;
  userId: string;
  onRecordingComplete?: (recordingUrl: string) => void;
  onError?: (error: string) => void;
}

const ClientSideRecording: React.FC<ClientSideRecordingProps> = ({
  meetingId,
  userId,
  onRecordingComplete,
  onError,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Get screen and audio stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
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

      streamRef.current = stream;

      // Create MediaRecorder with MP4 support
      let mimeType = 'video/mp4;codecs=h264,aac';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9,opus';
        console.warn('MP4 not supported, falling back to WebM');
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2000000, // 2 Mbps
        audioBitsPerSecond: 128000,  // 128 kbps
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm;codecs=vp9,opus',
        });

        // Convert to MP4 and upload
        await uploadRecording(blob);
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

      // Handle stream end (user stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (error) {
      console.error('Error starting recording:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to start recording');
    }
  }, [meetingId, userId, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setIsRecording(false);
    }
  }, [isRecording]);

  const uploadRecording = async (blob: Blob) => {
    setIsUploading(true);
    
    try {
      // Determine file extension based on blob type
      const isMP4 = blob.type.includes('mp4');
      const fileExtension = isMP4 ? 'mp4' : 'webm';
      const fileName = `recording_${Date.now()}.${fileExtension}`;
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('recording', blob, fileName);
      formData.append('meetingId', meetingId);
      formData.append('userId', userId);
      formData.append('recordingName', `Meeting Recording ${new Date().toLocaleString()}`);

      console.log('Uploading recording to VOD server...', {
        meetingId,
        userId,
        fileSize: blob.size,
        fileName: fileName,
        mimeType: blob.type
      });

      const response = await fetch('https://api.hrdeedu.co.kr/recording-upload/client-recording', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setRecordingUrl(result.recordingUrl);
        onRecordingComplete?.(result.recordingUrl);
        console.log('✅ Recording uploaded successfully:', result.recordingUrl);
        
        // Clear the blob from memory immediately after upload
        blob = null as any;
      } else {
        throw new Error(result.message || 'Upload failed');
      }

    } catch (error) {
      console.error('❌ Upload error:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to upload recording');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="client-recording-controls">
      <div className="recording-status">
        {isRecording && (
          <div className="recording-indicator">
            <div className="recording-dot"></div>
            <span>Recording...</span>
          </div>
        )}
        {isUploading && (
          <div className="upload-indicator">
            <div className="upload-spinner"></div>
            <span>Uploading...</span>
          </div>
        )}
        {recordingUrl && (
          <div className="recording-complete">
            <span>✅ Recording saved!</span>
            <a 
              href={recordingUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="recording-link"
            >
              View Recording
            </a>
          </div>
        )}
      </div>

      <div className="recording-buttons">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isUploading}
            className="start-recording-btn"
          >
            🎥 Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="stop-recording-btn"
          >
            ⏹️ Stop Recording
          </button>
        )}
      </div>

      <style jsx>{`
        .client-recording-controls {
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: #f9f9f9;
          margin: 16px 0;
        }

        .recording-status {
          margin-bottom: 12px;
        }

        .recording-indicator {
          display: flex;
          align-items: center;
          color: #e74c3c;
          font-weight: bold;
        }

        .recording-dot {
          width: 12px;
          height: 12px;
          background: #e74c3c;
          border-radius: 50%;
          margin-right: 8px;
          animation: pulse 1s infinite;
        }

        .upload-indicator {
          display: flex;
          align-items: center;
          color: #3498db;
          font-weight: bold;
        }

        .upload-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #3498db;
          border-radius: 50%;
          margin-right: 8px;
          animation: spin 1s linear infinite;
        }

        .recording-complete {
          display: flex;
          align-items: center;
          color: #27ae60;
          font-weight: bold;
        }

        .recording-link {
          margin-left: 8px;
          color: #3498db;
          text-decoration: none;
        }

        .recording-link:hover {
          text-decoration: underline;
        }

        .recording-buttons {
          display: flex;
          gap: 8px;
        }

        .start-recording-btn,
        .stop-recording-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }

        .start-recording-btn {
          background: #e74c3c;
          color: white;
        }

        .start-recording-btn:hover:not(:disabled) {
          background: #c0392b;
        }

        .start-recording-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }

        .stop-recording-btn {
          background: #95a5a6;
          color: white;
        }

        .stop-recording-btn:hover {
          background: #7f8c8d;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ClientSideRecording;
