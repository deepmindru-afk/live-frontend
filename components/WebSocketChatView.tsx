import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWebSocketChat } from '../hooks/useWebSocketChat';

interface WebSocketChatViewProps {
  meetingId: string;
  currentUser: any;
  isHost: boolean;
  token: string;
}

const WebSocketChatView: React.FC<WebSocketChatViewProps> = ({
  meetingId,
  currentUser,
  isHost,
  token
}) => {
  
  const [newMessage, setNewMessage] = useState('');
  // DISABLED: Typing indicators removed to reduce server requests
  // const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // DISABLED: Typing timeout removed
  // const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isConnected,
    participants,
    messages,
    error,
    sendMessage,
    deleteMessage,
    // DISABLED: ping removed - heartbeat handles connection keepalive
    // ping,
  } = useWebSocketChat({
    meetingId,
    token,
    onMessage: (message) => {
      // Auto-scroll to bottom when new message arrives
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    },
    onParticipantJoined: (participant) => {
    },
    onParticipantLeft: (participant) => {
    },
    onError: (error) => {
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // DISABLED: Ping mechanism removed - heartbeat (every 10s) handles connection keepalive
  // No need for duplicate ping - WebSocket connection stays alive with heartbeat
  // useEffect(() => {
  //   if (isConnected) {
  //     const pingInterval = setInterval(() => {
  //       ping();
  //     }, 30000);
  //     return () => clearInterval(pingInterval);
  //   }
  // }, [isConnected, ping]);

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim() || !isConnected) return;

    try {
      sendMessage(newMessage.trim());
      setNewMessage('');
    } catch (error) {
    }
  }, [newMessage, isConnected, sendMessage, participants.length]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // DISABLED: Typing indicator removed to reduce server requests
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    // Typing indicator functionality removed
  };

  const handleDeleteMessage = useCallback((messageId: string) => {
    if (isConnected) {
      deleteMessage(messageId);
    }
  }, [isConnected, deleteMessage]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, typeof messages>);

  if (!isConnected && !error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px',
        color: '#ccc',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          border: '2px solid #333',
          borderTop: '2px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div>Connecting to chat...</div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          If this takes too long, check if the backend server is running
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#1a1a1a'
    }}>
      {/* Connection Status */}
      <div style={{
        padding: '8px 12px',
        backgroundColor: isConnected ? '#28a745' : '#dc3545',
        color: 'white',
        fontSize: '12px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#fff' : '#fff',
          animation: isConnected ? 'pulse 2s infinite' : 'none'
        }}></div>
        {isConnected ? `Connected (${participants.length} online)` : 'Disconnected'}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#dc3545',
          color: 'white',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 0',
        borderBottom: '1px solid #333'
      }}>
        {Object.keys(groupedMessages).length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: '#ccc',
            padding: '20px'
          }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date Separator */}
              <div style={{
                textAlign: 'center',
                margin: '10px 0',
                position: 'relative'
              }}>
                <div style={{
                  display: 'inline-block',
                  backgroundColor: '#333',
                  color: '#ccc',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  {date}
                </div>
              </div>

              {/* Messages for this date */}
              {dateMessages.map((message, index) => {
                const isOwnMessage = message.userId === currentUser?._id;
                const showAvatar = index === 0 || dateMessages[index - 1].userId !== message.userId;
                
                return (
                  <div
                    key={message._id}
                    style={{
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      backgroundColor: isOwnMessage ? '#2a2a2a' : 'transparent',
                      borderLeft: isOwnMessage ? '3px solid #007bff' : 'none'
                    }}
                  >
                    {/* Avatar */}
                    {showAvatar && (
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isOwnMessage ? '#007bff' : '#28a745',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        flexShrink: 0
                      }}>
                        {message.displayName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}

                    {/* Message Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Sender Name and Time */}
                      {showAvatar && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '4px'
                        }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: isOwnMessage ? '#007bff' : '#28a745'
                          }}>
                            {message.displayName || 'Unknown'}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#666'
                          }}>
                            {formatTime(message.createdAt)}
                          </div>
                        </div>
                      )}

                      {/* Message Text */}
                      <div style={{
                        fontSize: '14px',
                        color: '#fff',
                        wordBreak: 'break-word',
                        lineHeight: '1.4'
                      }}>
                        {message.text}
                      </div>

                      {/* Reply Indicator */}
                      {message.replyToMessageId && (
                        <div style={{
                          fontSize: '11px',
                          color: '#666',
                          fontStyle: 'italic',
                          marginTop: '4px'
                        }}>
                          Replying to a message
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    {(isHost || message.userId === currentUser?._id) && (
                      <button
                        onClick={() => handleDeleteMessage(message._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '4px',
                          opacity: 0.7,
                          transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                        title="Delete message"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <div style={{
        padding: '15px',
        borderTop: '1px solid #333',
        backgroundColor: '#2a2a2a'
      }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end'
        }}>
          <textarea
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type your message..." : "Connecting..."}
            disabled={!isConnected}
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
              fontFamily: 'inherit'
            }}
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !isConnected}
            style={{
              backgroundColor: (newMessage.trim() && isConnected) ? '#007bff' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: (newMessage.trim() && isConnected) ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              height: '40px',
              transition: 'background-color 0.2s'
            }}
          >
            Send
          </button>
        </div>

        {/* DISABLED: Typing indicator removed */}
        {/* {isTyping && (
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '4px',
            fontStyle: 'italic'
          }}>
            Typing...
          </div>
        )} */}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default WebSocketChatView;
