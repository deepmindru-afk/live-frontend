import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Track } from 'livekit-client';
import { useLiveKit, UseLiveKitOptions } from '../hooks/useLiveKit';
import { LiveKitParticipant } from '../lib/livekit-service';
import LiveKitVideoComponent from './LiveKitVideoComponent';

interface LiveKitRoomProps {
  meetingId: string;
  participantName: string;
  meetingRole: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
  className?: string;
  style?: React.CSSProperties;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  onParticipantJoined?: (participant: LiveKitParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
}

const LiveKitRoom: React.FC<LiveKitRoomProps> = ({
  meetingId,
  participantName,
  meetingRole,
  className = '',
  style = {},
  onConnected,
  onDisconnected,
  onError,
  onParticipantJoined,
  onParticipantLeft,
}) => {
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [participantTracks, setParticipantTracks] = useState<Map<string, { video?: any; audio?: any }>>(new Map());
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const liveKitOptions: UseLiveKitOptions = {
    roomName: meetingId,
    participantName,
    meetingRole,
    autoConnect: true,
    enableCamera: true,
    enableMicrophone: true,
    onConnected: () => {
      console.log('✅ LiveKit Room: Connected');
      onConnected?.();
    },
    onDisconnected: () => {
      console.log('🔌 LiveKit Room: Disconnected');
      onDisconnected?.();
    },
    onError: (error) => {
      console.error('❌ LiveKit Room: Error', error);
      setConnectionError(error.message);
      onError?.(error);
    },
    onParticipantConnected: (participant) => {
      console.log('👤 LiveKit Room: Participant joined', participant.identity);
      onParticipantJoined?.(participant);
    },
    onParticipantDisconnected: (participantId) => {
      console.log('👋 LiveKit Room: Participant left', participantId);
      setParticipantTracks(prev => {
        const newMap = new Map(prev);
        newMap.delete(participantId);
        return newMap;
      });
      onParticipantLeft?.(participantId);
    },
    onTrackSubscribed: (track, publication, participant) => {
      console.log('🎵 LiveKit Room: Track subscribed', { track, participant: participant.identity });
      
      setParticipantTracks(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(participant.identity) || {};
        
        if (track.kind === Track.Kind.Video) {
          existing.video = track;
        } else if (track.kind === Track.Kind.Audio) {
          existing.audio = track;
        }
        
        newMap.set(participant.identity, existing);
        return newMap;
      });
    },
    onTrackUnsubscribed: (track, publication, participant) => {
      console.log('🔇 LiveKit Room: Track unsubscribed', { track, participant: participant.identity });
      
      setParticipantTracks(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(participant.identity) || {};
        
        if (track.kind === Track.Kind.Video) {
          existing.video = null;
        } else if (track.kind === Track.Kind.Audio) {
          existing.audio = null;
        }
        
        newMap.set(participant.identity, existing);
        return newMap;
      });
    },
  };

  const {
    isConnected,
    connectionState,
    participants,
    localParticipant,
    isMuted,
    isCameraEnabled,
    isScreenSharing,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    liveKitService,
  } = useLiveKit(liveKitOptions);

  // Get local tracks when connected
  useEffect(() => {
    if (isConnected && liveKitService?.room) {
      const room = liveKitService.room;
      
      // Get local video track
      const videoTrack = room.localParticipant.videoTrackPublications.find(
        pub => pub.track
      )?.track;
      setLocalVideoTrack(videoTrack || null);

      // Get local audio track
      const audioTrack = room.localParticipant.audioTrackPublications.find(
        pub => pub.track
      )?.track;
      setLocalAudioTrack(audioTrack || null);
    }
  }, [isConnected, liveKitService]);

  const handleToggleMicrophone = useCallback(async () => {
    try {
      await toggleMicrophone();
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      setConnectionError('Failed to toggle microphone');
    }
  }, [toggleMicrophone]);

  const handleToggleCamera = useCallback(async () => {
    try {
      await toggleCamera();
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      setConnectionError('Failed to toggle camera');
    }
  }, [toggleCamera]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      await toggleScreenShare();
    } catch (error) {
      console.error('Failed to toggle screen share:', error);
      setConnectionError('Failed to toggle screen share');
    }
  }, [toggleScreenShare]);

  const getConnectionStatusText = () => {
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

  const getConnectionStatusColor = () => {
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

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    ...style,
  };

  const videoGridStyle: React.CSSProperties = {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: participants.size <= 2 ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '8px',
    padding: '8px',
    overflow: 'auto',
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#2a2a2a',
    borderTop: '1px solid #333',
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

  const getButtonStyle = (isActive: boolean, isError?: boolean): React.CSSProperties => ({
    ...buttonStyle,
    backgroundColor: isError ? '#dc3545' : isActive ? '#007bff' : '#6c757d',
    color: '#ffffff',
  });

  if (connectionError) {
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
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h3 style={{ marginBottom: '8px' }}>Connection Error</h3>
          <p style={{ marginBottom: '16px', color: '#ccc' }}>{connectionError}</p>
          <button
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
            onClick={() => setConnectionError(null)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`livekit-room ${className}`} style={containerStyle}>
      {/* Connection Status */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#2a2a2a',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ color: '#ffffff', fontSize: '14px' }}>
          Status: <span style={{ color: getConnectionStatusColor() }}>
            {getConnectionStatusText()}
          </span>
        </div>
        <div style={{ color: '#ccc', fontSize: '12px' }}>
          Participants: {participants.size}
        </div>
      </div>

      {/* Video Grid */}
      <div style={videoGridStyle}>
        {/* Local Video */}
        {localVideoTrack && (
          <LiveKitVideoComponent
            participant={localParticipant || {
              identity: 'local',
              name: participantName,
              isMuted,
              isCameraEnabled,
              isScreenSharing,
              isSpeaking: false,
              connectionQuality: 1,
            }}
            track={localVideoTrack}
            mirror={true}
            showName={true}
            showMuteIndicator={true}
            showSpeakingIndicator={false}
          />
        )}

        {/* Remote Participants */}
        {Array.from(participants.entries()).map(([participantId, participant]) => {
          const tracks = participantTracks.get(participantId);
          return (
            <LiveKitVideoComponent
              key={participantId}
              participant={participant}
              track={tracks?.video}
              showName={true}
              showMuteIndicator={true}
              showSpeakingIndicator={true}
            />
          );
        })}

        {/* Empty State */}
        {participants.size === 0 && !localVideoTrack && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#ccc',
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📹</div>
              <div>Waiting for participants...</div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={controlsStyle}>
        <button
          style={getButtonStyle(!isMuted)}
          onClick={handleToggleMicrophone}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? '🔇' : '🎤'}
        </button>

        <button
          style={getButtonStyle(isCameraEnabled)}
          onClick={handleToggleCamera}
          title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? '📹' : '📷'}
        </button>

        <button
          style={getButtonStyle(isScreenSharing)}
          onClick={handleToggleScreenShare}
          title={isScreenSharing ? 'Stop screen share' : 'Start screen share'}
        >
          {isScreenSharing ? '🖥️' : '📺'}
        </button>
      </div>
    </div>
  );
};

export default LiveKitRoom;

