import { useState, useEffect, useCallback, useRef } from 'react';
import { sortThumbnailQueue, getMainStageParticipant, Participant } from '../lib/videoQueue';

// Re-export Participant type for backwards compatibility
export type { Participant };

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

  // ✅ NEW: Sort participants using the centralized video queue logic
  const sortParticipants = useCallback((participants: Participant[]): Participant[] => {
    return sortThumbnailQueue(participants);
  }, []);

  // Add participant to queue
  const addParticipant = useCallback((participant: Participant) => {
    setQueueState(prev => {
      // CRITICAL FIX: Check if participant already exists to prevent duplicates
      const exists = prev.participants.some(p => p._id === participant._id || p.identity === participant.identity);
      if (exists) {
        return prev; // Don't add duplicate
      }
      
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
  }, []); // ✅ FIXED: Remove sortParticipants dependency

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
  }, []); // ✅ FIXED: Remove sortParticipants dependency

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
  }, []); // ✅ FIXED: Remove sortParticipants dependency

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
  }, []); // ✅ FIXED: Remove sortParticipants dependency

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
      // CRITICAL FIX: Use functional update to prevent race conditions
      const updatedParticipants = prev.participants.map(p => 
        p._id === participantId || p.identity === participantId
          ? { ...p, ...updates, lastActivity: new Date().toISOString() }
          : p
      );
      
      return {
        ...prev,
        participants: sortParticipants(updatedParticipants)
      };
    });
  }, []); // ✅ FIXED: Remove sortParticipants dependency

  // ✅ NEW: Get main stage participants based on priority queue rules
  const getMainStageParticipants = useCallback((viewMode: 'speaker' | 'grid' = 'grid') => {
    // Grid mode: Return ALL participants - no artificial limiting
    if (viewMode === 'grid') {
      return queueState.participants;
    }
    
    // Speaker mode: Use priority queue logic
    // Priority: Screen Share > Speaking > Host > Most Active
    const screenShareId = queueState.screenShareMode && queueState.screenShareParticipant 
      ? queueState.screenShareParticipant._id 
      : null;
    
    const mainParticipant = getMainStageParticipant(queueState.participants, screenShareId);
    
    return mainParticipant ? [mainParticipant] : [];
  }, [queueState.participants, queueState.screenShareMode, queueState.screenShareParticipant]);

  // ✅ NEW: Get thumbnail participants based on view mode, excluding main stage
  const getThumbnailParticipants = useCallback((viewMode: 'speaker' | 'grid' = 'grid') => {
    // Grid mode: No thumbnails needed since all participants are in main stage
    if (viewMode === 'grid') {
      return [];
    }
    
    // Get the main stage participant
    const mainStageParticipants = getMainStageParticipants(viewMode);
    const mainStageId = mainStageParticipants[0]?._id;
    
    if (!mainStageId) {
      return queueState.participants;
    }
    
    // Return all participants except the main stage one
    return queueState.participants.filter(p => p._id !== mainStageId);
  }, [queueState.participants, getMainStageParticipants]);

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
    const updatedParticipants = initialParticipants.map((p, index) => ({
      ...p,
      originalJoinOrder: index,
      isSpeaking: p.isSpeaking ?? false,
      audioLevel: p.audioLevel ?? 0,
      lastActivity: p.lastActivity || '2024-01-01T00:00:00.000Z' // ✅ FIXED: Use static fallback, don't create new timestamp
    }));
    
    setQueueState(prev => ({
      ...prev,
      participants: sortParticipants(updatedParticipants)
    }));
  }, [initialParticipants]); // ✅ FIXED: Removed sortParticipants from dependencies

  // ✅ REMOVED: This useEffect was causing infinite loop
  // Participants are sorted when they're added/updated, no need for separate sorting effect

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
