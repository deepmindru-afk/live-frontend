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
  const [hasAudio, setHasAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isUploadingRef = useRef(false);
  const lastSaveTimeRef = useRef<number>(0);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Upload deduplication
  const uploadSessionIdRef = useRef<string | null>(null);
  const isUploadInProgressRef = useRef(false);
  const uploadedChunksHashRef = useRef<string | null>(null);

  // Debug function to check supported codecs
  const checkSupportedCodecs = () => {
    const codecs = [
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    
    console.log('🎥 Supported codecs:');
    codecs.forEach(codec => {
      const supported = MediaRecorder.isTypeSupported(codec);
      console.log(`${supported ? '✅' : '❌'} ${codec}`);
    });
  };

  // Generate hash for chunks to detect duplicates
  const generateChunksHash = async (chunks: Blob[]): Promise<string> => {
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const firstChunkSize = chunks[0]?.size || 0;
    const lastChunkSize = chunks[chunks.length - 1]?.size || 0;
    const chunkCount = chunks.length;
    
    // Create a simple hash based on chunks metadata
    const hashString = `${totalSize}-${firstChunkSize}-${lastChunkSize}-${chunkCount}`;
    
    // Use Web Crypto API for better hashing if available
    if (window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(hashString);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (error) {
        console.warn('Crypto API not available, using simple hash');
      }
    }
    
    // Fallback to simple hash
    return btoa(hashString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  };

  const startRecording = useCallback(async () => {
    try {
      // Check supported codecs
      checkSupportedCodecs();
      
      // Get screen capture with audio
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

      // Get microphone audio as backup
      let micStream = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });
        console.log('🎤 Microphone audio captured');
      } catch (micError) {
        console.warn('⚠️ Could not access microphone:', micError);
      }

      // Combine screen and microphone audio
      const stream = new MediaStream();
      
      // Add video tracks from screen capture
      screenStream.getVideoTracks().forEach(track => {
        stream.addTrack(track);
        console.log('📹 Added video track:', track.label);
      });
      
      // Add audio tracks (prefer screen audio, fallback to mic)
      const audioTracks = screenStream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks.forEach(track => {
          stream.addTrack(track);
          console.log('🔊 Added screen audio track:', track.label);
        });
      } else if (micStream) {
        micStream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
          console.log('🎤 Added microphone audio track:', track.label);
        });
      } else {
        console.warn('⚠️ No audio tracks available');
      }

      console.log(`🎬 Stream created with ${stream.getVideoTracks().length} video tracks and ${stream.getAudioTracks().length} audio tracks`);

      streamRef.current = stream;

      // Create MediaRecorder with audio support, try multiple codecs
      let mimeType = 'video/mp4;codecs=h264,aac';
      
      // Check if we have audio tracks and adjust codec accordingly
      const hasAudioTracks = stream.getAudioTracks().length > 0;
      setHasAudio(hasAudioTracks);
      console.log(`🎵 Audio available: ${hasAudioTracks ? 'YES' : 'NO'}`);
      
      if (hasAudioTracks) {
        // Try audio-enabled codecs first
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac')) {
          mimeType = 'video/mp4;codecs=h264,aac';
          console.log('✅ Using MP4 with H.264 + AAC audio');
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          mimeType = 'video/webm;codecs=vp9,opus';
          console.log('✅ Using WebM with VP9 + Opus audio');
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          mimeType = 'video/webm;codecs=vp8,opus';
          console.log('✅ Using WebM with VP8 + Opus audio');
        } else {
          mimeType = 'video/webm';
          console.log('⚠️ Using basic WebM (audio may not work)');
        }
      } else {
        // No audio, use video-only codecs
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
          mimeType = 'video/mp4;codecs=h264';
          console.log('📹 Using MP4 with H.264 video only');
        } else {
          mimeType = 'video/webm';
          console.log('📹 Using WebM video only');
        }
      }
      
      console.log(`🎬 Using codec: ${mimeType}`);

      // Try to create MediaRecorder with the selected codec
      let mediaRecorder;
      try {
        const options: any = {
          mimeType: mimeType,
          videoBitsPerSecond: 2000000, // 2 Mbps
        };
        
        // Only add audio bitrate if we have audio tracks
        if (hasAudioTracks) {
          options.audioBitsPerSecond = 128000; // 128 kbps
          console.log('🎵 Audio bitrate set to 128 kbps');
        }
        
        mediaRecorder = new MediaRecorder(stream, options);
        console.log('✅ MediaRecorder created successfully');
      } catch (error) {
        console.warn('Failed to create MediaRecorder with selected codec, trying fallback...', error);
        // Fallback to basic WebM
        const fallbackMimeType = 'video/webm';
        console.log(`🔄 Trying fallback codec: ${fallbackMimeType}`);
        
        const fallbackOptions: any = {
          mimeType: fallbackMimeType,
          videoBitsPerSecond: 2000000,
        };
        
        if (hasAudioTracks) {
          fallbackOptions.audioBitsPerSecond = 128000;
        }
        
        mediaRecorder = new MediaRecorder(stream, fallbackOptions);
      }

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

      // Initialize upload session
      uploadSessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      isUploadInProgressRef.current = false;
      uploadedChunksHashRef.current = null;
      console.log(`🎬 Recording session started: ${uploadSessionIdRef.current}`);

      // Show audio status to user
      if (hasAudioTracks) {
        console.log('🎉 Recording started with audio!');
      } else {
        console.warn('⚠️ Recording started without audio - check browser permissions');
      }

      // Start periodic save (every 30 seconds)
      startPeriodicSave();

      // Handle stream end (user stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        stopRecording();
      };

    } catch (error) {
      console.error('Error starting recording:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to start recording');
    }
  }, [meetingId, userId, onError]);

  // Periodic save function
  const startPeriodicSave = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
    }
    
    saveIntervalRef.current = setInterval(() => {
      if (isRecording && recordedChunksRef.current.length > 0 && !isUploadInProgressRef.current) {
        const now = Date.now();
        const timeSinceLastSave = now - lastSaveTimeRef.current;
        
        // Save every 30 seconds
        if (timeSinceLastSave >= 30000) {
          console.log('💾 Periodic save: Creating backup recording...');
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm;codecs=vp9,opus' });
          uploadRecording(blob);
          lastSaveTimeRef.current = now;
        }
      }
    }, 10000); // Check every 10 seconds
  }, [isRecording]);

  const stopPeriodicSave = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop periodic save
      stopPeriodicSave();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setIsRecording(false);
    }
  }, [isRecording, stopPeriodicSave]);

  // Cleanup effect to ensure recording is saved when component unmounts
  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      console.log('🚨 Page is about to unload, saving recording...');
      
      // Check if MediaRecorder exists and is recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('🛑 Page unload, stopping recording to save video...');
        mediaRecorderRef.current.stop();
      }
      
      // Also check if we have recorded chunks that need to be uploaded
      if (recordedChunksRef.current.length > 0 && !isUploadInProgressRef.current) {
        console.log('💾 Page unload, uploading recorded chunks...');
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm;codecs=vp9,opus' });
        // Use sendBeacon for reliable upload on page unload
        const formData = new FormData();
        formData.append('recording', blob, `recording_${Date.now()}.webm`);
        formData.append('meetingId', meetingId);
        formData.append('userId', userId);
        formData.append('recordingName', meetingName || `Meeting_${meetingId}_${new Date().toISOString().split('T')[0]}`);
        formData.append('sessionId', uploadSessionIdRef.current || 'unknown');
        
        navigator.sendBeacon(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007'}/recording-upload/client-recording`, formData);
      }
    };

    // Add beforeunload listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      console.log('🧹 Component unmounting, checking for active recording...');
      
      // Remove beforeunload listener
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Stop periodic save
      stopPeriodicSave();
      
      // Check if MediaRecorder exists and is recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log('🛑 Component unmounting, stopping recording to save video...');
        mediaRecorderRef.current.stop();
      }
      
      // Also check if we have recorded chunks that need to be uploaded
      if (recordedChunksRef.current.length > 0 && !isUploadInProgressRef.current) {
        console.log('💾 Component unmounting, uploading recorded chunks...');
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm;codecs=vp9,opus' });
        uploadRecording(blob);
      }
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []); // Empty dependency array - run only on mount/unmount

  // Effect to handle meeting end
  React.useEffect(() => {
    if (meetingStatus === 'ENDED' && isRecording) {
      console.log('🏁 Meeting ended, saving recording...');
      stopRecording();
    }
  }, [meetingStatus, isRecording, stopRecording]);

  const uploadRecording = async (blob: Blob) => {
    // Check if upload is already in progress
    if (isUploadInProgressRef.current) {
      console.log('🚫 Upload already in progress, skipping duplicate upload');
      return;
    }

    // Generate hash for the current chunks to detect duplicates
    const currentChunksHash = await generateChunksHash(recordedChunksRef.current);
    
    // Check if this exact content has already been uploaded
    if (uploadedChunksHashRef.current === currentChunksHash) {
      console.log('🚫 Duplicate content detected, skipping upload');
      return;
    }

    // Check if we have any chunks to upload
    if (recordedChunksRef.current.length === 0) {
      console.log('🚫 No recording chunks available, skipping upload');
      return;
    }

    // Set upload lock
    isUploadInProgressRef.current = true;
    setIsUploading(true);
    isUploadingRef.current = true;
    
    try {
      console.log(`📤 Starting upload for session: ${uploadSessionIdRef.current}`);
      console.log(`🔍 Content hash: ${currentChunksHash}`);
      
      // Determine file extension based on blob type
      const isMP4 = blob.type.includes('mp4');
      const fileExtension = isMP4 ? 'mp4' : 'webm';
      const fileName = `recording_${Date.now()}.${fileExtension}`;

      // Create form data for upload
      const formData = new FormData();
      formData.append('recording', blob, fileName);
      formData.append('meetingId', meetingId);
      formData.append('userId', userId);
      formData.append('recordingName', meetingName || `Meeting_${meetingId}_${new Date().toISOString().split('T')[0]}`);
      formData.append('sessionId', uploadSessionIdRef.current || 'unknown');

      console.log('Uploading recording to VOD server...', {
        sessionId: uploadSessionIdRef.current,
        meetingId,
        userId,
        fileSize: blob.size,
        fileName: fileName,
        mimeType: blob.type,
        contentHash: currentChunksHash
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007'}/recording-upload/client-recording`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Mark this content as uploaded
        uploadedChunksHashRef.current = currentChunksHash;
        
        setRecordingUrl(result.recordingId);
        onRecordingComplete?.(result.recordingId);
        console.log('✅ Recording uploaded successfully:', result.recordingId);
        console.log(`📝 Content hash saved: ${currentChunksHash}`);

        // Clear the blob from memory immediately after upload
        blob = null as any;
      } else {
        throw new Error(result.message || 'Upload failed');
      }

    } catch (error) {
      console.error('❌ Upload error:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to upload recording');
    } finally {
      // Release upload lock
      isUploadInProgressRef.current = false;
      setIsUploading(false);
      isUploadingRef.current = false;
    }
  };

  return (
    <div className="client-recording-controls">
      <div className="recording-status">
        {isRecording && (
          <div className="recording-indicator">
            <div className="recording-dot"></div>
            <span>Recording...</span>
            {hasAudio && <span className="audio-indicator">🎵</span>}
            {!hasAudio && <span className="no-audio-indicator">🔇</span>}
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
        <button
          onClick={checkSupportedCodecs}
          className="codec-check-btn"
          style={{ marginLeft: '10px', fontSize: '12px' }}
        >
          🔍 Check Codecs
        </button>
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
        
        .audio-indicator {
          color: #28a745;
          font-size: 16px;
          margin-left: 5px;
        }
        
        .no-audio-indicator {
          color: #ffc107;
          font-size: 16px;
          margin-left: 5px;
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
          align-items: center;
        }
        
        .codec-check-btn {
          padding: 4px 8px;
          background: #e3f2fd;
          border: 1px solid #2196f3;
          border-radius: 4px;
          color: #1976d2;
          cursor: pointer;
          font-size: 12px;
        }
        
        .codec-check-btn:hover {
          background: #bbdefb;
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
