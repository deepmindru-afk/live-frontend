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
      return;
    }


    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    // Send heartbeat immediately
    sendHeartbeat();

    // Set up interval to send heartbeat every 10 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, 30000); // 10 seconds

    setIsPresenceActive(true);
  }, [socket, isConnected, meetingId]);

  // Stop heartbeat system
  const stopHeartbeat = useCallback(() => {

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
      return;
    }

    try {
      socket.emit('HEARTBEAT', { meetingId });
      
      // Set up timeout to detect if heartbeat is not acknowledged
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }

      heartbeatTimeoutRef.current = setTimeout(() => {
        onHeartbeatTimeout?.();
      }, 15000); // 15 second timeout for heartbeat acknowledgment

    } catch (error) {
      onError?.(`Failed to send heartbeat: ${(error as Error).message}`);
    }
  }, [socket, isConnected, meetingId, onHeartbeatTimeout, onError]);

  // Join meeting (send JOIN_MEETING event)
  const joinMeeting = useCallback(() => {
    if (!socket || !isConnected || !meetingId) {
      return;
    }

    try {
      socket.emit('JOIN_MEETING', { meetingId });
      
      // Start heartbeat after joining
      startHeartbeat();
    } catch (error) {
      onError?.(`Failed to join meeting: ${(error as Error).message}`);
    }
  }, [socket, isConnected, meetingId, startHeartbeat, onError]);

  // Leave meeting (send LEAVE_MEETING event)
  const leaveMeeting = useCallback(() => {
    if (!socket || !isConnected || !meetingId) {
      return;
    }

    try {
      socket.emit('LEAVE_MEETING', { meetingId });
      
      // Stop heartbeat when leaving
      stopHeartbeat();
    } catch (error) {
      onError?.(`Failed to leave meeting: ${(error as Error).message}`);
    }
  }, [socket, isConnected, meetingId, stopHeartbeat, onError]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleMeetingJoinSuccess = (data: any) => {
      setLastHeartbeat(new Date());
      onPresenceUpdate?.({
        meetingId: data.meetingId,
        userId: data.userId,
        lastSeenAt: new Date(),
        status: 'connected'
      });
    };

    const handleMeetingLeaveSuccess = (data: any) => {
      onPresenceUpdate?.({
        meetingId: data.meetingId,
        userId: data.userId,
        lastSeenAt: new Date(),
        status: 'disconnected'
      });
    };

    const handleHeartbeatAck = (data: any) => {
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
      joinMeeting();
    } else if (!isConnected && isPresenceActive) {
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
