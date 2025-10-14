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
  token?: string;
  onMessage?: (message: ChatMessage) => void;
  onParticipantJoined?: (participant: any) => void;
  onParticipantLeft?: (data: any) => void;
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
  console.log('🔌 useWebSocketChat hook called:', { 
    meetingId, 
    token: token ? 'provided' : 'not provided',
    hasOnMessage: !!onMessage,
    hasOnParticipantJoined: !!onParticipantJoined,
    hasOnParticipantLeft: !!onParticipantLeft,
    hasOnError: !!onError
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Use refs to store callbacks to prevent infinite re-renders
  const callbacksRef = useRef({
    onMessage,
    onParticipantJoined,
    onParticipantLeft,
    onError
  });
  
  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onParticipantJoined,
      onParticipantLeft,
      onError
    };
  }, [onMessage, onParticipantJoined, onParticipantLeft, onError]);

  const connect = useCallback(() => {
    // Get token from localStorage if not provided - check both 'jwt' and 'token' keys
    const authToken = token || localStorage.getItem('jwt') || localStorage.getItem('token');
    
    console.log('🔌 connect() called:', { 
      meetingId, 
      token: authToken ? 'present' : 'missing', 
      tokenLength: authToken?.length || 0,
      tokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none',
      socket: !!socket,
      socketConnected: socket?.connected,
      jwtToken: localStorage.getItem('jwt') ? 'present' : 'missing',
      tokenKey: localStorage.getItem('token') ? 'present' : 'missing',
      allKeys: Object.keys(localStorage).filter(key => key.includes('token') || key.includes('jwt'))
    });
    
    if (socket?.connected) {
      console.log('🔌 Already connected, skipping');
      return;
    }

    // Don't connect if no token
    if (!authToken || authToken.trim() === '') {
      console.warn('⚠️ No JWT token provided, skipping WebSocket connection', { 
        token: authToken, 
        meetingId,
        tokenType: typeof authToken,
        tokenLength: authToken?.length || 0
      });
      setError('No authentication token provided');
      return;
    }

    console.log('🔌 Creating new WebSocket connection...');

    try {
      // PRODUCTION FIX: Use environment variable for backend URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007';
      const wsUrl = `${backendUrl}/signaling`;
      
      console.log('🔌 Creating new socket connection...', {
        url: wsUrl,
        backendUrl,
        environment: process.env.NODE_ENV,
        token: authToken ? 'present' : 'missing',
        tokenLength: authToken?.length || 0
      });
      
      const newSocket = io(wsUrl, {
        auth: {
          token: authToken,
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        // Production optimizations
        path: '/socket.io/',
        secure: backendUrl.startsWith('https'),
        rejectUnauthorized: false, // Set to true in production with valid SSL
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
      
      // Clean up heartbeat interval on disconnect
      if ((newSocket as any).heartbeatInterval) {
        clearInterval((newSocket as any).heartbeatInterval);
        (newSocket as any).heartbeatInterval = null;
      }
      
      // Attempt to reconnect if not manually disconnected - IMPROVED with better error handling
      if (reason !== 'io client disconnect' && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached, giving up');
        setError('Connection failed after multiple attempts. Please refresh the page.');
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
      callbacksRef.current.onError?.(errorMessage);
    });

    newSocket.on('ERROR', (data) => {
      console.error('❌ Chat WebSocket server error:', data);
      const errorMessage = `Server error: ${data.message || 'Unknown server error'}`;
      setError(errorMessage);
      callbacksRef.current.onError?.(errorMessage);
    });

    newSocket.on('CONNECTION_SUCCESS', (data) => {
      console.log('✅ Chat WebSocket connection successful:', data);
      setError(null);
      
      // Now that authentication is complete, join the chat room
      console.log('📤 Joining chat room after successful authentication...');
      newSocket.emit('JOIN_CHAT_ROOM', { meetingId });
      
      // FIXED: Use new presence system instead of old events
      console.log('📤 Joining meeting with new presence system...', { meetingId, socketId: newSocket.id });
      
      // Add a small delay to ensure connection is fully established
      setTimeout(() => {
        console.log('📤 Emitting JOIN_MEETING event after delay...', { meetingId, socketId: newSocket.id, connected: newSocket.connected });
        
        // Test with a simple event first
        newSocket.emit('TEST_EVENT', { message: 'test', meetingId });
        console.log('📤 TEST_EVENT emitted');
        
        // Then emit the actual JOIN_MEETING event
        newSocket.emit('JOIN_MEETING', { meetingId });
        console.log('📤 JOIN_MEETING event emitted successfully');
      }, 1000); // 1 second delay
      
          // Start heartbeat system - OPTIMIZED: Every 10 seconds for better performance
          console.log('💓 Setting up heartbeat interval...');
          
          // Send immediate heartbeat
          setTimeout(() => {
            if (newSocket.connected && meetingId) {
              console.log('💓 Sending INITIAL heartbeat...', { meetingId, socketId: newSocket.id });
              newSocket.emit('HEARTBEAT', { meetingId });
            }
          }, 2000);
          
          const heartbeatInterval = setInterval(() => {
            if (newSocket.connected && meetingId) {
              console.log('💓 Sending heartbeat...', { meetingId, socketId: newSocket.id, connected: newSocket.connected, timestamp: new Date().toISOString() });
              newSocket.emit('HEARTBEAT', { meetingId });
            } else {
              console.log('❌ Socket not connected or no meetingId, heartbeat skipped', { 
                connected: newSocket.connected, 
                meetingId: !!meetingId 
              });
            }
          }, 10000); // Every 10 seconds - OPTIMIZED: Reduced frequency for better performance
      
      // Store interval for cleanup
      (newSocket as any).heartbeatInterval = heartbeatInterval;
      console.log('✅ Heartbeat interval created and stored');
    });

    newSocket.on('CHAT_MESSAGE', (message: ChatMessage) => {
      console.log('📨 Received chat message:', message);
      setMessages(prev => [...prev, message]);
      callbacksRef.current.onMessage?.(message);
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

    // Add heartbeat acknowledgment listener
    newSocket.on('HEARTBEAT_ACK', (data) => {
      console.log('💓 Heartbeat acknowledged:', data);
      if (data.dbUpdated) {
        console.log('✅ Database updated with heartbeat');
      } else {
        console.log('⏭️ Database update optimized (throttled for performance)');
      }
    });

    newSocket.on('MEETING_JOIN_SUCCESS', (data) => {
      console.log('✅ Meeting join successful:', data);
    });

    // Add meeting event listeners for participant management
    newSocket.on('PARTICIPANT_JOINED', (participant) => {
      console.log('👤 Participant joined meeting:', participant);
      callbacksRef.current.onParticipantJoined?.(participant);
    });

    newSocket.on('PARTICIPANT_LEFT', (data) => {
      console.log('👤 Participant left meeting:', data);
      callbacksRef.current.onParticipantLeft?.(data);
    });

    newSocket.on('NEW_MESSAGE', (message) => {
      console.log('💬 New meeting message:', message);
      // Handle as chat message
      setMessages(prev => [...prev, message]);
      callbacksRef.current.onMessage?.(message);
    });

      console.log('🔌 Setting socket state:', { 
        socketId: newSocket.id, 
        connected: newSocket.connected 
      });
      setSocket(newSocket);
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setError('Failed to create WebSocket connection');
      callbacksRef.current.onError?.('Failed to create WebSocket connection');
    }
  }, [meetingId, token]); // FIXED: Removed callback dependencies to prevent infinite re-renders

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      console.log('🔌 Disconnecting and cleaning up event listeners');
      
      // Send leave meeting event for presence system
      socket.emit('LEAVE_MEETING', { meetingId });
      
      // Clean up heartbeat interval
      if ((socket as any).heartbeatInterval) {
        clearInterval((socket as any).heartbeatInterval);
        (socket as any).heartbeatInterval = null;
      }
      
      socket.emit('LEAVE_CHAT_ROOM', { meetingId });
      
      // CRITICAL: Remove all event listeners before disconnecting
      socket.removeAllListeners();
      
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket, meetingId]); // FIXED: Keep only essential dependencies

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

  // Note: joinMeetingRoom and joinHostMeetingRoom are now handled automatically
  // by the new presence system when the WebSocket connects

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

    // Only disconnect if we're actually changing the connection parameters
    return () => {
      if (socket && isConnected) {
        console.log('🔌 Cleaning up previous connection due to dependency change');
        disconnect();
      }
    };
  }, [meetingId, token]); // Keep dependencies but handle cleanup more carefully

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, []); // Remove disconnect from dependencies to prevent infinite re-renders

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
  };
};
