import React, { useEffect, useRef, useState } from 'react';
import { Track, RemoteTrack, LocalTrack, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { LiveKitParticipant } from '../lib/livekit-service';

interface LiveKitVideoComponentProps {
  participant: LiveKitParticipant;
  track?: RemoteTrack | LocalTrack;
  className?: string;
  style?: React.CSSProperties;
  mirror?: boolean;
  showName?: boolean;
  showMuteIndicator?: boolean;
  showSpeakingIndicator?: boolean;
  onClick?: () => void;
}

const LiveKitVideoComponent: React.FC<LiveKitVideoComponentProps> = ({
  participant,
  track,
  className = '',
  style = {},
  mirror = false,
  showName = true,
  showMuteIndicator = true,
  showSpeakingIndicator = true,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !track) return;

    const videoElement = videoRef.current;
    
    // Attach track to video element
    if (track.attach) {
      track.attach(videoElement);
      setIsVideoLoaded(true);
      setHasError(false);
    }

    // Cleanup function
    return () => {
      if (track.detach) {
        track.detach(videoElement);
      }
    };
  }, [track]);

  const handleVideoError = () => {
    setHasError(true);
    setIsVideoLoaded(false);
  };

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
    setHasError(false);
  };

  const getVideoStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      backgroundColor: '#1a1a1a',
      ...style,
    };

    if (mirror) {
      baseStyle.transform = 'scaleX(-1)';
    }

    return baseStyle;
  };

  const getContainerStyle = (): React.CSSProperties => {
    return {
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#1a1a1a',
      borderRadius: '8px',
      overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
    };
  };

  return (
    <div 
      className={`livekit-video-container ${className}`}
      style={getContainerStyle()}
      onClick={onClick}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        style={getVideoStyle()}
        autoPlay
        playsInline
        muted={false}
        onError={handleVideoError}
        onLoadedData={handleVideoLoad}
      />

      {/* Loading State */}
      {!isVideoLoaded && !hasError && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #333',
              borderTop: '3px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 10px'
            }}></div>
            <div>Loading video...</div>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#ffffff',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '24px',
              marginBottom: '8px',
              color: '#666'
            }}>📹</div>
            <div>Video unavailable</div>
          </div>
        </div>
      )}

      {/* Participant Name */}
      {showName && participant.name && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          right: '8px',
          background: 'rgba(0, 0, 0, 0.7)',
          color: '#ffffff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '500',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {participant.name}
        </div>
      )}

      {/* Mute Indicator */}
      {showMuteIndicator && participant.isMuted && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'rgba(220, 53, 69, 0.9)',
          color: '#ffffff',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
        }}>
          🔇
        </div>
      )}

      {/* Speaking Indicator */}
      {showSpeakingIndicator && participant.isSpeaking && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          width: '8px',
          height: '8px',
          backgroundColor: '#28a745',
          borderRadius: '50%',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      )}

      {/* Connection Quality Indicator */}
      {participant.connectionQuality !== undefined && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: participant.isMuted ? '40px' : '8px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 
            participant.connectionQuality >= 0.8 ? '#28a745' :
            participant.connectionQuality >= 0.5 ? '#ffc107' :
            '#dc3545',
        }} />
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default LiveKitVideoComponent;

