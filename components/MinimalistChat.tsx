import React, { useState, useEffect, useRef } from 'react';
import { useWebSocketChat } from '../hooks/useWebSocketChat';

interface Message {
  _id: string;
  text: string;
  displayName: string;
  createdAt: string;
  userId?: string;
  type?: 'chat' | 'system' | 'join' | 'leave';
}

interface MinimalistChatProps {
  meetingId: string;
  currentUser: any;
  isHost: boolean;
  token: string;
  participants?: any[];
  onUnreadCountChange?: (count: number) => void;
}

const MinimalistChat: React.FC<MinimalistChatProps> = ({
  meetingId,
  currentUser,
  isHost,
  token,
  participants = [],
  onUnreadCountChange
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageId, setLastReadMessageId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isUserScrolled = useRef(false);


  // WebSocket connection for real-time chat
  const { socket, isConnected: wsConnected, messages: webSocketMessages, sendMessage, deleteMessage: deleteMessageFromHook } = useWebSocketChat({
    meetingId,
    token: token || '',
    onMessage: (message) => {
      const newMsg: Message = {
        _id: message._id || Date.now().toString(),
        text: message.text || (message as any).message || '',
        displayName: message.displayName || (message as any).senderName || 'Unknown',
        createdAt: message.createdAt || new Date().toISOString(),
        userId: message.userId || (message as any).senderId || '',
        type: 'chat'
      };
      
      // Prevent duplicate messages and keep welcome message at top
      setMessages(prev => {
        const exists = prev.find(msg => msg._id === newMsg._id || 
          (msg.text === newMsg.text && msg.displayName === newMsg.displayName && 
           Math.abs(new Date(msg.createdAt).getTime() - new Date(newMsg.createdAt).getTime()) < 5000));
        if (exists) return prev;
        
        // Keep welcome message at the top
        const welcomeMsg = prev.find(msg => msg._id === 'welcome');
        const otherMessages = prev.filter(msg => msg._id !== 'welcome');
        return welcomeMsg ? [welcomeMsg, ...otherMessages, newMsg] : [...prev, newMsg];
      });
    },
    onParticipantJoined: (participant) => {
      // Don't show chat join messages - only meeting join messages
    },
    onParticipantLeft: (participant) => {
      // Don't show chat leave messages - only meeting leave messages
    }
  });

  // Load previous messages when WebSocket messages are received
  useEffect(() => {
    if (webSocketMessages && webSocketMessages.length > 0) {
      const previousMessages: Message[] = webSocketMessages.map(msg => ({
        _id: msg._id,
        text: msg.text,
        displayName: msg.displayName,
        createdAt: msg.createdAt,
        userId: msg.userId,
        type: 'chat'
      }));
      
      setMessages(prev => {
        // Merge previous messages with current messages, avoiding duplicates
        const existingIds = new Set(prev.map(m => m._id));
        const newPreviousMessages = previousMessages.filter(msg => !existingIds.has(msg._id));
        
        // Keep welcome message at the top
        const welcomeMsg = prev.find(msg => msg._id === 'welcome');
        const otherMessages = prev.filter(msg => msg._id !== 'welcome');
        return welcomeMsg ? [welcomeMsg, ...newPreviousMessages, ...otherMessages] : [...newPreviousMessages, ...prev];
      });
    }
  }, [webSocketMessages]);

  // Listen for message deletion events
  useEffect(() => {
    if (!socket) return;

    const handleMessageDeleted = (data: any) => {
      // Remove deleted message from local state (but keep welcome message)
      setMessages(prev => {
        if (data.messageId === 'welcome') return prev; // Don't delete welcome message
        return prev.filter(msg => msg._id !== data.messageId);
      });
    };

    const handleError = (data: any) => {
      if (data.message?.includes('delete') || data.message?.includes('permission')) {
        alert(`Cannot delete message: ${data.message}`);
      }
    };

    socket.on('CHAT_MESSAGE_DELETED', handleMessageDeleted);
    socket.on('ERROR', handleError);

    return () => {
      socket.off('CHAT_MESSAGE_DELETED', handleMessageDeleted);
      socket.off('ERROR', handleError);
    };
  }, [socket]);

  // Initialize with welcome message and set connection status
  useEffect(() => {
    const welcomeMessage: Message = {
      _id: 'welcome',
      text: 'Welcome to the meeting! Chat is now active.',
      displayName: 'System',
      createdAt: new Date().toISOString(),
      type: 'system'
    };
    // Always keep welcome message at the top
    setMessages(prev => {
      const hasWelcome = prev.find(msg => msg._id === 'welcome');
      if (!hasWelcome) {
        return [welcomeMessage, ...prev];
      }
      return prev;
    });
    setIsConnected(wsConnected);
  }, [wsConnected]);

  // Track previous participants to detect join/leave events
  const [previousParticipants, setPreviousParticipants] = useState<any[]>([]);

  // Add participant join/leave messages when participants change
  useEffect(() => {
    if (participants.length > 0 && previousParticipants.length > 0) {
      // FIXED: Add debouncing to prevent spam from frequent participant updates
      const timeoutId = setTimeout(() => {
        // Only show join/leave messages for actual status changes, not frequent array updates
        // Check for new participants (actually joined - not just appeared in array due to heartbeat updates)
        const newParticipants = participants.filter(newP => {
          const wasPresent = previousParticipants.find(oldP => oldP._id === newP._id);
          // Only show join message if participant was not present before OR status changed to ADMITTED
          const isActuallyNew = !wasPresent && newP.status === 'ADMITTED';
          const statusChangedToAdmitted = wasPresent && wasPresent.status !== 'ADMITTED' && newP.status === 'ADMITTED';
          return isActuallyNew || statusChangedToAdmitted;
        });
        
        newParticipants.forEach(participant => {
          const joinMsg: Message = {
            _id: `meeting-join-${participant._id}-${Date.now()}`,
            text: `${participant.displayName || 'A participant'} joined the meeting`,
            displayName: 'System',
            createdAt: new Date().toISOString(),
            type: 'join'
          };
          setMessages(prev => {
            const welcomeMsg = prev.find(msg => msg._id === 'welcome');
            const otherMessages = prev.filter(msg => msg._id !== 'welcome');
            return welcomeMsg ? [welcomeMsg, ...otherMessages, joinMsg] : [...prev, joinMsg];
          });
        });

        // Check for left participants (actually left - not just disappeared from array due to heartbeat updates)
        const leftParticipants = previousParticipants.filter(oldP => {
          const stillPresent = participants.find(newP => newP._id === oldP._id);
          // Only show leave message if participant was ADMITTED before and is now LEFT or completely gone
          const wasAdmitted = oldP.status === 'ADMITTED';
          const isNowLeft = !stillPresent || (stillPresent && stillPresent.status === 'LEFT');
          return wasAdmitted && isNowLeft;
        });
        
        leftParticipants.forEach(participant => {
          const leaveMsg: Message = {
            _id: `meeting-leave-${participant._id}-${Date.now()}`,
            text: `${participant.displayName || 'A participant'} left the meeting`,
            displayName: 'System',
            createdAt: new Date().toISOString(),
            type: 'leave'
          };
          setMessages(prev => {
            const welcomeMsg = prev.find(msg => msg._id === 'welcome');
            const otherMessages = prev.filter(msg => msg._id !== 'welcome');
            return welcomeMsg ? [welcomeMsg, ...otherMessages, leaveMsg] : [...prev, leaveMsg];
          });
        });
        
        // Update previous participants for next comparison
        setPreviousParticipants(participants);
      }, 500); // 500ms debounce to prevent spam from frequent updates
      
      return () => clearTimeout(timeoutId);
    } else {
      // Update previous participants for next comparison (no debounce needed for initial load)
      setPreviousParticipants(participants);
    }
  }, [participants]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Track unread messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isOwnMessage = lastMessage.displayName === (currentUser?.displayName || 'You');
      
      // If it's not the user's own message and user hasn't scrolled manually
      if (!isOwnMessage && !isUserScrolled.current) {
        // User is at bottom, mark as read
        setLastReadMessageId(lastMessage._id);
        setUnreadCount(0);
      } else if (!isOwnMessage && isUserScrolled.current) {
        // User is not at bottom, increment unread count
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [messages, currentUser]);

  // Update parent component with unread count
  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [unreadCount, onUnreadCountChange]);

  // Auto-scroll to bottom for new messages (but not if user manually scrolled)
  useEffect(() => {
    if (!isUserScrolled.current) {
      scrollToBottom();
    }
  }, [messages]);

  // Reset unread count when user scrolls to bottom
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
    
    if (isAtBottom) {
      setUnreadCount(0);
      setLastReadMessageId(messages[messages.length - 1]?._id || '');
      isUserScrolled.current = false;
    } else {
      isUserScrolled.current = true;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately

    try {
      // Send message via WebSocket using the hook's sendMessage function
      if (sendMessage && isConnected) {
        sendMessage(messageText);        
        // Don't add message locally here - let the WebSocket onMessage handle it
        // This prevents duplicate messages from the sender
      } else {
        // Fallback: add message locally if WebSocket not available
        const message: Message = {
          _id: `fallback-${Date.now()}`,
          text: messageText,
          displayName: currentUser?.displayName || 'You',
          createdAt: new Date().toISOString(),
          type: 'chat'
        };
        setMessages(prev => {
          const welcomeMsg = prev.find(msg => msg._id === 'welcome');
          const otherMessages = prev.filter(msg => msg._id !== 'welcome');
          return welcomeMsg ? [welcomeMsg, ...otherMessages, message] : [...prev, message];
        });
      }
    } catch (error) {
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!isConnected || !deleteMessageFromHook) {
      return;
    }
    
    try {
      deleteMessageFromHook(messageId);
    } catch (error) {
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#ffffff'
    }}>
      {/* Chat Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h4 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#333'
          }}>
            Chat
          </h4>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#28a745' : '#dc3545'
            }}></div>
            <span style={{
              fontSize: '12px',
              color: '#666'
            }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          backgroundColor: '#ffffff'
        }}
        onScroll={handleScroll}
      >
        {messages.map((message) => {
          // System messages (join, leave, hand raise)
          if (message.type === 'system' || message.type === 'join' || message.type === 'leave') {
            return (
              <div
                key={message._id}
                style={{
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <div style={{
                  padding: '8px 16px',
                  borderRadius: '12px',
                  backgroundColor: message.type === 'join' ? '#d4edda' : message.type === 'leave' ? '#f8d7da' : '#e2e3e5',
                  color: message.type === 'join' ? '#155724' : message.type === 'leave' ? '#721c24' : '#495057',
                  fontSize: '12px',
                  fontWeight: '500',
                  textAlign: 'center',
                  border: `1px solid ${message.type === 'join' ? '#c3e6cb' : message.type === 'leave' ? '#f5c6cb' : '#d6d8db'}`
                }}>
                  {message.text}
                </div>
              </div>
            );
          }

          // Regular chat messages
          // CRITICAL FIX: Strict check for delete icon visibility
          // Get userId from message - check multiple possible field names
          const messageUserId = message.userId || (message as any).senderId || (message as any).userId || '';
          const currentUserId = currentUser?._id || currentUser?.id || '';
          
          // Convert to strings and normalize - must be non-empty strings
          const msgUserIdStr = messageUserId ? String(messageUserId).trim() : '';
          const currUserIdStr = currentUserId ? String(currentUserId).trim() : '';
          
          // Only proceed if both IDs are non-empty strings
          const hasValidIds = msgUserIdStr.length > 0 && currUserIdStr.length > 0;
          
          // Strict comparison: must be exact match AND both must exist
          const isOwnMessage = hasValidIds && msgUserIdStr === currUserIdStr;
          
          // CRITICAL: Only show delete icon if:
          // 1. User is ACTUALLY host (strict check - must be exactly true, not truthy)
          // 2. OR message truly belongs to participant (exact userId match)
          // IMPORTANT: Use strict === true check to avoid truthy values
          const isActuallyHost = isHost === true;
          const canDelete = isActuallyHost ? true : (hasValidIds && isOwnMessage);
          
          return (
            <div
              key={message._id}
              style={{
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
                position: 'relative'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#666'
                }}>
                  {message.displayName}
                </span>
                <span style={{
                  fontSize: '11px',
                  color: '#999'
                }}>
                  {formatTime(message.createdAt)}
                </span>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'flex-start',
                maxWidth: '80%',
                position: 'relative'
              }}>
                <div style={{
                  padding: '12px 16px',
                  paddingRight: canDelete ? '36px' : '16px',
                  borderRadius: '16px',
                  backgroundColor: isOwnMessage ? '#007bff' : '#f8f9fa',
                  color: isOwnMessage ? '#ffffff' : '#333',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  wordWrap: 'break-word',
                  border: isOwnMessage ? 'none' : '1px solid #e9ecef',
                  boxShadow: isOwnMessage ? '0 2px 4px rgba(0,123,255,0.2)' : '0 1px 2px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}>
                  {message.text}
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMessage(message._id);
                      }}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        opacity: 0.6,
                        transition: 'opacity 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.backgroundColor = isOwnMessage ? 'rgba(255, 255, 255, 0.2)' : 'rgba(220, 53, 69, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.6';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={isHost ? 'Delete message (Host)' : 'Delete your message'}
                    >
                      <svg 
                        width="14" 
                        height="14" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke={isOwnMessage ? '#ffffff' : '#dc3545'} 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #e9ecef',
        backgroundColor: '#ffffff'
      }}>
        <form onSubmit={handleSendMessage} style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end'
        }}>
          <div style={{
            flex: 1,
            position: 'relative'
          }}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              style={{
                width: '100%',
                minHeight: '40px',
                maxHeight: '120px',
                padding: '12px 16px',
                border: '1px solid #e9ecef',
                borderRadius: '20px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                backgroundColor: '#f8f9fa',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.backgroundColor = '#ffffff';
                e.target.style.borderColor = '#007bff';
                e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.borderColor = '#e9ecef';
                e.target.style.boxShadow = 'none';
              }}
              rows={1}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim()}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: newMessage.trim() ? '#007bff' : '#e9ecef',
              color: newMessage.trim() ? '#ffffff' : '#999',
              cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all 0.2s ease'
            }}
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  );
};

export default MinimalistChat;
