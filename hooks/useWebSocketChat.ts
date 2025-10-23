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
    
    
    if (socket?.connected) {
      return;
    }

    // Don't connect if no token
    if (!authToken || authToken.trim() === '') {
      setError('No authentication token provided');
      return;
    }


    try {
      // PRODUCTION FIX: Use environment variable for backend URL
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007';
      const wsUrl = `${backendUrl}/signaling`;
      
      
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
      

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      
      // Don't join chat room immediately - wait for authentication to complete
    });

    newSocket.on('disconnect', (reason) => {
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
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Connection failed after multiple attempts. Please refresh the page.');
      }
    });

    newSocket.on('connect_error', (error) => {
      const errorMessage = `Failed to connect to chat server: ${error.message || 'Unknown error'}`;
      setError(errorMessage);
      callbacksRef.current.onError?.(errorMessage);
    });

    newSocket.on('ERROR', (data) => {
      const errorMessage = `Server error: ${data.message || 'Unknown server error'}`;
      setError(errorMessage);
      callbacksRef.current.onError?.(errorMessage);
    });

    newSocket.on('CONNECTION_SUCCESS', (data) => {
      setError(null);
      
      // Now that authentication is complete, join the chat room
      newSocket.emit('JOIN_CHAT_ROOM', { meetingId });
      
      // FIXED: Use new presence system instead of old events
      
      // Add a small delay to ensure connection is fully established
      setTimeout(() => {
        
        // Test with a simple event first
        newSocket.emit('TEST_EVENT', { message: 'test', meetingId });
        
        // Then emit the actual JOIN_MEETING event
        newSocket.emit('JOIN_MEETING', { meetingId });
      }, 1000); // 1 second delay
      
          // Start heartbeat system - OPTIMIZED: Every 10 seconds for better performance
          
          // Send immediate heartbeat
          setTimeout(() => {
            if (newSocket.connected && meetingId) {
              newSocket.emit('HEARTBEAT', { meetingId });
            }
          }, 2000);
          
          const heartbeatInterval = setInterval(() => {
            if (newSocket.connected && meetingId) {
              newSocket.emit('HEARTBEAT', { meetingId });
            } else {
            }
          }, 10000); // Every 10 seconds - OPTIMIZED: Reduced frequency for better performance
      
      // Store interval for cleanup
      (newSocket as any).heartbeatInterval = heartbeatInterval;
    });

    // CRITICAL FIX: Store event handlers to prevent duplicate subscriptions
    const eventHandlers = {
      CHAT_MESSAGE: (message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
        callbacksRef.current.onMessage?.(message);
      },
      CHAT_MESSAGE_DELETED: (data: any) => {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      },
      KICKED: (data: any) => {
        // Redirect to dashboard when kicked
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      },
      USER_JOINED_CHAT: (participant: ChatParticipant) => {
        setParticipants(prev => {
          const exists = prev.find(p => p.userId === participant.userId);
          if (exists) return prev;
          return [...prev, participant];
        });
        callbacksRef.current.onParticipantJoined?.(participant);
      },
      USER_LEFT_CHAT: (participant: ChatParticipant) => {
        setParticipants(prev => prev.filter(p => p.userId !== participant.userId));
        callbacksRef.current.onParticipantLeft?.(participant);
      },
      CHAT_PEER_LIST: (data: any) => {
        setParticipants(data.participants);
      },
      CHAT_MESSAGES_LOADED: (data: { messages: ChatMessage[] }) => {
        setMessages(data.messages || []);
      },
      PONG: (data: any) => {
        // Heartbeat response
      },
      HEARTBEAT_ACK: (data: any) => {
        if (data.dbUpdated) {
          // Database updated
        } else {
          // No database update
        }
      },
      MEETING_JOIN_SUCCESS: (data: any) => {
        // Meeting join successful
      },
      PARTICIPANT_JOINED: (participant: any) => {
        callbacksRef.current.onParticipantJoined?.(participant);
      },
      PARTICIPANT_LEFT: (data: any) => {
        callbacksRef.current.onParticipantLeft?.(data);
      },
      NEW_MESSAGE: (message: any) => {
        // Handle as chat message
        setMessages(prev => [...prev, message]);
        callbacksRef.current.onMessage?.(message);
      }
    };

    // Register all event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      newSocket.on(event, handler);
    });

    // Store handlers for cleanup
    (newSocket as any).eventHandlers = eventHandlers;

      setSocket(newSocket);
    } catch (error) {
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
      
      // Send leave meeting event for presence system
      socket.emit('LEAVE_MEETING', { meetingId });
      
      // Clean up heartbeat interval
      if ((socket as any).heartbeatInterval) {
        clearInterval((socket as any).heartbeatInterval);
        (socket as any).heartbeatInterval = null;
      }
      
      socket.emit('LEAVE_CHAT_ROOM', { meetingId });
      
      // CRITICAL FIX: Remove specific event handlers to prevent duplicate subscriptions
      if ((socket as any).eventHandlers) {
        Object.entries((socket as any).eventHandlers).forEach(([event, handler]) => {
          socket.off(event, handler as any);
        });
        (socket as any).eventHandlers = null;
      }
      
      // Remove all remaining listeners as fallback
      socket.removeAllListeners();
      
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket, meetingId]); // FIXED: Keep only essential dependencies

  const sendMessage = useCallback((message: string, replyToMessageId?: string) => {
    if (socket && isConnected) {
      socket.emit('CHAT_SEND', {
        roomName: meetingId,
        message,
        replyToMessageId,
      });
    } else {
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
    
    if (meetingId && token) {
      connect();
    } else {
    }

    // CRITICAL FIX: Cleanup function to prevent duplicate subscriptions
    return () => {
      if (socket && isConnected) {
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
