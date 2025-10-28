import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface HandRaiseInfo {
  userId: string;
  displayName: string;
  raisedAt: Date;
  timeRemaining?: number;
}

interface UseWebSocketHandRaiseProps {
  meetingId: string;
  userId: string;
  displayName: string;
  socket?: Socket;
  isConnected?: boolean;
  onHandRaised?: (info: HandRaiseInfo) => void;
  onHandLowered?: (info: HandRaiseInfo) => void;
  onHandLoweredByHost?: (info: HandRaiseInfo & { hostId: string; hostDisplayName: string; reason?: string }) => void;
  onAllHandsLowered?: (data: { hostId: string; hostDisplayName: string; reason?: string; loweredCount: number; loweredHands: HandRaiseInfo[] }) => void;
  onHandAutoLowered?: (info: HandRaiseInfo & { reason: string }) => void;
  onError?: (error: string) => void;
}

export const useWebSocketHandRaise = ({
  meetingId,
  userId,
  displayName,
  socket,
  isConnected,
  onHandRaised,
  onHandLowered,
  onHandLoweredByHost,
  onAllHandsLowered,
  onHandAutoLowered,
  onError,
}: UseWebSocketHandRaiseProps) => {
  const [raisedHands, setRaisedHands] = useState<HandRaiseInfo[]>([]);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Store callback functions in refs to avoid dependency array issues
  const callbacksRef = useRef({
    onHandRaised,
    onHandLowered,
    onHandLoweredByHost,
    onAllHandsLowered,
    onHandAutoLowered,
    onError,
  });
  
  // Update callbacks ref when they change
  callbacksRef.current = {
    onHandRaised,
    onHandLowered,
    onHandLoweredByHost,
    onAllHandsLowered,
    onHandAutoLowered,
    onError,
  };

  // Raise hand
  const raiseHand = useCallback(() => {
    if (!socket || !isConnected) {
      callbacksRef.current.onError?.('Not connected to server');
      return;
    }

    if (myHandRaised) {
      return;
    }

    setIsLoading(true);
    
    socket.emit('RAISE_HAND', {
      meetingId,
      userId,
      displayName
    });
    
    // Add a timeout to detect if the event is not being processed
    setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        callbacksRef.current.onError?.('Hand raise timeout - no response from server');
      }
    }, 5000);
  }, [socket, isConnected, meetingId, userId, displayName, myHandRaised, onError, isLoading]);

  // Lower hand
  const lowerHand = useCallback(() => {
    if (!socket || !isConnected) {
      callbacksRef.current.onError?.('Not connected to server');
      return;
    }

    // ✅ CRITICAL FIX: Always emit LOWER_HAND, don't check myHandRaised
    // The backend will determine if hand was actually raised
    setIsLoading(true);
    
    socket.emit('LOWER_HAND', {
      meetingId,
      userId,
      displayName
    });
  }, [socket, isConnected, meetingId, userId, displayName, onError]);

  // Get current raised hands
  const getRaisedHands = useCallback(() => {
    if (!socket || !isConnected) {
      return;
    }

    socket.emit('GET_RAISED_HANDS', { meetingId });
  }, [socket, isConnected, meetingId]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleHandRaised = (data: HandRaiseInfo) => {
      setIsLoading(false);
      
      setRaisedHands(prev => {
        // Remove any existing entry for this user
        const filtered = prev.filter(hand => hand.userId !== data.userId);
        const newHands = [...filtered, data];
        return newHands;
      });
      
      // Update my hand status if it's my hand
      if (data.userId === userId) {
        setMyHandRaised(true);
      }
      
      callbacksRef.current.onHandRaised?.(data);
    };

    const handleHandLowered = (data: HandRaiseInfo) => {
      setIsLoading(false);
      
      setRaisedHands(prev => {
        const newHands = prev.filter(hand => hand.userId !== data.userId);
        return newHands;
      });
      
      // Update my hand status if it's my hand
      if (data.userId === userId) {
        setMyHandRaised(false);
      }
      
      callbacksRef.current.onHandLowered?.(data);
    };

    const handleHandAutoLowered = (data: HandRaiseInfo & { reason: string }) => {
      setIsLoading(false);
      
      setRaisedHands(prev => {
        const newHands = prev.filter(hand => hand.userId !== data.userId);
        return newHands;
      });
      
      // Update my hand status if it's my hand
      if (data.userId === userId) {
        setMyHandRaised(false);
      }
      
      callbacksRef.current.onHandAutoLowered?.(data);
    };

    const handleRaisedHandsList = (data: { raisedHands: HandRaiseInfo[] }) => {
      setRaisedHands(data.raisedHands);
      
      // Update my hand status
      const myHand = data.raisedHands.find(hand => hand.userId === userId);
      setMyHandRaised(!!myHand);
    };

    const handleHandLoweredByHost = (data: HandRaiseInfo & { hostId: string; hostDisplayName: string; reason?: string }) => {
      setIsLoading(false);
      
      setRaisedHands(prev => {
        const newHands = prev.filter(hand => hand.userId !== data.userId);
        return newHands;
      });
      
      // Update my hand status if it's my hand
      if (data.userId === userId) {
        setMyHandRaised(false);
      }
      
      callbacksRef.current.onHandLoweredByHost?.(data);
    };

    const handleAllHandsLowered = (data: { hostId: string; hostDisplayName: string; reason?: string; loweredCount: number; loweredHands: HandRaiseInfo[] }) => {
      setIsLoading(false);
      
      // Clear all raised hands
      setRaisedHands([]);
      setMyHandRaised(false);
      
      callbacksRef.current.onAllHandsLowered?.(data);
    };

    const handleHandLowerSuccess = (data: { participantId: string; message: string }) => {
      setIsLoading(false);
      
      // Update state when successfully lowered
      if (data.participantId === userId) {
        setMyHandRaised(false);
      }
      
      setRaisedHands(prev => {
        const newHands = prev.filter(hand => hand.userId !== data.participantId);
        return newHands;
      });
    };

    const handleHandRaiseSuccess = (data: { participantId: string; message: string }) => {
      setIsLoading(false);
      
      // Update state when successfully raised
      if (data.participantId === userId) {
        setMyHandRaised(true);
      }
    };

    const handleError = (error: { message: string }) => {
      setIsLoading(false);
      callbacksRef.current.onError?.(error.message);
    };

    // Register event listeners
    socket.on('HAND_RAISED', handleHandRaised);
    socket.on('HAND_LOWERED', handleHandLowered);
    socket.on('HAND_LOWERED_BY_HOST', handleHandLoweredByHost);
    socket.on('ALL_HANDS_LOWERED', handleAllHandsLowered);
    socket.on('HAND_AUTO_LOWERED', handleHandAutoLowered);
    socket.on('RAISED_HANDS_LIST', handleRaisedHandsList);
    socket.on('HAND_LOWER_SUCCESS', handleHandLowerSuccess);
    socket.on('HAND_RAISE_SUCCESS', handleHandRaiseSuccess);
    socket.on('ERROR', handleError);
    
    // Add a test listener to see if any events are coming through
    socket.onAny((eventName, ...args) => {
      if (eventName.includes('HAND') || eventName.includes('ERROR')) {
      }
    });

    // Cleanup - CRITICAL: Remove ALL listeners to prevent duplication
    return () => {
      socket.off('HAND_RAISED', handleHandRaised);
      socket.off('HAND_LOWERED', handleHandLowered);
      socket.off('HAND_LOWERED_BY_HOST', handleHandLoweredByHost);
      socket.off('ALL_HANDS_LOWERED', handleAllHandsLowered);
      socket.off('HAND_AUTO_LOWERED', handleHandAutoLowered);
      socket.off('RAISED_HANDS_LIST', handleRaisedHandsList);
      socket.off('HAND_LOWER_SUCCESS', handleHandLowerSuccess);
      socket.off('HAND_RAISE_SUCCESS', handleHandRaiseSuccess);
      socket.off('ERROR', handleError);
      socket.offAny(); // CRITICAL: Remove the catch-all listener
    };
  }, [socket, userId, meetingId]); // Remove callback functions from dependencies to prevent infinite re-renders

  // Get raised hands when connected
  useEffect(() => {
    if (isConnected && meetingId) {
      getRaisedHands();
    }
  }, [isConnected, meetingId, getRaisedHands]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  return {
    raisedHands,
    myHandRaised,
    isLoading,
    raiseHand,
    lowerHand,
    getRaisedHands,
  };
};
