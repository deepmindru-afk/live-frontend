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
  // ✅ DEBUG: Log component mount - ALWAYS log to catch issues
  useEffect(() => {
  }, [mode, socket, isConnected, meetingId, currentParticipant, isHost]);
  
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [handRaiseQueue, setHandRaiseQueue] = useState<any[]>([]);
  const [currentHandRaiseMessage, setCurrentHandRaiseMessage] = useState<string | null>(null);

  // ============================================================================
  // WEBSOCKET HAND RAISE HOOK
  // ============================================================================
  
  // ✅ CRITICAL: Normalize participant ID to string to ensure consistent matching
  const participantId = String(currentParticipant?._id || '').trim();
  
  
  const {
    raisedHands: wsRaisedHands,
    myHandRaised: wsMyHandRaised,
    raiseHand: wsRaiseHand,
    lowerHand: wsLowerHand,
    isLoading,
  } = useWebSocketHandRaise({
    meetingId: meetingId || '',
    userId: participantId,
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
        setCurrentHandRaiseMessage(`${info.displayName}님이 손을 들었습니다`);
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
          title: '손이 자동으로 내려갔습니다',
          text: '1분이 지나 손이 자동으로 내려갔습니다.',
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
          title: '손이 내려갔습니다',
          text: '호스트가 손을 내렸습니다.',
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
          title: '모든 손이 내려갔습니다',
          text: '호스트가 모든 손을 내렸습니다.',
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
          title: '오류',
          text: '참가자를 찾을 수 없습니다. 페이지를 새로고침해 주세요.'
        });
        return;
      }
      
      if (!socket || !isConnected) {
        Swal.fire({
          icon: 'error',
          title: '연결 오류',
          text: '서버에 연결되어 있지 않습니다. 네트워크 상태를 확인해 주세요.'
        });
        return;
      }
      
      
      // ✅ CRITICAL FIX: Always use the latest state value, don't rely on closure
      // Get fresh state value at click time
      const currentState = wsMyHandRaised;
      
      
      // ✅ ALWAYS try to toggle - let backend handle validation
      if (currentState) {
        // Current state says raised, so try to lower
        try {
          wsLowerHand();
        } catch (err) {
        }
      } else {
        // Current state says not raised, so try to raise
        try {
          wsRaiseHand();
        } catch (err) {
        }
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: `손 들기 상태를 변경하지 못했습니다: ${(error as Error).message || '알 수 없는 오류'}`
      });
    }
  }, [
    socket,
    isConnected,
    currentParticipant,
    wsMyHandRaised,
    wsRaiseHand,
    wsLowerHand,
    isLoading
  ]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  
  const renderButton = () => {
    if (mode === 'indicator') {
      return null;
    }
    
    // ✅ Force log state on every render
    
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleRaiseHand();
        }}
        disabled={isLoading}
        onMouseEnter={() => {
          // ✅ DEBUG: Force log state on hover
        }}
        style={{
          width: isMobile ? '40px' : '48px',
          height: isMobile ? '40px' : '48px',
          borderRadius: '50%',
          backgroundColor: wsMyHandRaised ? '#f59e0b' : '#f3f4f6',
          border: wsMyHandRaised ? '2px solid #f59e0b' : '2px solid transparent',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          color: wsMyHandRaised ? 'white' : '#6b7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: wsMyHandRaised ? '0 4px 12px rgba(245, 158, 11, 0.4)' : '0 2px 8px rgba(0,0,0,0.15)',
          animation: wsMyHandRaised ? 'pulse 1.5s infinite' : 'none',
          opacity: isLoading ? 0.6 : 1,
        }}
        title={`손 ${wsMyHandRaised ? '내림' : '듦'} - 클릭하여 ${wsMyHandRaised ? '내리기' : '들기'}`}
        aria-label={wsMyHandRaised ? '손 내리기' : '손 들기'}
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
  
  useEffect(() => {
  });
  
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

