import { useEffect, useRef, useCallback } from 'react';

interface AudioLevelDetectionOptions {
  threshold?: number;
  smoothingFactor?: number;
  updateInterval?: number;
}

export const useAudioLevelDetection = (options: AudioLevelDetectionOptions = {}) => {
  const {
    threshold = 0.01,
    smoothingFactor = 0.8,
    updateInterval = 100
  } = options;

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isListeningRef = useRef<boolean>(false);

  // Initialize audio context and analyser
  const initializeAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return false;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = smoothingFactor;
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      return true;
    } catch (error) {
      return false;
    }
  }, [smoothingFactor]);

  // Analyze audio level from a media stream
  const analyzeAudioLevel = useCallback((stream: MediaStream): Promise<number> => {
    return new Promise((resolve) => {
      if (!audioContextRef.current || !analyserRef.current || !dataArrayRef.current) {
        resolve(0);
        return;
      }

      try {
        // Create a new source for this stream
        const source = audioContextRef.current.createMediaStreamSource(stream);
        const tempAnalyser = audioContextRef.current.createAnalyser();
        tempAnalyser.fftSize = 256;
        tempAnalyser.smoothingTimeConstant = smoothingFactor;
        
        source.connect(tempAnalyser);
        
        const bufferLength = tempAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        tempAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS (Root Mean Square) for better audio level detection
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = dataArray[i] / 255;
          sum += normalized * normalized;
        }
        
        const rms = Math.sqrt(sum / bufferLength);
        
        // Disconnect the source to prevent memory leaks
        source.disconnect();
        tempAnalyser.disconnect();
        
        resolve(rms);
      } catch (error) {
        resolve(0);
      }
    });
  }, [smoothingFactor]);

  // Start continuous audio level monitoring
  const startAudioMonitoring = useCallback((
    stream: MediaStream,
    onAudioLevelChange: (level: number, isSpeaking: boolean) => void
  ) => {
    if (!initializeAudioContext()) return;

    try {
      const source = audioContextRef.current!.createMediaStreamSource(stream);
      source.connect(analyserRef.current!);
      
      isListeningRef.current = true;
      
      const monitor = () => {
        if (!isListeningRef.current || !analyserRef.current || !dataArrayRef.current) {
          return;
        }

        analyserRef.current!.getByteFrequencyData(dataArrayRef.current!);
        
        // Calculate average audio level
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current!.length; i++) {
          sum += dataArrayRef.current![i];
        }
        
        const average = sum / dataArrayRef.current!.length;
        const normalizedLevel = average / 255;
        const isSpeaking = normalizedLevel > threshold;
        
        onAudioLevelChange(normalizedLevel, isSpeaking);
        
        animationFrameRef.current = requestAnimationFrame(monitor);
      };
      
      monitor();
    } catch (error) {
    }
  }, [threshold, initializeAudioContext]);

  // Stop audio monitoring
  const stopAudioMonitoring = useCallback(() => {
    isListeningRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Detect speaking status for multiple participants
  const detectSpeakingStatus = useCallback(async (
    participants: Array<{ _id: string; stream?: MediaStream }>
  ): Promise<Array<{ _id: string; audioLevel: number; isSpeaking: boolean }>> => {
    const results = await Promise.all(
      participants.map(async (participant) => {
        if (!participant.stream) {
          return { _id: participant._id, audioLevel: 0, isSpeaking: false };
        }

        try {
          const audioLevel = await analyzeAudioLevel(participant.stream);
          const isSpeaking = audioLevel > threshold;
          
          return {
            _id: participant._id,
            audioLevel,
            isSpeaking
          };
        } catch (error) {
          return { _id: participant._id, audioLevel: 0, isSpeaking: false };
        }
      })
    );

    return results;
  }, [analyzeAudioLevel, threshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioMonitoring();
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopAudioMonitoring]);

  return {
    analyzeAudioLevel,
    startAudioMonitoring,
    stopAudioMonitoring,
    detectSpeakingStatus,
    isSupported: typeof window !== 'undefined' && 
                 (typeof window.AudioContext !== 'undefined' || 
                  typeof (window as any).webkitAudioContext !== 'undefined')
  };
};
