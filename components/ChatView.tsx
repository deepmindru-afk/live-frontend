import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_CHAT_HISTORY } from '../apollo/livestream/queries';
import { DELETE_CHAT_MESSAGE } from '../apollo/livestream/mutations';
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
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // GraphQL Queries
  const { data: chatData, loading: chatLoading } = useQuery(GET_CHAT_HISTORY, {
    variables: { 
      input: {
        meetingId,
        limit: 50,
        offset: 0
      }
    },
    pollInterval: 2000
  });

  // GraphQL Mutations
  const [deleteMessage] = useMutation(DELETE_CHAT_MESSAGE);

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
      setMessages(prev => [...prev, message]);
    };

    const handleUserTyping = (data: any) => {
      // Handle typing indicators if needed
      console.log('User typing:', data);
    };

    socket.on('NEW_MESSAGE', handleNewMessage);
    socket.on('USER_TYPING', handleUserTyping);

    return () => {
      socket.off('NEW_MESSAGE', handleNewMessage);
      socket.off('USER_TYPING', handleUserTyping);
    };
  }, [socket]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !socket) return;

    try {
      console.log('[CHAT] Sending message:', newMessage);
      
      // Send message via WebSocket
      socket.emit('SEND_MESSAGE', {
        meetingId,
        message: newMessage.trim()
      });
      
      setNewMessage('');
      
      // Stop typing indicator
      socket.emit('TYPING_STOP', { meetingId });
      setIsTyping(false);
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socket?.emit('TYPING_START', { meetingId });
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket?.emit('TYPING_STOP', { meetingId });
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage({
        variables: {
          input: {
            messageId
          }
        }
      });
    } catch (error) {
      console.error('❌ Error deleting message:', error);
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
        Loading chat...
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
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message._id}
              style={{
                padding: '8px 0',
                borderBottom: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: message.senderId === currentUser?._id ? '#4CAF50' : '#2196F3'
                  }}>
                    {message.senderDisplayName || 'Unknown'}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#666'
                  }}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#fff',
                  wordBreak: 'break-word'
                }}>
                  {message.message}
                </div>
              </div>
              {(isHost || message.senderId === currentUser?._id) && (
                <button
                  onClick={() => handleDeleteMessage(message._id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px',
                    marginLeft: '8px'
                  }}
                  title="Delete message"
                >
                  ×
                </button>
              )}
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <div style={{
        padding: '15px 0',
        borderTop: '1px solid #333'
      }}>
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-end'
        }}>
          <textarea
            value={newMessage}
            onChange={handleTyping}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
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
              maxHeight: '100px'
            }}
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            style={{
              backgroundColor: newMessage.trim() ? '#007bff' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              height: '40px'
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
