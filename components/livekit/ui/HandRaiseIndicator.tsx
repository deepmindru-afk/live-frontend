import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useWebSocketHandRaise } from '../../../hooks/useWebSocketHandRaise';
import Swal from 'sweetalert2';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface HandRaiseInfo {
  userId: string;
  displayName: string;
  raisedAt: Date;
  timeRemaining?: number;
}

interface HandRaiseIndicatorProps {
  // Connection props
  socket: any;
  isConnected: boolean;
  meetingId: string;
  
  // User props
  currentParticipant: any;
  isHost: boolean;
  
  // UI props
  isMobile?: boolean;
  mode?: 'button' | 'indicator' | 'both';
  
  // Callbacks
  onHandRaiseStatusChange?: (participantId: string, isRaised: boolean) => void;
  onHandRaiseQueueChange?: (queue: any[]) => void;
  onRaisedHandsChange?: (raisedHands: HandRaiseInfo[]) => void;
}

// ============================================================================
// HAND RAISE INDICATOR COMPONENT
// ============================================================================

export const HandRaiseIndicator: React.FC<HandRaiseIndicatorProps> = ({
  socket,
  isConnected,
  meetingId,
  currentParticipant,
  isHost,
  isMobile = false,
  mode = 'both',
  onHandRaiseStatusChange,
  onHandRaiseQueueChange,
  onRaisedHandsChange,
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [handRaiseQueue, setHandRaiseQueue] = useState<any[]>([]);
  const [currentHandRaiseMessage, setCurrentHandRaiseMessage] = useState<string | null>(null);

  // ============================================================================
  // WEBSOCKET HAND RAISE HOOK
  // ============================================================================
  
  const {
    raisedHands: wsRaisedHands,
    myHandRaised: wsMyHandRaised,
    raiseHand: wsRaiseHand,
    lowerHand: wsLowerHand,
    isLoading,
  } = useWebSocketHandRaise({
    meetingId: meetingId || '',
    userId: currentParticipant?._id || '',
    displayName: currentParticipant?.displayName || '',
    socket: socket || undefined,
    isConnected: isConnected,
    
    // Handle hand raised event
    onHandRaised: (info) => {
      setHandRaiseQueue(prev => {
        // Remove any existing entry for this user
        const filtered = prev.filter((hand: any) => hand.participantId !== info.userId);
        // Add to the beginning (most recent first - DESC order)
        const newQueue = [{
          participantId: info.userId,
          displayName: info.displayName,
          raisedAt: info.raisedAt
        }, ...filtered];
        
        // Notify parent component
        onHandRaiseQueueChange?.(newQueue);
        
        return newQueue;
      });
      
      // Update participant status in parent
      onHandRaiseStatusChange?.(info.userId, true);
      
      // Show notification for host
      if (isHost) {
        setCurrentHandRaiseMessage(`${info.displayName} raised their hand`);
        setTimeout(() => setCurrentHandRaiseMessage(null), 3000);
      }
    },
    
    // Handle hand lowered event
    onHandLowered: (info) => {
      setHandRaiseQueue(prev => {
        const newQueue = prev.filter((hand: any) => hand.participantId !== info.userId);
        
        // Notify parent component
        onHandRaiseQueueChange?.(newQueue);
        
        return newQueue;
      });
      
      // Update participant status in parent
      onHandRaiseStatusChange?.(info.userId, false);
      
      // Clear current message if this was the last hand
      if (isHost && handRaiseQueue.length <= 1) {
        setCurrentHandRaiseMessage(null);
      }
    },
    
    // Handle auto-lowered event (1 minute timeout)
    onHandAutoLowered: (info) => {
      setHandRaiseQueue(prev => {
        const newQueue = prev.filter((hand: any) => hand.participantId !== info.userId);
        
        // Notify parent component
        onHandRaiseQueueChange?.(newQueue);
        
        return newQueue;
      });
      
      // Update participant status in parent
      onHandRaiseStatusChange?.(info.userId, false);
      
      // Show notification for auto-lower
      if (info.userId === currentParticipant?._id) {
        Swal.fire({
          icon: 'info',
          title: 'Hand Auto-Lowered',
          text: 'Your hand was automatically lowered after 1 minute',
          timer: 3000,
          showConfirmButton: false
        });
      }
      
      // Clear current message if this was the last hand
      if (isHost && handRaiseQueue.length <= 1) {
        setCurrentHandRaiseMessage(null);
      }
    },
    
    // Handle host lowering participant's hand
    onHandLoweredByHost: (info) => {
      setHandRaiseQueue(prev => {
        const newQueue = prev.filter((hand: any) => hand.participantId !== info.userId);
        
        // Notify parent component
        onHandRaiseQueueChange?.(newQueue);
        
        return newQueue;
      });
      
      // Update participant status in parent
      onHandRaiseStatusChange?.(info.userId, false);
      
      // Show notification if this was my hand
      if (info.userId === currentParticipant?._id) {
        Swal.fire({
          icon: 'info',
          title: 'Hand Lowered',
          text: 'The host lowered your hand',
          timer: 3000,
          showConfirmButton: false
        });
      }
      
      // Clear current message if this was the last hand
      if (isHost && handRaiseQueue.length <= 1) {
        setCurrentHandRaiseMessage(null);
      }
    },
    
    // Handle all hands lowered by host
    onAllHandsLowered: () => {
      setHandRaiseQueue([]);
      setCurrentHandRaiseMessage(null);
      
      // Notify parent component
      onHandRaiseQueueChange?.([]);
      
      // Show notification if I had my hand raised
      if (wsMyHandRaised) {
        Swal.fire({
          icon: 'info',
          title: 'All Hands Lowered',
          text: 'The host lowered all hands',
          timer: 3000,
          showConfirmButton: false
        });
      }
    },
    
    // Handle errors silently (no alert)
    onError: (error) => {
      // Errors handled silently - no UI interruption
    }
  });

  // ============================================================================
  // EXPOSE wsRaisedHands TO PARENT
  // ============================================================================
  
  React.useEffect(() => {
    if (onRaisedHandsChange) {
      onRaisedHandsChange(wsRaisedHands);
    }
  }, [wsRaisedHands, onRaisedHandsChange]);

  // ============================================================================
  // HAND RAISE TOGGLE HANDLER
  // ============================================================================
  
  const handleRaiseHand = useCallback(async () => {
    try {
      // Validation checks
      if (!currentParticipant?._id) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No participant found. Please refresh the page.'
        });
        return;
      }
      
      if (!socket || !isConnected) {
        Swal.fire({
          icon: 'error',
          title: 'Connection Error',
          text: 'Not connected to server. Please check your connection.'
        });
        return;
      }
      
      // Use WebSocket state as the source of truth
      if (wsMyHandRaised) {
        // Lower hand
        wsLowerHand();
        onHandRaiseStatusChange?.(currentParticipant._id, false);
      } else {
        // Raise hand
        wsRaiseHand();
        onHandRaiseStatusChange?.(currentParticipant._id, true);
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to toggle hand raise: ${(error as Error).message || 'Unknown error'}`
      });
    }
  }, [
    socket,
    isConnected,
    currentParticipant,
    wsMyHandRaised,
    wsRaiseHand,
    wsLowerHand,
    onHandRaiseStatusChange
  ]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  
  const renderButton = () => {
    if (mode === 'indicator') return null;
    
    return (
      <button
        onClick={handleRaiseHand}
        disabled={isLoading}
        style={{
          width: isMobile ? '40px' : '48px',
          height: isMobile ? '40px' : '48px',
          borderRadius: '50%',
          backgroundColor: wsMyHandRaised ? '#f59e0b' : '#f3f4f6',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          color: wsMyHandRaised ? 'white' : '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          animation: wsMyHandRaised ? 'pulse 1.5s infinite' : 'none',
          opacity: isLoading ? 0.6 : 1,
        }}
        title={`Hand ${wsMyHandRaised ? 'raised' : 'lowered'} - Click to toggle`}
        aria-label={wsMyHandRaised ? 'Lower hand' : 'Raise hand'}
        aria-pressed={wsMyHandRaised}
      >
        <svg 
          width={isMobile ? "18" : "20"} 
          height={isMobile ? "18" : "20"} 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/>
        </svg>
      </button>
    );
  };

  const renderHostNotification = () => {
    if (!isHost || mode === 'button') return null;
    
    return (
      <>
        {/* ✅ REMOVED: Orange hand raised count badge - too distracting */}
        
        {/* Current hand raise message - Keep this minimal notification */}
        {currentHandRaiseMessage && (
          <div style={{
            position: 'absolute',
            top: '60px',
            right: '16px',
            padding: '12px 20px',
            backgroundColor: 'rgba(59, 130, 246, 0.95)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: 10,
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            animation: 'slideInRight 0.3s ease'
          }}>
            {currentHandRaiseMessage}
          </div>
        )}
      </>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <>
      {renderButton()}
      {renderHostNotification()}
    </>
  );
};

// ============================================================================
// HELPER HOOK: Enhanced Participants with Hand Raise Status
// ============================================================================

export const useParticipantsWithHandRaise = (
  participants: any[],
  wsRaisedHands: HandRaiseInfo[]
) => {
  return useMemo(() => {
    const enhancedParticipants = participants.map(participant => {
      const hasHandRaised = wsRaisedHands.some(
        hand => hand.userId === participant._id
      ) || false;
      
      return {
        ...participant,
        hasHandRaised
      };
    });
    
    // Sort to put HOST first
    return enhancedParticipants.sort((a, b) => {
      if (a.role === 'HOST') return -1;
      if (b.role === 'HOST') return 1;
      return 0;
    });
  }, [participants, wsRaisedHands]);
};

// ============================================================================
// EXPORTS
// ============================================================================

export default HandRaiseIndicator;

