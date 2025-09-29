import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface HandRaiseInfo {
  participantId: string;
  displayName: string;
  userId: string;
  reason?: string;
  raisedAt: Date;
  meetingId: string;
}

interface HandLowerInfo {
  participantId: string;
  displayName: string;
  userId: string;
  reason?: string;
  loweredAt: Date;
  meetingId: string;
}

interface HandLoweredByHostInfo {
  participantId: string;
  displayName: string;
  hostId: string;
  reason?: string;
  loweredAt: Date;
  meetingId: string;
}

interface AllHandsLoweredInfo {
  hostId: string;
  hostDisplayName: string;
  reason?: string;
  loweredAt: Date;
  meetingId: string;
  loweredCount: number;
}

interface UseHandRaiseProps {
  socket: Socket | null;
  isConnected: boolean;
  meetingId: string;
  participantId: string;
  isHost: boolean;
  onHandRaised?: (info: HandRaiseInfo) => void;
  onHandLowered?: (info: HandLowerInfo) => void;
  onHandLoweredByHost?: (info: HandLoweredByHostInfo) => void;
  onAllHandsLowered?: (info: AllHandsLoweredInfo) => void;
  onError?: (error: string) => void;
}

export const useHandRaise = ({
  socket,
  isConnected,
  meetingId,
  participantId,
  isHost,
  onHandRaised,
  onHandLowered,
  onHandLoweredByHost,
  onAllHandsLowered,
  onError,
}: UseHandRaiseProps) => {
  const [raisedHands, setRaisedHands] = useState<HandRaiseInfo[]>([]);
  const [myHandRaised, setMyHandRaised] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Raise hand (participant action)
  const raiseHand = useCallback((reason?: string) => {
    if (!socket || !isConnected) {
      onError?.('Not connected to server');
      return;
    }

    if (!participantId) {
      onError?.('No participant ID available');
      return;
    }

    setIsLoading(true);
    console.log('✋ Raising hand:', { meetingId, participantId, reason });
    
    socket.emit('RAISE_HAND', {
      meetingId,
      participantId,
      reason,
    });
  }, [socket, isConnected, meetingId, participantId, onError]);

  // Lower hand (participant action)
  const lowerHand = useCallback((reason?: string) => {
    if (!socket || !isConnected) {
      onError?.('Not connected to server');
      return;
    }

    if (!participantId) {
      onError?.('No participant ID available');
      return;
    }

    setIsLoading(true);
    console.log('✋ Lowering hand:', { meetingId, participantId, reason });
    
    socket.emit('LOWER_HAND', {
      meetingId,
      participantId,
      reason,
    });
  }, [socket, isConnected, meetingId, participantId, onError]);

  // Host lowers a specific participant's hand
  const hostLowerHand = useCallback((targetParticipantId: string, reason?: string) => {
    if (!socket || !isConnected) {
      onError?.('Not connected to server');
      return;
    }

    if (!isHost) {
      onError?.('Only hosts can lower other participants\' hands');
      return;
    }

    setIsLoading(true);
    console.log('✋ Host lowering hand:', { meetingId, targetParticipantId, reason });
    
    socket.emit('HOST_LOWER_HAND', {
      meetingId,
      participantId: targetParticipantId,
      reason,
    });
  }, [socket, isConnected, meetingId, isHost, onError]);

  // Host lowers all hands
  const lowerAllHands = useCallback((reason?: string) => {
    if (!socket || !isConnected) {
      onError?.('Not connected to server');
      return;
    }

    if (!isHost) {
      onError?.('Only hosts can lower all hands');
      return;
    }

    setIsLoading(true);
    console.log('✋ Host lowering all hands:', { meetingId, reason });
    
    socket.emit('LOWER_ALL_HANDS', {
      meetingId,
      reason,
    });
  }, [socket, isConnected, meetingId, isHost, onError]);

  // Set up event listeners
  useEffect(() => {
    if (!socket) return;

    // Hand raised event
    const handleHandRaised = (info: HandRaiseInfo) => {
      console.log('✋ Hand raised event received:', info);
      setRaisedHands(prev => {
        // Remove any existing entry for this participant
        const filtered = prev.filter(hand => hand.participantId !== info.participantId);
        return [...filtered, info];
      });
      
      // Update my hand status if it's my hand
      if (info.participantId === participantId) {
        setMyHandRaised(true);
      }
      
      onHandRaised?.(info);
    };

    // Hand lowered event
    const handleHandLowered = (info: HandLowerInfo) => {
      console.log('✋ Hand lowered event received:', info);
      setRaisedHands(prev => prev.filter(hand => hand.participantId !== info.participantId));
      
      // Update my hand status if it's my hand
      if (info.participantId === participantId) {
        setMyHandRaised(false);
      }
      
      onHandLowered?.(info);
    };

    // Hand lowered by host event
    const handleHandLoweredByHost = (info: HandLoweredByHostInfo) => {
      console.log('✋ Hand lowered by host event received:', info);
      setRaisedHands(prev => prev.filter(hand => hand.participantId !== info.participantId));
      
      // Update my hand status if it's my hand
      if (info.participantId === participantId) {
        setMyHandRaised(false);
      }
      
      onHandLoweredByHost?.(info);
    };

    // All hands lowered event
    const handleAllHandsLowered = (info: AllHandsLoweredInfo) => {
      console.log('✋ All hands lowered event received:', info);
      setRaisedHands([]);
      setMyHandRaised(false);
      
      onAllHandsLowered?.(info);
    };

    // Success/Error events
    const handleHandRaiseSuccess = (result: any) => {
      console.log('✋ Hand raise success:', result);
      setIsLoading(false);
      setMyHandRaised(true);
    };

    const handleHandRaiseError = (error: any) => {
      console.error('✋ Hand raise error:', error);
      setIsLoading(false);
      onError?.(error.message || 'Failed to raise hand');
    };

    const handleHandLowerSuccess = (result: any) => {
      console.log('✋ Hand lower success:', result);
      setIsLoading(false);
      setMyHandRaised(false);
    };

    const handleHandLowerError = (error: any) => {
      console.error('✋ Hand lower error:', error);
      setIsLoading(false);
      onError?.(error.message || 'Failed to lower hand');
    };

    const handleHostLowerHandSuccess = (result: any) => {
      console.log('✋ Host lower hand success:', result);
      setIsLoading(false);
    };

    const handleHostLowerHandError = (error: any) => {
      console.error('✋ Host lower hand error:', error);
      setIsLoading(false);
      onError?.(error.message || 'Failed to lower hand as host');
    };

    const handleLowerAllHandsSuccess = (result: any) => {
      console.log('✋ Lower all hands success:', result);
      setIsLoading(false);
    };

    const handleLowerAllHandsError = (error: any) => {
      console.error('✋ Lower all hands error:', error);
      setIsLoading(false);
      onError?.(error.message || 'Failed to lower all hands');
    };

    // Register event listeners
    socket.on('HAND_RAISED', handleHandRaised);
    socket.on('HAND_LOWERED', handleHandLowered);
    socket.on('HAND_LOWERED_BY_HOST', handleHandLoweredByHost);
    socket.on('ALL_HANDS_LOWERED', handleAllHandsLowered);
    socket.on('HAND_RAISE_SUCCESS', handleHandRaiseSuccess);
    socket.on('HAND_RAISE_ERROR', handleHandRaiseError);
    socket.on('HAND_LOWER_SUCCESS', handleHandLowerSuccess);
    socket.on('HAND_LOWER_ERROR', handleHandLowerError);
    socket.on('HOST_LOWER_HAND_SUCCESS', handleHostLowerHandSuccess);
    socket.on('HOST_LOWER_HAND_ERROR', handleHostLowerHandError);
    socket.on('LOWER_ALL_HANDS_SUCCESS', handleLowerAllHandsSuccess);
    socket.on('LOWER_ALL_HANDS_ERROR', handleLowerAllHandsError);

    // Cleanup
    return () => {
      socket.off('HAND_RAISED', handleHandRaised);
      socket.off('HAND_LOWERED', handleHandLowered);
      socket.off('HAND_LOWERED_BY_HOST', handleHandLoweredByHost);
      socket.off('ALL_HANDS_LOWERED', handleAllHandsLowered);
      socket.off('HAND_RAISE_SUCCESS', handleHandRaiseSuccess);
      socket.off('HAND_RAISE_ERROR', handleHandRaiseError);
      socket.off('HAND_LOWER_SUCCESS', handleHandLowerSuccess);
      socket.off('HAND_LOWER_ERROR', handleHandLowerError);
      socket.off('HOST_LOWER_HAND_SUCCESS', handleHostLowerHandSuccess);
      socket.off('HOST_LOWER_HAND_ERROR', handleHostLowerHandError);
      socket.off('LOWER_ALL_HANDS_SUCCESS', handleLowerAllHandsSuccess);
      socket.off('LOWER_ALL_HANDS_ERROR', handleLowerAllHandsError);
    };
  }, [socket, participantId, onHandRaised, onHandLowered, onHandLoweredByHost, onAllHandsLowered, onError]);

  return {
    raisedHands,
    myHandRaised,
    isLoading,
    raiseHand,
    lowerHand,
    hostLowerHand,
    lowerAllHands,
  };
};
