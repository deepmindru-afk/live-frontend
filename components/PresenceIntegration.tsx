import React, { useEffect, useState } from 'react';
import { usePresence } from '../hooks/usePresence';
import { useWebSocketChat } from '../hooks/useWebSocketChat';

interface PresenceIntegrationProps {
  meetingId: string;
  userId: string;
  token: string;
}

/**
 * Example component showing how to integrate presence system
 * This component should be included in meeting pages to handle participant presence
 */
export const PresenceIntegration: React.FC<PresenceIntegrationProps> = ({
  meetingId,
  userId,
  token,
}) => {
  const [presenceStatus, setPresenceStatus] = useState<'connected' | 'disconnected' | 'heartbeat_timeout'>('disconnected');

  // Initialize WebSocket connection for chat and presence
  const {
    socket,
    isConnected,
    error: chatError,
  } = useWebSocketChat({
    meetingId,
    token,
    onError: (error) => {
      console.error('[PRESENCE_INTEGRATION] Chat error:', error);
    },
  });

  // Initialize presence system
  const {
    isPresenceActive,
    lastHeartbeat,
    joinMeeting,
    leaveMeeting,
  } = usePresence({
    socket,
    isConnected,
    meetingId,
    userId,
    onPresenceUpdate: (data) => {
      console.log('[PRESENCE_INTEGRATION] Presence updated:', data);
      setPresenceStatus('connected');
    },
    onHeartbeatTimeout: () => {
      console.warn('[PRESENCE_INTEGRATION] Heartbeat timeout detected');
      setPresenceStatus('heartbeat_timeout');
    },
    onError: (error) => {
      console.error('[PRESENCE_INTEGRATION] Presence error:', error);
      setPresenceStatus('disconnected');
    },
  });

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[PRESENCE_INTEGRATION] Page hidden - presence will continue via heartbeat');
      } else {
        console.log('[PRESENCE_INTEGRATION] Page visible - presence active');
      }
    };

    const handleBeforeUnload = () => {
      console.log('[PRESENCE_INTEGRATION] Page unloading - leaving meeting');
      leaveMeeting();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [leaveMeeting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[PRESENCE_INTEGRATION] Component unmounting - leaving meeting');
      leaveMeeting();
    };
  }, [leaveMeeting]);

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '10px', 
      right: '10px', 
      padding: '8px 12px', 
      backgroundColor: presenceStatus === 'connected' ? '#10b981' : presenceStatus === 'heartbeat_timeout' ? '#f59e0b' : '#ef4444',
      color: 'white',
      borderRadius: '6px',
      fontSize: '12px',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: presenceStatus === 'connected' ? '#ffffff' : 'rgba(255,255,255,0.5)',
        animation: presenceStatus === 'connected' ? 'pulse 2s infinite' : 'none'
      }} />
      <span>
        {presenceStatus === 'connected' ? 'Connected' : 
         presenceStatus === 'heartbeat_timeout' ? 'Connection Issues' : 'Disconnected'}
      </span>
      {lastHeartbeat && (
        <span style={{ opacity: 0.7, fontSize: '10px' }}>
          {new Date(lastHeartbeat).toLocaleTimeString()}
        </span>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

/**
 * Hook for easy presence integration in meeting components
 */
export const useMeetingPresence = (meetingId: string, userId: string, token: string) => {
  const [isPresent, setIsPresent] = useState(false);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);

  const {
    socket,
    isConnected,
  } = useWebSocketChat({
    meetingId,
    token,
  });

  const {
    isPresenceActive,
    lastHeartbeat,
  } = usePresence({
    socket,
    isConnected,
    meetingId,
    userId,
    onPresenceUpdate: (data) => {
      setIsPresent(true);
      setLastSeen(new Date());
    },
    onHeartbeatTimeout: () => {
      setIsPresent(false);
    },
    onDisconnected: () => {
      setIsPresent(false);
    },
  });

  return {
    isPresent,
    lastSeen,
    isConnected,
    isPresenceActive,
    lastHeartbeat,
  };
};
