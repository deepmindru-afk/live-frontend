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
  onHandAutoLowered,
  onError,
}: UseWebSocketHandRaiseProps) => {
  const [raisedHands, setRaisedHands] = useState<HandRaiseInfo[]>([]);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Raise hand
  const raiseHand = useCallback(() => {
    if (!socket || !isConnected) {
      console.error('✋ WebSocket not connected');
      onError?.('Not connected to server');
      return;
    }

    if (myHandRaised) {
      console.log('✋ Hand already raised, ignoring');
      return;
    }

    console.log('✋ Raising hand via WebSocket', {
      meetingId,
      userId,
      displayName,
      socket: !!socket,
      isConnected
    });
    setIsLoading(true);
    
    socket.emit('RAISE_HAND', {
      meetingId,
      userId,
      displayName
    });
    
    // Add a timeout to detect if the event is not being processed
    setTimeout(() => {
      if (isLoading) {
        console.error('✋ Hand raise timeout - no response received');
        setIsLoading(false);
        onError?.('Hand raise timeout - no response from server');
      }
    }, 5000);
  }, [socket, isConnected, meetingId, userId, displayName, myHandRaised, onError, isLoading]);

  // Lower hand
  const lowerHand = useCallback(() => {
    if (!socket || !isConnected) {
      console.error('✋ WebSocket not connected');
      onError?.('Not connected to server');
      return;
    }

    if (!myHandRaised) {
      console.log('✋ Hand not raised, ignoring');
      return;
    }

    console.log('✋ Lowering hand via WebSocket');
    setIsLoading(true);
    
    socket.emit('LOWER_HAND', {
      meetingId,
      userId,
      displayName
    });
  }, [socket, isConnected, meetingId, userId, displayName, myHandRaised, onError]);

  // Get current raised hands
  const getRaisedHands = useCallback(() => {
    if (!socket || !isConnected) {
      console.error('✋ WebSocket not connected');
      return;
    }

    console.log('✋ Getting raised hands list');
    socket.emit('GET_RAISED_HANDS', { meetingId });
  }, [socket, isConnected, meetingId]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleHandRaised = (data: HandRaiseInfo) => {
      console.log('✋ Hand raised event received:', data);
      console.log('✋ Current userId:', userId);
      console.log('✋ Is this my hand?', data.userId === userId);
      setIsLoading(false);
      
      setRaisedHands(prev => {
        // Remove any existing entry for this user
        const filtered = prev.filter(hand => hand.userId !== data.userId);
        const newHands = [...filtered, data];
        console.log('✋ Updated raised hands:', newHands);
        return newHands;
      });
      
      // Update my hand status if it's my hand
      if (data.userId === userId) {
        console.log('✋ Updating my hand status to raised');
        setMyHandRaised(true);
      }
      
      onHandRaised?.(data);
    };

    const handleHandLowered = (data: HandRaiseInfo) => {
      console.log('✋ Hand lowered event received:', data);
      setIsLoading(false);
      
      setRaisedHands(prev => {
        const newHands = prev.filter(hand => hand.userId !== data.userId);
        return newHands;
      });
      
      // Update my hand status if it's my hand
      if (data.userId === userId) {
        setMyHandRaised(false);
      }
      
      onHandLowered?.(data);
    };

    const handleHandAutoLowered = (data: HandRaiseInfo & { reason: string }) => {
      console.log('✋ Hand auto-lowered event received:', data);
      setIsLoading(false);
      
      setRaisedHands(prev => {
        const newHands = prev.filter(hand => hand.userId !== data.userId);
        return newHands;
      });
      
      // Update my hand status if it's my hand
      if (data.userId === userId) {
        setMyHandRaised(false);
      }
      
      onHandAutoLowered?.(data);
    };

    const handleRaisedHandsList = (data: { raisedHands: HandRaiseInfo[] }) => {
      console.log('✋ Raised hands list received:', data);
      setRaisedHands(data.raisedHands);
      
      // Update my hand status
      const myHand = data.raisedHands.find(hand => hand.userId === userId);
      setMyHandRaised(!!myHand);
    };

    const handleError = (error: { message: string }) => {
      console.error('✋ Hand raise error:', error);
      setIsLoading(false);
      onError?.(error.message);
    };

    // Register event listeners
    console.log('✋ Registering WebSocket event listeners');
    socket.on('HAND_RAISED', handleHandRaised);
    socket.on('HAND_LOWERED', handleHandLowered);
    socket.on('HAND_AUTO_LOWERED', handleHandAutoLowered);
    socket.on('RAISED_HANDS_LIST', handleRaisedHandsList);
    socket.on('ERROR', handleError);
    
    // Add a test listener to see if any events are coming through
    socket.onAny((eventName, ...args) => {
      if (eventName.includes('HAND') || eventName.includes('ERROR')) {
        console.log('✋ WebSocket event received:', eventName, args);
      }
    });

    // Cleanup
    return () => {
      socket.off('HAND_RAISED', handleHandRaised);
      socket.off('HAND_LOWERED', handleHandLowered);
      socket.off('HAND_AUTO_LOWERED', handleHandAutoLowered);
      socket.off('RAISED_HANDS_LIST', handleRaisedHandsList);
      socket.off('ERROR', handleError);
    };
  }, [socket, userId, onHandRaised, onHandLowered, onHandAutoLowered, onError]);

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
