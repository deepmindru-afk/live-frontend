import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_CHAT_HISTORY } from '../apollo/livestream/queries';
import { Socket } from 'socket.io-client';

interface ChatViewProps {
  meetingId: string;
  currentUser: any;
  isHost: boolean;
  socket: any; // Add socket prop
}

const ChatView: React.FC<ChatViewProps> = ({
  meetingId,
  currentUser,
  isHost,
  socket // Add socket parameter
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  // DISABLED: Typing indicators removed to reduce server requests
  // const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // DISABLED: Typing timeout removed
  // const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // GraphQL Queries
  const { data: chatData, loading: chatLoading } = useQuery(GET_CHAT_HISTORY, {
    variables: { 
      input: {
        meetingId,
        limit: 50,
        offset: 0
      }
    },
    // PERFORMANCE FIX: Removed pollInterval - WebSocket provides real-time chat updates
    fetchPolicy: 'cache-first' // Only fetch initially, WebSocket handles updates
  });

  // Update messages when chat data changes
  useEffect(() => {
    if (chatData) {
      const chatHistory = (chatData as any)?.getChatHistory;
      const chatMessages = chatHistory?.messages || [];
      setMessages(chatMessages);
    }
  }, [chatData]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket event listeners for real-time messaging
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: any) => {
      // CRITICAL FIX: Add deduplication to prevent duplicate messages from WebSocket + polling
      setMessages(prev => {
        // Check if message already exists by _id or timestamp + text combination
        const exists = prev.some(m => 
          m._id === message._id || 
          (m.text === message.text && m.timestamp === message.timestamp)
        );
        if (exists) {
          return prev;
        }
        // New message, add it
        return [...prev, message];
      });
    };

    const handleMessageDeleted = (data: any) => {
      // Remove deleted message from local state
      setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
    };

    const handleError = (data: any) => {
      if (data.message?.includes('delete')) {
        alert(`메시지를 삭제할 수 없습니다: ${data.message}`);
      }
    };

    // DISABLED: Typing indicator handler removed
    // const handleUserTyping = (data: any) => {
    //   // Handle typing indicators if needed
    // };

    socket.on('NEW_MESSAGE', handleNewMessage);
    socket.on('CHAT_MESSAGE_DELETED', handleMessageDeleted);
    socket.on('ERROR', handleError);
    // DISABLED: Typing indicator removed
    // socket.on('USER_TYPING', handleUserTyping);

    return () => {
      socket.off('NEW_MESSAGE', handleNewMessage);
      socket.off('CHAT_MESSAGE_DELETED', handleMessageDeleted);
      socket.off('ERROR', handleError);
      // DISABLED: Typing indicator removed
      // socket.off('USER_TYPING', handleUserTyping);
    };
  }, [socket]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !socket) return;

    try {
      
      // Send message via WebSocket
      socket.emit('SEND_MESSAGE', {
        meetingId,
        message: newMessage.trim()
      });
      
      setNewMessage('');
      
      // DISABLED: Typing indicator removed
      // socket.emit('TYPING_STOP', { meetingId });
      // setIsTyping(false);
    } catch (error) {
    }
  };

  // DISABLED: Typing indicator removed to reduce server requests
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    // Typing indicator functionality removed - no TYPING_START/TYPING_STOP events sent
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!socket) {
      return;
    }
    
    try {
      // Send delete request via WebSocket
      socket.emit('DELETE_CHAT_MESSAGE', {
        meetingId,
        messageId
      });
    } catch (error) {
    }
  };

  if (chatLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#ccc'
      }}>
        채팅 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 0',
        borderBottom: '1px solid #333'
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#ccc',
            padding: '20px'
          }}>
            아직 메시지가 없습니다. 대화를 시작해보세요!
          </div>
        ) : (
          messages.map((message) => {
            // Check if message belongs to current user - backend uses userId field
            const messageUserId = (message as any).userId || message.senderId || '';
            const currentUserId = currentUser?._id || currentUser?.id || '';
            
            // Convert to strings and normalize for comparison
            const msgUserIdStr = messageUserId ? String(messageUserId).trim() : '';
            const currUserIdStr = currentUserId ? String(currentUserId).trim() : '';
            
            // Strict comparison: must be exact match AND both must exist
            const isOwnMessage = msgUserIdStr && currUserIdStr && msgUserIdStr === currUserIdStr;
            
            // CRITICAL: Host can delete any message, participant can ONLY delete their own
            // For participants: must have exact userId match, not just displayName match
            // Only show delete icon if user is host OR if message truly belongs to participant
            const canDelete = isHost ? true : (msgUserIdStr && currUserIdStr && msgUserIdStr === currUserIdStr);
            
            return (
              <div
                key={message._id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #333',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: isOwnMessage ? '#4CAF50' : '#2196F3'
                  }}>
                    {message.senderDisplayName || (message as any).displayName || '알 수 없음'}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#666'
                  }}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div style={{
                  position: 'relative',
                  display: 'inline-block',
                  maxWidth: '100%'
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#fff',
                    wordBreak: 'break-word',
                    padding: '8px 12px',
                    paddingRight: canDelete ? '36px' : '12px',
                    backgroundColor: isOwnMessage ? 'rgba(76, 175, 80, 0.1)' : 'rgba(33, 150, 243, 0.1)',
                    borderRadius: '8px',
                    border: `1px solid ${isOwnMessage ? 'rgba(76, 175, 80, 0.3)' : 'rgba(33, 150, 243, 0.3)'}`,
                    position: 'relative'
                  }}>
                    {message.message || message.text}
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
                          e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0.6';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title={isHost ? '메시지 삭제 (호스트)' : '내 메시지 삭제'}
                      >
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="#dc3545" 
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
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <div style={{
        padding: '15px 0',
        borderTop: '1px solid #333'
      }}>
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-end'
          }}
        >
          <textarea
            value={newMessage}
            onChange={handleTyping}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="메시지를 입력하세요... (Enter로 전송)"
            style={{
              flex: 1,
              backgroundColor: '#333',
              border: '1px solid #555',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'white',
              fontSize: '14px',
              resize: 'none',
              minHeight: '40px',
              maxHeight: '100px',
              outline: 'none'
            }}
            rows={1}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            style={{
              backgroundColor: newMessage.trim() ? '#007bff' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              height: '40px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (newMessage.trim()) {
                e.currentTarget.style.backgroundColor = '#0056b3';
              }
            }}
            onMouseLeave={(e) => {
              if (newMessage.trim()) {
                e.currentTarget.style.backgroundColor = '#007bff';
              }
            }}
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatView;
