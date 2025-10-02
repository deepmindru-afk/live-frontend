import React, { useState, useEffect } from 'react';
import LiveKitRoom from './LiveKitRoom';
import { useLiveKit } from '../hooks/useLiveKit';

interface LiveKitIntegrationProps {
  meetingId: string;
  participantName: string;
  meetingRole: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
  isEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

const LiveKitIntegration: React.FC<LiveKitIntegrationProps> = ({
  meetingId,
  participantName,
  meetingRole,
  isEnabled = false,
  onToggle,
  className = '',
  style = {},
}) => {
  const [showVideoRoom, setShowVideoRoom] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const {
    isConnected,
    connectionState,
    participants,
    isMuted,
    isCameraEnabled,
    isScreenSharing,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    error,
  } = useLiveKit({
    roomName: meetingId,
    participantName,
    meetingRole,
    autoConnect: false, // We'll control connection manually
  });

  // Handle external enable/disable
  useEffect(() => {
    if (isEnabled && !showVideoRoom) {
      setShowVideoRoom(true);
      onToggle?.(true);
    } else if (!isEnabled && showVideoRoom) {
      setShowVideoRoom(false);
      onToggle?.(false);
    }
  }, [isEnabled, showVideoRoom, onToggle]);

  const handleToggle = () => {
    const newState = !showVideoRoom;
    setShowVideoRoom(newState);
    setConnectionError(null);
    onToggle?.(newState);
  };

  const handleConnected = () => {
    console.log('✅ LiveKit Integration: Connected');
    setConnectionError(null);
  };

  const handleDisconnected = () => {
    console.log('🔌 LiveKit Integration: Disconnected');
  };

  const handleError = (error: Error) => {
    console.error('❌ LiveKit Integration: Error', error);
    setConnectionError(error.message);
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return '#28a745';
      case 'connecting':
      case 'reconnecting':
        return '#ffc107';
      case 'disconnected':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'reconnecting':
        return 'Reconnecting...';
      default:
        return 'Unknown';
    }
  };

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#2a2a2a',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const toggleButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: showVideoRoom ? '#dc3545' : '#28a745',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  };

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#ffffff',
  };

  const statusDotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: getStatusColor(),
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#dc3545',
    color: '#ffffff',
    fontSize: '14px',
    textAlign: 'center',
  };

  const roomContainerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  };

  const placeholderStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ccc',
    fontSize: '16px',
    textAlign: 'center',
  };

  return (
    <div className={`livekit-integration ${className}`} style={containerStyle}>
      {/* Header with Toggle and Status */}
      <div style={headerStyle}>
        <div style={statusStyle}>
          <div style={statusDotStyle}></div>
          <span>LiveKit: {getStatusText()}</span>
          {isConnected && (
            <span style={{ color: '#ccc', fontSize: '12px' }}>
              ({participants.size} participants)
            </span>
          )}
        </div>
        
        <button
          style={toggleButtonStyle}
          onClick={handleToggle}
          title={showVideoRoom ? 'Disable video call' : 'Enable video call'}
        >
          {showVideoRoom ? '📹 Disable Video' : '📹 Enable Video'}
        </button>
      </div>

      {/* Error Display */}
      {connectionError && (
        <div style={errorStyle}>
          ⚠️ Connection Error: {connectionError}
        </div>
      )}

      {/* Video Room or Placeholder */}
      <div style={roomContainerStyle}>
        {showVideoRoom ? (
          <LiveKitRoom
            meetingId={meetingId}
            participantName={participantName}
            meetingRole={meetingRole}
            onConnected={handleConnected}
            onDisconnected={handleDisconnected}
            onError={handleError}
            style={{ height: '100%' }}
          />
        ) : (
          <div style={placeholderStyle}>
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📹</div>
              <div>Video calling is disabled</div>
              <div style={{ fontSize: '14px', marginTop: '8px', color: '#888' }}>
                Click "Enable Video" to start video calling
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveKitIntegration;

