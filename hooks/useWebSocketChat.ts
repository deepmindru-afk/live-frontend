import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  _id: string;
  meetingId: string;
  text: string;
  displayName: string;
  userId: string;
  replyToMessageId?: string;
  createdAt: string;
}

interface ChatParticipant {
  userId: string;
  displayName: string;
  socketId: string;
}

interface UseWebSocketChatProps {
  meetingId: string;
  token: string;
  onMessage?: (message: ChatMessage) => void;
  onParticipantJoined?: (participant: ChatParticipant) => void;
  onParticipantLeft?: (participant: ChatParticipant) => void;
  onError?: (error: string) => void;
}

export const useWebSocketChat = ({
  meetingId,
  token,
  onMessage,
  onParticipantJoined,
  onParticipantLeft,
  onError,
}: UseWebSocketChatProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    console.log('🔌 connect() called:', { 
      meetingId, 
      token: token ? 'present' : 'missing', 
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      socket: !!socket,
      socketConnected: socket?.connected
    });
    
    if (socket?.connected) {
      console.log('🔌 Already connected, skipping');
      return;
    }

    // Don't connect if no token
    if (!token || token.trim() === '') {
      console.warn('⚠️ No JWT token provided, skipping WebSocket connection', { 
        token, 
        meetingId,
        tokenType: typeof token,
        tokenLength: token?.length || 0
      });
      setError('No authentication token provided');
      return;
    }

    try {
      console.log('🔌 Creating new socket connection...', {
        url: 'http://localhost:3007/signaling',
        token: token ? 'present' : 'missing',
        tokenLength: token?.length || 0
      });
      
      const newSocket = io('http://localhost:3007/signaling', {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });
      
      console.log('🔌 Socket created:', { 
        socketId: newSocket.id, 
        connected: newSocket.connected,
        transport: newSocket.io.engine?.transport?.name
      });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to chat WebSocket');
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      
      // Don't join chat room immediately - wait for authentication to complete
      console.log('🔌 Waiting for authentication to complete...');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from chat WebSocket:', reason);
      setIsConnected(false);
      
      // Attempt to reconnect if not manually disconnected
      if (reason !== 'io client disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Chat WebSocket connection error:', error);
      console.error('❌ Connection error details:', { 
        message: error.message, 
        description: (error as any).description, 
        context: (error as any).context, 
        type: (error as any).type,
        token: token ? 'present' : 'missing'
      });
      const errorMessage = `Failed to connect to chat server: ${error.message || 'Unknown error'}`;
      setError(errorMessage);
      onError?.(errorMessage);
    });

    newSocket.on('ERROR', (data) => {
      console.error('❌ Chat WebSocket server error:', data);
      const errorMessage = `Server error: ${data.message || 'Unknown server error'}`;
      setError(errorMessage);
      onError?.(errorMessage);
    });

    newSocket.on('CONNECTION_SUCCESS', (data) => {
      console.log('✅ Chat WebSocket connection successful:', data);
      setError(null);
      
      // Now that authentication is complete, join the chat room
      console.log('📤 Joining chat room after successful authentication...');
      newSocket.emit('JOIN_CHAT_ROOM', { meetingId });
      
      // Also join the meeting room for hand raise events
      console.log('📤 Joining meeting room for hand raise events...');
      newSocket.emit('PARTICIPANT_JOIN_MEETING', { 
        meetingId, 
        participantId: data.participantId || 'unknown' 
      });
    });

    newSocket.on('CHAT_MESSAGE', (message: ChatMessage) => {
      console.log('📨 Received chat message:', message);
      setMessages(prev => [...prev, message]);
      onMessage?.(message);
    });

    newSocket.on('CHAT_MESSAGE_DELETED', (data) => {
      console.log('🗑️ Message deleted:', data);
      setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
    });

    newSocket.on('KICKED', (data) => {
      console.log('👢 User was kicked from meeting:', data);
      // Redirect to dashboard when kicked
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    });

    newSocket.on('USER_JOINED_CHAT', (participant: ChatParticipant) => {
      console.log('👤 User joined chat:', participant);
      setParticipants(prev => {
        const exists = prev.find(p => p.userId === participant.userId);
        if (exists) return prev;
        return [...prev, participant];
      });
      onParticipantJoined?.(participant);
    });

    newSocket.on('USER_LEFT_CHAT', (participant: ChatParticipant) => {
      console.log('👤 User left chat:', participant);
      setParticipants(prev => prev.filter(p => p.userId !== participant.userId));
      onParticipantLeft?.(participant);
    });

    newSocket.on('CHAT_PEER_LIST', (data) => {
      console.log('👥 Chat participants:', data.participants);
      setParticipants(data.participants);
    });

    newSocket.on('CHAT_MESSAGES_LOADED', (data: { messages: ChatMessage[] }) => {
      console.log('📚 Loaded existing messages:', data.messages.length);
      setMessages(data.messages || []);
    });    

    newSocket.on('PONG', (data) => {
      console.log('🏓 Pong received:', data);
    });

      console.log('🔌 Setting socket state:', { 
        socketId: newSocket.id, 
        connected: newSocket.connected 
      });
      setSocket(newSocket);
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setError('Failed to create WebSocket connection');
      onError?.('Failed to create WebSocket connection');
    }
  }, [meetingId, token, onMessage, onParticipantJoined, onParticipantLeft, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      socket.emit('LEAVE_CHAT_ROOM', { meetingId });
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket, meetingId]);

  const sendMessage = useCallback((message: string, replyToMessageId?: string) => {
    console.log('🚀 sendMessage called:', { message, meetingId, isConnected, socket: !!socket });
    if (socket && isConnected) {
      console.log('📤 Emitting CHAT_SEND:', { roomName: meetingId, message, replyToMessageId });
      socket.emit('CHAT_SEND', {
        roomName: meetingId,
        message,
        replyToMessageId,
      });
    } else {
      console.error('❌ Cannot send message: not connected to chat');
      setError('Not connected to chat server');
    }
  }, [socket, isConnected, meetingId]);

  const deleteMessage = useCallback((messageId: string) => {
    if (socket && isConnected) {
      socket.emit('DELETE_CHAT_MESSAGE', {
        meetingId,
        messageId,
      });
    } else {
      console.error('❌ Cannot delete message: not connected to chat');
      setError('Not connected to chat server');
    }
  }, [socket, isConnected, meetingId]);

  const ping = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('PING');
    }
  }, [socket, isConnected]);

  const joinMeetingRoom = useCallback((meetingId: string, participantId: string) => {
    try {
      if (socket && isConnected) {
        console.log('📤 Joining meeting room for hand raise events:', { meetingId, participantId });
        socket.emit('PARTICIPANT_JOIN_MEETING', { meetingId, participantId });
      } else {
        console.error('❌ Cannot join meeting room: not connected to chat', {
          socket: !!socket,
          isConnected,
          meetingId,
          participantId
        });
        setError('Cannot join meeting room: WebSocket not connected');
      }
    } catch (error) {
      console.error('❌ Error joining meeting room:', error);
      setError(`Failed to join meeting room: ${(error as Error).message || 'Unknown error'}`);
    }
  }, [socket, isConnected]);

  const joinHostMeetingRoom = useCallback((meetingId: string) => {
    try {
      if (socket && isConnected) {
        console.log('📤 Host joining meeting room for hand raise events:', { meetingId });
        socket.emit('HOST_JOIN_MEETING', { meetingId });
      } else {
        console.error('❌ Cannot join meeting room as host: not connected to chat', {
          socket: !!socket,
          isConnected,
          meetingId
        });
        setError('Cannot join meeting room as host: WebSocket not connected');
      }
    } catch (error) {
      console.error('❌ Error joining meeting room as host:', error);
      setError(`Failed to join meeting room as host: ${(error as Error).message || 'Unknown error'}`);
    }
  }, [socket, isConnected]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    console.log('🔌 useEffect triggered:', { 
      meetingId, 
      token: token ? 'present' : 'missing',
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      socket: !!socket,
      isConnected,
      willConnect: !!(meetingId && token)
    });
    
    if (meetingId && token) {
      console.log('🔌 Connecting to WebSocket with token:', token.substring(0, 20) + '...');
      connect();
    } else {
      console.log('🔌 Not connecting - missing requirements:', { 
        meetingId: !!meetingId, 
        token: !!token,
        tokenValue: token
      });
    }

    return () => {
      disconnect();
    };
  }, [meetingId, token]); // Remove connect and disconnect from dependencies to prevent re-renders

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    participants,
    messages,
    error,
    sendMessage,
    deleteMessage,
    ping,
    connect,
    disconnect,
    joinMeetingRoom,
    joinHostMeetingRoom,
  };
};
