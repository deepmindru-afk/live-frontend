import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface PresenceInfo {
  meetingId: string;
  userId: string;
  lastSeenAt: Date;
  status: 'connected' | 'disconnected' | 'heartbeat_timeout';
}

interface UsePresenceProps {
  socket: Socket | null;
  isConnected: boolean;
  meetingId: string;
  userId: string;
  onPresenceUpdate?: (info: PresenceInfo) => void;
  onHeartbeatTimeout?: () => void;
  onError?: (error: string) => void;
}

export const usePresence = ({
  socket,
  isConnected,
  meetingId,
  userId,
  onPresenceUpdate,
  onHeartbeatTimeout,
  onError,
}: UsePresenceProps) => {
  const [isPresenceActive, setIsPresenceActive] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send heartbeat every 10 seconds
  const startHeartbeat = useCallback(() => {
    if (!socket || !isConnected || !meetingId) {
      console.warn('[PRESENCE] Cannot start heartbeat: missing requirements', {
        socket: !!socket,
        isConnected,
        meetingId: !!meetingId
      });
      return;
    }

    console.log('[PRESENCE] Starting heartbeat system for meeting:', meetingId);

    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send heartbeat immediately
    sendHeartbeat();

    // Set up interval to send heartbeat every 10 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, 10000); // 10 seconds

    setIsPresenceActive(true);
  }, [socket, isConnected, meetingId]);

  // Stop heartbeat system
  const stopHeartbeat = useCallback(() => {
    console.log('[PRESENCE] Stopping heartbeat system');

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }

    setIsPresenceActive(false);
  }, []);

  // Send heartbeat to server
  const sendHeartbeat = useCallback(() => {
    if (!socket || !isConnected || !meetingId) {
      console.warn('[PRESENCE] Cannot send heartbeat: not connected');
      return;
    }

    try {
      console.log('[PRESENCE] Sending heartbeat for meeting:', meetingId);
      socket.emit('HEARTBEAT', { meetingId });
      
      // Set up timeout to detect if heartbeat is not acknowledged
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }

      heartbeatTimeoutRef.current = setTimeout(() => {
        console.warn('[PRESENCE] Heartbeat timeout - no acknowledgment received');
        onHeartbeatTimeout?.();
      }, 15000); // 15 second timeout for heartbeat acknowledgment

    } catch (error) {
      console.error('[PRESENCE] Error sending heartbeat:', error);
      onError?.(`Failed to send heartbeat: ${(error as Error).message}`);
    }
  }, [socket, isConnected, meetingId, onHeartbeatTimeout, onError]);

  // Join meeting (send JOIN_MEETING event)
  const joinMeeting = useCallback(() => {
    if (!socket || !isConnected || !meetingId) {
      console.warn('[PRESENCE] Cannot join meeting: not connected');
      return;
    }

    try {
      console.log('[PRESENCE] Joining meeting:', meetingId);
      socket.emit('JOIN_MEETING', { meetingId });
      
      // Start heartbeat after joining
      startHeartbeat();
    } catch (error) {
      console.error('[PRESENCE] Error joining meeting:', error);
      onError?.(`Failed to join meeting: ${(error as Error).message}`);
    }
  }, [socket, isConnected, meetingId, startHeartbeat, onError]);

  // Leave meeting (send LEAVE_MEETING event)
  const leaveMeeting = useCallback(() => {
    if (!socket || !isConnected || !meetingId) {
      console.warn('[PRESENCE] Cannot leave meeting: not connected');
      return;
    }

    try {
      console.log('[PRESENCE] Leaving meeting:', meetingId);
      socket.emit('LEAVE_MEETING', { meetingId });
      
      // Stop heartbeat when leaving
      stopHeartbeat();
    } catch (error) {
      console.error('[PRESENCE] Error leaving meeting:', error);
      onError?.(`Failed to leave meeting: ${(error as Error).message}`);
    }
  }, [socket, isConnected, meetingId, stopHeartbeat, onError]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleMeetingJoinSuccess = (data: any) => {
      console.log('[PRESENCE] Meeting join successful:', data);
      setLastHeartbeat(new Date());
      onPresenceUpdate?.({
        meetingId: data.meetingId,
        userId: data.userId,
        lastSeenAt: new Date(),
        status: 'connected'
      });
    };

    const handleMeetingLeaveSuccess = (data: any) => {
      console.log('[PRESENCE] Meeting leave successful:', data);
      onPresenceUpdate?.({
        meetingId: data.meetingId,
        userId: data.userId,
        lastSeenAt: new Date(),
        status: 'disconnected'
      });
    };

    const handleHeartbeatAck = (data: any) => {
      console.log('[PRESENCE] Heartbeat acknowledged:', data);
      setLastHeartbeat(new Date());
      
      // Clear heartbeat timeout since we got acknowledgment
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }

      onPresenceUpdate?.({
        meetingId: data.meetingId,
        userId,
        lastSeenAt: new Date(),
        status: 'connected'
      });
    };

    const handleError = (data: any) => {
      console.error('[PRESENCE] WebSocket error:', data);
      onError?.(data.message || 'WebSocket error occurred');
    };

    // Register event listeners
    socket.on('MEETING_JOIN_SUCCESS', handleMeetingJoinSuccess);
    socket.on('MEETING_LEAVE_SUCCESS', handleMeetingLeaveSuccess);
    socket.on('HEARTBEAT_ACK', handleHeartbeatAck);
    socket.on('ERROR', handleError);

    // Cleanup function
    return () => {
      socket.off('MEETING_JOIN_SUCCESS', handleMeetingJoinSuccess);
      socket.off('MEETING_LEAVE_SUCCESS', handleMeetingLeaveSuccess);
      socket.off('HEARTBEAT_ACK', handleHeartbeatAck);
      socket.off('ERROR', handleError);
    };
  }, [socket, userId, onPresenceUpdate, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  // Auto-start presence when socket connects
  useEffect(() => {
    if (isConnected && meetingId && userId && !isPresenceActive) {
      console.log('[PRESENCE] Socket connected, starting presence system');
      joinMeeting();
    } else if (!isConnected && isPresenceActive) {
      console.log('[PRESENCE] Socket disconnected, stopping presence system');
      stopHeartbeat();
    }
  }, [isConnected, meetingId, userId, isPresenceActive, joinMeeting, stopHeartbeat]);

  return {
    isPresenceActive,
    lastHeartbeat,
    joinMeeting,
    leaveMeeting,
    sendHeartbeat,
    startHeartbeat,
    stopHeartbeat,
  };
};
