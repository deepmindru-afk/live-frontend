import React, { useState, useEffect } from 'react';
import { useWebSocketChat } from '../hooks/useWebSocketChat';

interface ChatDebugProps {
  meetingId: string;
  token: string;
}

const ChatDebug: React.FC<ChatDebugProps> = ({ meetingId, token }) => {
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const {
    isConnected,
    participants,
    messages,
    error,
    sendMessage,
    deleteMessage,
    ping,
  } = useWebSocketChat({
    meetingId,
    token,
    onMessage: (message) => {
      addLog(`📨 Received message: ${message.text} from ${message.displayName}`);
    },
    onParticipantJoined: (participant) => {
      addLog(`👤 Participant joined: ${participant.displayName}`);
    },
    onParticipantLeft: (participant) => {
      addLog(`👤 Participant left: ${participant.displayName}`);
    },
    onError: (error) => {
      addLog(`❌ Error: ${error}`);
    },
  });

  useEffect(() => {
    addLog(`🔌 WebSocket connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
  }, [isConnected]);

  useEffect(() => {
    addLog(`👥 Participants count: ${participants.length}`);
  }, [participants.length]);

  useEffect(() => {
    addLog(`📝 Messages count: ${messages.length}`);
  }, [messages.length]);

  if (error) {
    addLog(`❌ Error: ${error}`);
  }

  const handleTestMessage = () => {
    if (isConnected) {
      sendMessage('Test message from debug component');
      addLog('📤 Sent test message');
    } else {
      addLog('❌ Cannot send message: not connected');
    }
  };

  const handlePing = () => {
    if (isConnected) {
      ping();
      addLog('🏓 Sent ping');
    } else {
      addLog('❌ Cannot ping: not connected');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '10px',
      width: '400px',
      height: '300px',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      fontSize: '12px',
      zIndex: 9999,
      overflow: 'auto'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        borderBottom: '1px solid #333',
        paddingBottom: '10px'
      }}>
        <h4 style={{ margin: 0 }}>Chat Debug</h4>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={handleTestMessage}
            disabled={!isConnected}
            style={{
              backgroundColor: isConnected ? '#007bff' : '#666',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: '10px'
            }}
          >
            Test Msg
          </button>
          <button
            onClick={handlePing}
            disabled={!isConnected}
            style={{
              backgroundColor: isConnected ? '#28a745' : '#666',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: '10px'
            }}
          >
            Ping
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
        <div>Participants: {participants.length}</div>
        <div>Messages: {messages.length}</div>
        <div>Meeting ID: {meetingId}</div>
        <div>Token: {token ? '✅ Present' : '❌ Missing'}</div>
      </div>

      <div style={{
        height: '150px',
        overflow: 'auto',
        backgroundColor: '#1a1a1a',
        padding: '5px',
        borderRadius: '4px',
        fontFamily: 'monospace'
      }}>
        {logs.map((log, index) => (
          <div key={index} style={{ marginBottom: '2px' }}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatDebug;
