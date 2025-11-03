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
  
  // ✅ CRITICAL FIX: Force reset loading state if stuck
  useEffect(() => {
    if (isLoading) {
      const stuckTimeout = setTimeout(() => {
        setIsLoading(false);
      }, 5000); // 5 second max loading time
      
      return () => clearTimeout(stuckTimeout);
    }
  }, [isLoading]);
  
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
      setIsLoading(false); // ✅ Ensure loading is false on error
      return;
    }

    if (myHandRaised) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    socket.emit('RAISE_HAND', {
      meetingId,
      userId,
      displayName
    });
    
    // ✅ Add a timeout to detect if the event is not being processed
    setTimeout(() => {
      setIsLoading(false);
      callbacksRef.current.onError?.('Hand raise timeout - no response from server');
    }, 3000);
  }, [socket, isConnected, meetingId, userId, displayName, myHandRaised]);

  // Lower hand
  const lowerHand = useCallback(() => {
    
    if (!socket || !isConnected) {
      const errorMsg = 'Not connected to server';
      callbacksRef.current.onError?.(errorMsg);
      setIsLoading(false); // ✅ Ensure loading is false on error
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
    
    // ✅ CRITICAL: Add timeout to ensure loading state resets even if no response
    // Reduce timeout to 2 seconds for faster recovery
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  }, [socket, isConnected, meetingId, userId, displayName]);

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
      
      // ✅ CRITICAL: Check if this is our hand - use string comparison to handle type differences
      const dataUserIdStr = String(data.userId || '').trim();
      const myUserIdStr = String(userId || '').trim();
      const isMyHand = dataUserIdStr === myUserIdStr && dataUserIdStr !== '';
      
      
      setRaisedHands(prev => {
        // Remove any existing entry for this user
        const filtered = prev.filter(hand => hand.userId !== data.userId);
        const newHands = [...filtered, data];
        return newHands;
      });
      
      // ✅ CRITICAL: Update my hand status - use multiple methods to ensure update
      if (isMyHand) {
        setMyHandRaised(true);
        // Double-update to ensure it sticks
        setTimeout(() => {
          setMyHandRaised(true);
        }, 10);
        // Triple-update just to be sure
        setTimeout(() => {
          setMyHandRaised(true);
        }, 50);
      } else {
      }
      
      callbacksRef.current.onHandRaised?.(data);
    };

    const handleHandLowered = (data: HandRaiseInfo & { participantId?: string }) => {
      setIsLoading(false);
      
      // ✅ FIX: Handle both userId and participantId fields - use string comparison
      const idToCheck = String(data.userId || (data as any).participantId || '').trim();
      const myUserIdStr = String(userId || '').trim();
      const isMyHand = idToCheck === myUserIdStr && idToCheck !== '';
      
      
      // Check if we had a raised hand in our list - use string comparison
      setRaisedHands(prev => {
        const wasInList = prev.some(hand => {
          const handUserIdStr = String(hand.userId || '').trim();
          return handUserIdStr === idToCheck || handUserIdStr === myUserIdStr;
        });
        
        
        if (isMyHand || wasInList) {
          // Force update immediately
          setMyHandRaised(false);
          // Also update after a tiny delay to ensure it sticks
          setTimeout(() => {
            setMyHandRaised(false);
          }, 10);
        }
        
        // Filter out the lowered hand - use string comparison
        if (!idToCheck) return prev;
        const newHands = prev.filter(hand => {
          const handUserIdStr = String(hand.userId || '').trim();
          return handUserIdStr !== idToCheck;
        });
        return newHands;
      });
      
      // ✅ ALWAYS update if it's explicitly our hand
      if (isMyHand) {
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

    const handleHandLowerSuccess = (data: { participantId?: string; userId?: string; message: string }) => {
      setIsLoading(false);
      
      // ✅ CRITICAL: ALWAYS set to false when we receive HAND_LOWER_SUCCESS
      // We sent the request, so this response is definitely for us
      setMyHandRaised(false);
      
      // Also try setTimeout to ensure update happens
      setTimeout(() => {
        setMyHandRaised(false);
      }, 10);
      
      // Remove from raised hands list - use string comparison
      const idToCheck = String(data.participantId || data.userId || '').trim();
      const myUserIdStr = String(userId || '').trim();
      setRaisedHands(prev => {
        const filtered = prev.filter(hand => {
          const handUserIdStr = String(hand.userId || '').trim();
          const shouldRemove = !idToCheck ? handUserIdStr === myUserIdStr : (handUserIdStr === idToCheck || handUserIdStr === myUserIdStr);
          if (shouldRemove) {
          }
          return !shouldRemove;
        });
        return filtered;
      });
    };

    const handleHandRaiseSuccess = (data: { participantId?: string; userId?: string; message: string }) => {
      setIsLoading(false);
      
      // ✅ FIX: Handle both participantId and userId fields - use string comparison
      const idToCheck = String(data.participantId || data.userId || '').trim();
      const myUserIdStr = String(userId || '').trim();
      const isMyHand = idToCheck === myUserIdStr && idToCheck !== '';
      
      
      // ✅ CRITICAL: Always update if ID matches OR if no ID (assume it's us since we sent the request)
      if (isMyHand || (!idToCheck && myUserIdStr)) {
        setMyHandRaised(true);
        // Double-update to ensure it sticks
        setTimeout(() => {
          setMyHandRaised(true);
        }, 10);
      } else {
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
