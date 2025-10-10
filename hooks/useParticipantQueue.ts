import { useState, useEffect, useCallback, useRef } from 'react';

export interface Participant {
  _id: string;
  displayName: string;
  email: string;
  isMuted: boolean;
  isCameraOff: boolean;
  joinedAt: string;
  isHost?: boolean;
  role?: 'HOST' | 'PARTICIPANT';
  hasHandRaised?: boolean;
  handRaisedAt?: string;
  isSpeaking?: boolean;
  audioLevel?: number;
  lastActivity?: string;
  originalJoinOrder?: number;
  // User object contains the user/member ID used as LiveKit identity
  user?: {
    _id: string;
    displayName?: string;
    email?: string;
  };
  // Sometimes participants may have userId directly
  userId?: string;
}

export interface QueueState {
  participants: Participant[];
  activeSpeaker: Participant | null;
  screenShareMode: boolean;
  screenShareParticipant: Participant | null;
}

export const useParticipantQueue = (initialParticipants: Participant[] = []) => {
  const [queueState, setQueueState] = useState<QueueState>({
    participants: initialParticipants.map((p, index) => ({
      ...p,
      originalJoinOrder: index,
      isSpeaking: false,
      audioLevel: 0,
      lastActivity: new Date().toISOString()
    })),
    activeSpeaker: null,
    screenShareMode: false,
    screenShareParticipant: null
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize audio analysis
  const initializeAudioAnalysis = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
    } catch (error) {
      console.warn('Audio analysis not supported:', error);
    }
  }, []);

  // Analyze audio level for a participant
  const analyzeAudioLevel = useCallback(async (participantId: string, stream: MediaStream) => {
    if (!audioContextRef.current || !analyserRef.current) return 0;

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average audio level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      
      return Math.round(average);
    } catch (error) {
      console.warn('Error analyzing audio:', error);
      return 0;
    }
  }, []);

  // Update participant audio level
  const updateParticipantAudioLevel = useCallback((participantId: string, audioLevel: number) => {
    setQueueState(prev => ({
      ...prev,
      participants: prev.participants.map(p => 
        p._id === participantId 
          ? { ...p, audioLevel, lastActivity: new Date().toISOString() }
          : p
      )
    }));
  }, []);

  // Sort participants based on queue logic
  const sortParticipants = useCallback((participants: Participant[]): Participant[] => {
    const now = new Date();
    
    return [...participants].sort((a, b) => {
      // 1. Active speaker first
      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;
      
      // 2. If both speaking, sort by audio level (louder first)
      if (a.isSpeaking && b.isSpeaking) {
        const audioDiff = (b.audioLevel || 0) - (a.audioLevel || 0);
        if (Math.abs(audioDiff) > 5) return audioDiff; // Only if significant difference
        
        // If similar audio levels, sort by most recent activity
        const aActivity = new Date(a.lastActivity || a.joinedAt).getTime();
        const bActivity = new Date(b.lastActivity || b.joinedAt).getTime();
        return bActivity - aActivity;
      }
      
      // 3. Hand raised participants next (in chronological order)
      if (a.hasHandRaised && !b.hasHandRaised) return -1;
      if (!a.hasHandRaised && b.hasHandRaised) return 1;
      
      if (a.hasHandRaised && b.hasHandRaised) {
        const aHandRaised = new Date(a.handRaisedAt || a.joinedAt).getTime();
        const bHandRaised = new Date(b.handRaisedAt || b.joinedAt).getTime();
        return aHandRaised - bHandRaised; // Earlier hand raise first
      }
      
      // 4. Others by original join order
      return (a.originalJoinOrder || 0) - (b.originalJoinOrder || 0);
    });
  }, []);

  // Add participant to queue
  const addParticipant = useCallback((participant: Participant) => {
    setQueueState(prev => {
      const newParticipant = {
        ...participant,
        originalJoinOrder: prev.participants.length,
        isSpeaking: false,
        audioLevel: 0,
        lastActivity: new Date().toISOString()
      };
      
      const updatedParticipants = [...prev.participants, newParticipant];
      return {
        ...prev,
        participants: sortParticipants(updatedParticipants)
      };
    });
  }, [sortParticipants]);

  // Remove participant from queue
  const removeParticipant = useCallback((participantId: string) => {
    setQueueState(prev => {
      const updatedParticipants = prev.participants.filter(p => p._id !== participantId);
      return {
        ...prev,
        participants: sortParticipants(updatedParticipants),
        activeSpeaker: prev.activeSpeaker?._id === participantId ? null : prev.activeSpeaker
      };
    });
  }, [sortParticipants]);

  // Update participant speaking status
  const updateSpeakingStatus = useCallback((participantId: string, isSpeaking: boolean, audioLevel: number = 0) => {
    setQueueState(prev => {
      const updatedParticipants = prev.participants.map(p => 
        p._id === participantId 
          ? { 
              ...p, 
              isSpeaking, 
              audioLevel,
              lastActivity: new Date().toISOString()
            }
          : p
      );
      
      const sortedParticipants = sortParticipants(updatedParticipants);
      const newActiveSpeaker = sortedParticipants.find(p => p.isSpeaking) || null;
      
      return {
        ...prev,
        participants: sortedParticipants,
        activeSpeaker: newActiveSpeaker
      };
    });
  }, [sortParticipants]);

  // Update hand raise status
  const updateHandRaiseStatus = useCallback((participantId: string, hasHandRaised: boolean) => {
    setQueueState(prev => {
      const updatedParticipants = prev.participants.map(p => 
        p._id === participantId 
          ? { 
              ...p, 
              hasHandRaised,
              handRaisedAt: hasHandRaised ? new Date().toISOString() : undefined,
              lastActivity: new Date().toISOString()
            }
          : p
      );
      
      return {
        ...prev,
        participants: sortParticipants(updatedParticipants)
      };
    });
  }, [sortParticipants]);

  // Start screen share
  const startScreenShare = useCallback((participantId: string) => {
    setQueueState(prev => {
      const screenShareParticipant = prev.participants.find(p => p._id === participantId);
      return {
        ...prev,
        screenShareMode: true,
        screenShareParticipant: screenShareParticipant || null
      };
    });
  }, []);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    setQueueState(prev => ({
      ...prev,
      screenShareMode: false,
      screenShareParticipant: null
    }));
  }, []);

  // Update participant data
  const updateParticipant = useCallback((participantId: string, updates: Partial<Participant>) => {
    setQueueState(prev => {
      const updatedParticipants = prev.participants.map(p => 
        p._id === participantId 
          ? { ...p, ...updates, lastActivity: new Date().toISOString() }
          : p
      );
      
      return {
        ...prev,
        participants: sortParticipants(updatedParticipants)
      };
    });
  }, [sortParticipants]);

  // Get main stage participants based on view mode
  const getMainStageParticipants = useCallback((viewMode: 'speaker' | 'grid' = 'grid') => {
    if (queueState.screenShareMode && queueState.screenShareParticipant) {
      return [queueState.screenShareParticipant];
    }
    
    if (viewMode === 'speaker') {
      // Speaker mode: Show only the first participant (active speaker) in main stage
      return queueState.participants.slice(0, 1);
    }
    
    // Grid mode: Return ALL participants - no artificial limiting
    return queueState.participants;
  }, [queueState.participants, queueState.screenShareMode, queueState.screenShareParticipant]);

  // Get thumbnail participants based on view mode
  const getThumbnailParticipants = useCallback((viewMode: 'speaker' | 'grid' = 'grid') => {
    if (queueState.screenShareMode) {
      // In screen share mode, show all other participants as thumbnails
      return queueState.participants.filter(p => p._id !== queueState.screenShareParticipant?._id);
    }
    
    if (viewMode === 'speaker') {
      // Speaker mode: Show remaining participants as thumbnails
      return queueState.participants.slice(1);
    }
    
    // Grid mode: No thumbnails needed since all participants are in main stage
    return [];
  }, [queueState.participants, queueState.screenShareMode, queueState.screenShareParticipant]);

  // Initialize audio analysis on mount
  useEffect(() => {
    initializeAudioAnalysis();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [initializeAudioAnalysis]);

  // Update participants when initialParticipants changes
  useEffect(() => {
    console.log('🔄 [useParticipantQueue] initialParticipants changed:', {
      initialParticipantsLength: initialParticipants.length,
      initialParticipants: initialParticipants.map(p => ({ id: p._id, name: p.displayName }))
    });
    
    const updatedParticipants = initialParticipants.map((p, index) => ({
      ...p,
      originalJoinOrder: index,
      isSpeaking: false,
      audioLevel: 0,
      lastActivity: new Date().toISOString()
    }));
    
    setQueueState(prev => ({
      ...prev,
      participants: sortParticipants(updatedParticipants)
    }));
  }, [initialParticipants, sortParticipants]);

  // Re-sort participants when dependencies change
  useEffect(() => {
    setQueueState(prev => ({
      ...prev,
      participants: sortParticipants(prev.participants)
    }));
  }, [sortParticipants]);

  return {
    queueState,
    addParticipant,
    removeParticipant,
    updateSpeakingStatus,
    updateHandRaiseStatus,
    startScreenShare,
    stopScreenShare,
    updateParticipant,
    getMainStageParticipants,
    getThumbnailParticipants,
    analyzeAudioLevel,
    updateParticipantAudioLevel
  };
};
