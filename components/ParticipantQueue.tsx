import React, { useEffect, useRef } from 'react';
import { Participant } from '../hooks/useParticipantQueue';

interface ParticipantQueueProps {
  participants: Participant[];
  activeSpeaker: Participant | null;
  screenShareMode: boolean;
  screenShareParticipant: Participant | null;
  onParticipantClick?: (participant: Participant) => void;
  onHandRaiseClick?: (participant: Participant) => void;
  onKickParticipant?: (participant: Participant) => void;
  isHost?: boolean;
  viewMode?: 'grid' | 'speaker';
  maxThumbnails?: number;
}

const ParticipantQueue: React.FC<ParticipantQueueProps> = ({
  participants,
  activeSpeaker,
  screenShareMode,
  screenShareParticipant,
  onParticipantClick,
  onHandRaiseClick,
  onKickParticipant,
  isHost = false,
  viewMode = 'speaker',
  maxThumbnails = 6
}) => {
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Get main stage participants
  const getMainStageParticipants = () => {
    if (screenShareMode && screenShareParticipant) {
      return [screenShareParticipant];
    }
    
    if (viewMode === 'speaker') {
      return participants.slice(0, 1); // Only active speaker in speaker view
    }
    
    return participants.slice(0, 4); // Up to 4 in grid view
  };

  // Get thumbnail participants
  const getThumbnailParticipants = () => {
    if (screenShareMode) {
      return participants.filter(p => p._id !== screenShareParticipant?._id).slice(0, maxThumbnails);
    }
    
    const startIndex = viewMode === 'speaker' ? 1 : 4;
    return participants.slice(startIndex, startIndex + maxThumbnails);
  };

  const mainStageParticipants = getMainStageParticipants();
  const thumbnailParticipants = getThumbnailParticipants();

  // Render participant video
  const renderParticipantVideo = (participant: Participant, isMainStage: boolean = false) => {
    const isActiveSpeaker = activeSpeaker?._id === participant._id;
    const isScreenSharing = screenShareMode && screenShareParticipant?._id === participant._id;
    
    return (
      <div
        key={participant._id}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: isMainStage ? '12px' : '8px',
          overflow: 'hidden',
          cursor: onParticipantClick ? 'pointer' : 'default',
          border: isActiveSpeaker ? '3px solid #3b82f6' : '2px solid transparent',
          boxShadow: isActiveSpeaker 
            ? '0 0 20px rgba(59, 130, 246, 0.5)' 
            : '0 4px 12px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease'
        }}
        onClick={() => onParticipantClick?.(participant)}
      >
        {/* Video Element */}
        <video
          ref={el => videoRefs.current[participant._id] = el}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#1f2937'
          }}
        />
        
        {/* Speaking Indicator */}
        {isActiveSpeaker && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '12px',
              height: '12px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'pulse 1s infinite'
            }}
          />
        )}
        
        {/* Screen Share Indicator */}
        {isScreenSharing && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600'
            }}
          >
            📺 Screen
          </div>
        )}
        
        {/* Hand Raise Indicator */}
        {participant.hasHandRaised && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: isActiveSpeaker ? '28px' : '8px',
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              animation: 'bounce 1s infinite'
            }}
          >
            ✋ Raised
          </div>
        )}
        
        {/* Muted Indicator */}
        {participant.isMuted && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 6px',
              borderRadius: '4px',
              fontSize: '10px'
            }}
          >
            🔇
          </div>
        )}
        
        {/* Camera Off Indicator */}
        {participant.isCameraOff && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 6px',
              borderRadius: '4px',
              fontSize: '10px'
            }}
          >
            📷
          </div>
        )}
        
        {/* Participant Name */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: participant.isMuted ? '40px' : '8px',
            right: participant.isCameraOff ? '40px' : '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {participant.displayName}
          {participant.role === 'HOST' && ' 👑'}
        </div>
        
        {/* Host Controls */}
        {isHost && participant.role !== 'HOST' && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: isScreenSharing ? '80px' : '8px',
              display: 'flex',
              gap: '4px'
            }}
          >
            {participant.hasHandRaised && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onHandRaiseClick?.(participant);
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px'
                }}
                title="Lower hand"
              >
                ✋
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onKickParticipant?.(participant);
              }}
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px'
              }}
              title="Remove participant"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Main Stage */}
      <div
        style={{
          width: '100%',
          height: screenShareMode ? '70%' : '100%',
          display: 'flex',
          gap: '8px',
          marginBottom: screenShareMode ? '8px' : '0'
        }}
      >
        {mainStageParticipants.map((participant, index) => (
          <div
            key={participant._id}
            style={{
              flex: 1,
              height: '100%',
              minHeight: '200px'
            }}
          >
            {renderParticipantVideo(participant, true)}
          </div>
        ))}
      </div>
      
      {/* Thumbnail Strip (only in screen share mode or when there are more participants) */}
      {(screenShareMode || participants.length > (viewMode === 'speaker' ? 1 : 4)) && (
        <div
          style={{
            width: '100%',
            height: '30%',
            display: 'flex',
            gap: '4px',
            overflowX: 'auto',
            padding: '4px 0'
          }}
        >
          {thumbnailParticipants.map((participant) => (
            <div
              key={participant._id}
              style={{
                minWidth: '120px',
                height: '100%',
                flexShrink: 0
              }}
            >
              {renderParticipantVideo(participant, false)}
            </div>
          ))}
        </div>
      )}
      
      {/* Queue Order Indicator */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '500',
          zIndex: 10
        }}
      >
        👥 {participants.length} participants
        {activeSpeaker && (
          <span style={{ color: '#10b981', marginLeft: '8px' }}>
            • 🎤 {activeSpeaker.displayName}
          </span>
        )}
        {participants.filter(p => p.hasHandRaised).length > 0 && (
          <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
            • ✋ {participants.filter(p => p.hasHandRaised).length} raised
          </span>
        )}
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
          60% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
};

export default ParticipantQueue;
