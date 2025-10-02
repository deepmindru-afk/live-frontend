import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track, RemoteTrack, LocalTrack, RemoteParticipant, LocalParticipant, ConnectionState } from 'livekit-client';
import { apolloClient } from '../apollo/client';
import { CREATE_LIVEKIT_TOKEN, TEST_LIVEKIT_TOKEN } from '../apollo/livekit/mutations';

interface SimpleLiveKitRoomProps {
  meetingId: string;
  participantName: string;
  meetingRole: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  style?: React.CSSProperties;
}

const SimpleLiveKitRoom: React.FC<SimpleLiveKitRoomProps> = ({
  meetingId,
  participantName,
  meetingRole,
  onConnected,
  onDisconnected,
  onError,
  style = {},
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, RemoteParticipant | LocalParticipant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Get LiveKit token
  const getLiveKitToken = async () => {
    try {
      const { data } = await apolloClient.mutate({
        mutation: TEST_LIVEKIT_TOKEN,
        variables: {
          meetingId,
          participantName,
          meetingRole,
        },
      });

      if (!data?.testLivekitToken) {
        throw new Error('Failed to get LiveKit token');
      }

      return JSON.parse(data.testLivekitToken);
    } catch (error: any) {
      console.error('❌ LiveKit: Token generation failed', error);
      throw new Error(`Token generation failed: ${error.message}`);
    }
  };

  // Connect to LiveKit room
  const connectToRoom = async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);

    try {
      console.log('🔌 LiveKit: Starting connection...', { meetingId, participantName, meetingRole });

      // Get token
      const tokenResponse = await getLiveKitToken();
      console.log('🎫 LiveKit: Token received');

      // Create room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners
      setupRoomEventListeners(newRoom);

      // Connect to room
      await newRoom.connect(tokenResponse.wsUrl, tokenResponse.token);
      console.log('✅ LiveKit: Connected to room');

      setRoom(newRoom);
      setIsConnected(true);
      setIsConnecting(false);
      onConnected?.();

    } catch (error: any) {
      console.error('❌ LiveKit: Connection failed', error);
      setError(error.message);
      setIsConnecting(false);
      onError?.(error);
    }
  };

  // Disconnect from room
  const disconnectFromRoom = async () => {
    if (room) {
      console.log('🔌 LiveKit: Disconnecting...');
      await room.disconnect();
      setRoom(null);
      setIsConnected(false);
      setParticipants(new Map());
      setIsMuted(false);
      setIsCameraEnabled(false);
      setIsScreenSharing(false);
      onDisconnected?.();
    }
  };

  // Set up room event listeners
  const setupRoomEventListeners = (roomInstance: Room) => {
    roomInstance.on(RoomEvent.Connected, () => {
      console.log('✅ LiveKit: Room connected');
      setConnectionState(ConnectionState.Connected);
      setIsConnected(true);
    });

    roomInstance.on(RoomEvent.Disconnected, (reason) => {
      console.log('🔌 LiveKit: Room disconnected', reason);
      setConnectionState(ConnectionState.Disconnected);
      setIsConnected(false);
    });

    roomInstance.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('👤 LiveKit: Participant connected', participant.identity);
      setParticipants(prev => new Map(prev.set(participant.identity, participant)));
    });

    roomInstance.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('👋 LiveKit: Participant disconnected', participant.identity);
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(participant.identity);
        return newMap;
      });
      // Remove video element
      const videoElement = remoteVideoRefs.current.get(participant.identity);
      if (videoElement) {
        videoElement.remove();
        remoteVideoRefs.current.delete(participant.identity);
      }
    });

    roomInstance.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('🎵 LiveKit: Track subscribed', { track, participant: participant.identity });
      handleTrackSubscribed(track, participant);
    });

    roomInstance.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('🔇 LiveKit: Track unsubscribed', { track, participant: participant.identity });
      handleTrackUnsubscribed(track, participant);
    });

    roomInstance.on(RoomEvent.TrackMuted, (publication, participant) => {
      console.log('🔇 LiveKit: Track muted', { participant: participant.identity, track: publication.kind });
      if (participant === roomInstance.localParticipant) {
        if (publication.kind === Track.Kind.Audio) {
          setIsMuted(true);
        } else if (publication.kind === Track.Kind.Video) {
          setIsCameraEnabled(false);
        }
      }
    });

    roomInstance.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      console.log('🔊 LiveKit: Track unmuted', { participant: participant.identity, track: publication.kind });
      if (participant === roomInstance.localParticipant) {
        if (publication.kind === Track.Kind.Audio) {
          setIsMuted(false);
        } else if (publication.kind === Track.Kind.Video) {
          setIsCameraEnabled(true);
        }
      }
    });
  };

  // Handle track subscription
  const handleTrackSubscribed = (track: RemoteTrack | LocalTrack, participant: RemoteParticipant | LocalParticipant) => {
    if (track.kind === Track.Kind.Video) {
      const videoElement = track.attach();
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';

      if (participant === room?.localParticipant) {
        // Local video
        if (localVideoRef.current) {
          localVideoRef.current.appendChild(videoElement);
        }
      } else {
        // Remote video
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = '300px';
        container.style.height = '200px';
        container.style.backgroundColor = '#1a1a1a';
        container.style.borderRadius = '8px';
        container.style.overflow = 'hidden';
        container.style.margin = '8px';

        const nameLabel = document.createElement('div');
        nameLabel.textContent = participant.name || participant.identity;
        nameLabel.style.position = 'absolute';
        nameLabel.style.bottom = '8px';
        nameLabel.style.left = '8px';
        nameLabel.style.right = '8px';
        nameLabel.style.background = 'rgba(0, 0, 0, 0.7)';
        nameLabel.style.color = '#ffffff';
        nameLabel.style.padding = '4px 8px';
        nameLabel.style.borderRadius = '4px';
        nameLabel.style.fontSize = '12px';
        nameLabel.style.textAlign = 'center';

        container.appendChild(videoElement);
        container.appendChild(nameLabel);

        // Add to remote videos container
        const remoteContainer = document.getElementById('remote-videos');
        if (remoteContainer) {
          remoteContainer.appendChild(container);
        }

        remoteVideoRefs.current.set(participant.identity, videoElement);
      }
    }
  };

  // Handle track unsubscription
  const handleTrackUnsubscribed = (track: RemoteTrack | LocalTrack, participant: RemoteParticipant | LocalParticipant) => {
    track.detach();
  };

  // Toggle microphone
  const toggleMicrophone = async () => {
    if (!room) return;

    try {
      if (isMuted) {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);
        console.log('🎤 LiveKit: Microphone enabled');
      } else {
        await room.localParticipant.setMicrophoneEnabled(false);
        setIsMuted(true);
        console.log('🎤 LiveKit: Microphone disabled');
      }
    } catch (error) {
      console.error('❌ LiveKit: Failed to toggle microphone', error);
      setError('Failed to toggle microphone');
    }
  };

  // Toggle camera
  const toggleCamera = async () => {
    if (!room) return;

    try {
      if (isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(false);
        setIsCameraEnabled(false);
        console.log('📹 LiveKit: Camera disabled');
      } else {
        await room.localParticipant.setCameraEnabled(true);
        setIsCameraEnabled(true);
        console.log('📹 LiveKit: Camera enabled');
      }
    } catch (error) {
      console.error('❌ LiveKit: Failed to toggle camera', error);
      setError('Failed to toggle camera');
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    if (!room) return;

    try {
      if (isScreenSharing) {
        await room.localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
        console.log('🖥️ LiveKit: Screen sharing stopped');
      } else {
        await room.localParticipant.setScreenShareEnabled(true);
        setIsScreenSharing(true);
        console.log('🖥️ LiveKit: Screen sharing started');
      }
    } catch (error) {
      console.error('❌ LiveKit: Failed to toggle screen share', error);
      setError('Failed to toggle screen share');
    }
  };

  // Auto-connect on mount
  useEffect(() => {
    connectToRoom();

    return () => {
      disconnectFromRoom();
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return '#28a745';
      case ConnectionState.Connecting:
      case ConnectionState.Reconnecting:
        return '#ffc107';
      case ConnectionState.Disconnected:
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return 'Connected';
      case ConnectionState.Connecting:
        return 'Connecting...';
      case ConnectionState.Disconnected:
        return 'Disconnected';
      case ConnectionState.Reconnecting:
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

  const videoAreaStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
    gap: '8px',
    overflow: 'auto',
  };

  const localVideoStyle: React.CSSProperties = {
    width: '100%',
    height: '200px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
  };

  const remoteVideosStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    minHeight: '200px',
  };

  const controlsStyle: React.CSSProperties = {
    padding: '16px',
    backgroundColor: '#2a2a2a',
    borderTop: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    transition: 'background-color 0.2s',
  };

  const getButtonStyle = (isActive: boolean): React.CSSProperties => ({
    ...buttonStyle,
    backgroundColor: isActive ? '#007bff' : '#6c757d',
    color: '#ffffff',
  });

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#ffffff',
          textAlign: 'center',
          padding: '20px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h3 style={{ marginBottom: '8px' }}>Connection Error</h3>
          <p style={{ marginBottom: '16px', color: '#ccc' }}>{error}</p>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={connectToRoom}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ color: '#ffffff', fontSize: '14px' }}>
          Status: <span style={{ color: getStatusColor() }}>{getStatusText()}</span>
          {isConnected && (
            <span style={{ marginLeft: '16px', color: '#ccc' }}>
              Participants: {participants.size + 1}
            </span>
          )}
        </div>
        <button
          style={{
            padding: '8px 16px',
            backgroundColor: isConnected ? '#dc3545' : '#28a745',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
          onClick={isConnected ? disconnectFromRoom : connectToRoom}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Video Area */}
      <div style={videoAreaStyle}>
        {/* Local Video */}
        <div style={localVideoStyle}>
          <div
            ref={localVideoRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ccc',
            }}
          >
            {!isCameraEnabled && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '8px' }}>📹</div>
                <div>Local Camera</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {isConnected ? 'Camera is off' : 'Not connected'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Remote Videos */}
        <div id="remote-videos" style={remoteVideosStyle}>
          {participants.size === 0 && (
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ccc',
              fontSize: '14px',
            }}>
              No remote participants yet
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={controlsStyle}>
        <button
          style={getButtonStyle(!isMuted)}
          onClick={toggleMicrophone}
          disabled={!isConnected}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          style={getButtonStyle(isCameraEnabled)}
          onClick={toggleCamera}
          disabled={!isConnected}
          title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? '📹' : '📷'}
        </button>

        <button
          style={getButtonStyle(isScreenSharing)}
          onClick={toggleScreenShare}
          disabled={!isConnected}
          title={isScreenSharing ? 'Stop screen share' : 'Start screen share'}
        >
          {isScreenSharing ? '🖥️' : '📺'}
        </button>
      </div>
    </div>
  );
};

export default SimpleLiveKitRoom;
