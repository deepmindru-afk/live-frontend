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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // Get token from localStorage if not provided
    const authToken = token || localStorage.getItem('token');
    
    console.log('🔌 connect() called:', { 
      meetingId, 
      token: authToken ? 'present' : 'missing', 
      tokenLength: authToken?.length || 0,
      tokenPreview: authToken ? authToken.substring(0, 20) + '...' : 'none',
      socket: !!socket,
      socketConnected: socket?.connected
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

    try {
      console.log('🔌 Creating new socket connection...', {
        url: 'http://localhost:3007/signaling',
        token: authToken ? 'present' : 'missing',
        tokenLength: authToken?.length || 0
      });
      
      const newSocket = io('http://localhost:3007/signaling', {
        auth: {
          token: authToken,
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
      
      // Clean up heartbeat interval on disconnect
      if ((newSocket as any).heartbeatInterval) {
        clearInterval((newSocket as any).heartbeatInterval);
        (newSocket as any).heartbeatInterval = null;
      }
      
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
      
      // FIXED: Use new presence system instead of old events
      console.log('📤 Joining meeting with new presence system...');
      newSocket.emit('JOIN_MEETING', { meetingId });
      
          // Start heartbeat system - HYBRID APPROACH: Every 5 seconds for best balance
          const heartbeatInterval = setInterval(() => {
            if (newSocket.connected) {
              console.log('💓 Sending heartbeat...');
              newSocket.emit('HEARTBEAT', { meetingId });
            } else {
              clearInterval(heartbeatInterval);
            }
          }, 5000); // Every 5 seconds - HYBRID: Fast detection + Smart DB updates
      
      // Store interval for cleanup
      (newSocket as any).heartbeatInterval = heartbeatInterval;
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

    // Add heartbeat acknowledgment listener
    newSocket.on('HEARTBEAT_ACK', (data) => {
      console.log('💓 Heartbeat acknowledged:', data);
    });

    // Add meeting join success listener
    newSocket.on('MEETING_JOIN_SUCCESS', (data) => {
      console.log('✅ Meeting join successful:', data);
    });

    // Add meeting event listeners for participant management
    newSocket.on('PARTICIPANT_JOINED', (participant) => {
      console.log('👤 Participant joined meeting:', participant);
      onParticipantJoined?.(participant);
    });

    newSocket.on('PARTICIPANT_LEFT', (data) => {
      console.log('👤 Participant left meeting:', data);
      onParticipantLeft?.(data);
    });

    newSocket.on('NEW_MESSAGE', (message) => {
      console.log('💬 New meeting message:', message);
      // Handle as chat message
      setMessages(prev => [...prev, message]);
      onMessage?.(message);
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
