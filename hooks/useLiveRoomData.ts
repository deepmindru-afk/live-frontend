import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface LiveRoomData {
  meeting: any;
  participants: any[];
  waitingParticipants: any[];
  chatMessages: any[];
  recording: any;
  stats: any;
  loading: boolean;
  error: any;
  socket: Socket | null;
  isConnected: boolean;
}

export const useLiveRoomData = (meetingId: string): LiveRoomData => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  
  // State for real-time data
  const [meeting, setMeeting] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [recording, setRecording] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!meetingId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      setLoading(false);
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007';
    // FIXED: WebSocket connection is handled by useWebSocketChat hook
    // This prevents duplicate connections and heartbeat conflicts
    const newSocket = null; // Disabled to prevent duplicate connections

    // Connection events
    newSocket.on('connect', () => {
      console.log('[WEBSOCKET] Connected to signaling server');
      setIsConnected(true);
      setLoading(false);
      
      // Join the meeting room
      newSocket.emit('JOIN_MEETING', { meetingId });
    });

    newSocket.on('disconnect', () => {
      console.log('[WEBSOCKET] Disconnected from signaling server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[WEBSOCKET] Connection error:', error);
      setError(error);
      setLoading(false);
    });

    // Real-time event listeners
    newSocket.on('PARTICIPANT_JOINED', (participant) => {
      console.log('[WEBSOCKET] Participant joined:', participant);
      setParticipants(prev => {
        const exists = prev.find(p => p._id === participant._id);
        if (exists) {
          console.log('[WEBSOCKET] Participant already exists, skipping duplicate');
          return prev;
        }
        const newParticipants = [...prev, participant];
        console.log('[WEBSOCKET] Participants after join:', newParticipants.length);
        return newParticipants;
      });
    });

    newSocket.on('PARTICIPANT_LEFT', (data) => {
      console.log('[WEBSOCKET] Participant left:', data);
      setParticipants(prev => {
        const filtered = prev.filter(p => p._id !== data.userId);
        console.log('[WEBSOCKET] Participants after left:', filtered.length);
        return filtered;
      });
    });

    newSocket.on('PARTICIPANT_UPDATED', (participant) => {
      console.log('[WEBSOCKET] Participant updated:', participant);
      setParticipants(prev => {
        const updated = prev.map(p => {
          if (p._id === participant._id) {
            console.log('[WEBSOCKET] Updating participant:', participant._id);
            return { ...p, ...participant }; // Merge to preserve reference equality
          }
          return p;
        });
        return updated;
      });
    });

    newSocket.on('WAITING_PARTICIPANT_ADDED', (participant) => {
      console.log('[WEBSOCKET] Waiting participant added:', participant);
      setWaitingParticipants(prev => [...prev, participant]);
    });

    newSocket.on('WAITING_PARTICIPANT_REMOVED', (data) => {
      console.log('[WEBSOCKET] Waiting participant removed:', data);
      setWaitingParticipants(prev => prev.filter(p => p._id !== data.participantId));
    });

    newSocket.on('NEW_MESSAGE', (message) => {
      console.log('[WEBSOCKET] New chat message:', message);
      setChatMessages(prev => [...prev, message]);
    });

    newSocket.on('MEETING_STARTED', (meetingData) => {
      console.log('[WEBSOCKET] Meeting started:', meetingData);
      setMeeting(meetingData);
    });

    newSocket.on('MEETING_ENDED', (meetingData) => {
      console.log('[WEBSOCKET] Meeting ended:', meetingData);
      setMeeting(meetingData);
    });

    newSocket.on('CHAT_ERROR', (error) => {
      console.error('[WEBSOCKET] Chat error:', error);
      setError(error);
    });

    newSocket.on('ERROR', (error) => {
      console.error('[WEBSOCKET] General error:', error);
      setError(error);
    });

    newSocket.on('HEARTBEAT_ACK', (data) => {
      console.log('[WEBSOCKET] Heartbeat acknowledged:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [meetingId]);

  return {
    meeting,
    participants,
    waitingParticipants,
    chatMessages,
    recording,
    stats,
    loading,
    error,
    socket,
    isConnected
  };
};