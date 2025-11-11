import React, { useRef, useEffect, useState } from 'react';
import styles from './RoomMain.module.scss';

interface ParticipantThumbnailProps {
  participantId: string;
  name: string;
  videoTrack?: any;
  audioTrack?: any;
  isSpeaking?: boolean;
  isHandRaised?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  avatarUrl?: string;
  isHost?: boolean;
  isScreenSharing?: boolean;
  isWhiteboarding?: boolean; // ✅ Whiteboard indicator
  isLocalParticipant?: boolean;
  isSelected?: boolean;
  currentUserIsHost?: boolean; // ✅ Check if current user is host
  isRecording?: boolean; // ✅ Check if recording is active
  onKickParticipant?: (participant: any) => void; // ✅ Kick participant callback
  onLowerHand?: (participantId: string) => void; // ✅ Lower hand callback for host
  onClick?: () => void;
}

export const ParticipantThumbnail: React.FC<ParticipantThumbnailProps> = ({
  participantId,
  name,
  videoTrack,
  audioTrack,
  isSpeaking = false,
  isHandRaised = false,
  isMuted = false,
  isVideoOff = false,
  avatarUrl,
  isHost = false,
  isScreenSharing = false,
  isWhiteboarding = false, // ✅ Whiteboard indicator
  isLocalParticipant = false,
  isSelected = false,
  currentUserIsHost = false, // ✅ Whether current user is host
  isRecording = false, // ✅ Whether recording is active
  onKickParticipant, // ✅ Kick participant handler
  onLowerHand, // ✅ Lower hand handler
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [shouldShake, setShouldShake] = useState(false);
  const previousHandRaised = useRef(isHandRaised);

  // Video track attachment with race condition fixes
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack || isVideoOff) {
      // ✅ CRITICAL FIX: Detach track when video is off
      if (el && videoTrack) {
        try {
          videoTrack.detach(el);
        } catch {}
      }
      return;
    }

    if (el.offsetWidth === 0) {
      const timer = setTimeout(() => { 
        if (el.offsetWidth > 0 && !isVideoOff) {
          videoTrack.detach(el);
          videoTrack.attach(el);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    // Always detach before attaching to prevent race conditions
    videoTrack.detach(el);
    videoTrack.attach(el);

    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack, isVideoOff]); // ✅ CRITICAL FIX: Include isVideoOff in dependencies

  // ✅ Audio track attachment for remote participants (skip for local to prevent echo)
  useEffect(() => {
    if (!audioRef.current || !audioTrack) return;
    
    // Don't attach audio for local participant to prevent echo
    if (isLocalParticipant || participantId === 'local') {
      audioRef.current.muted = true;
      audioRef.current.volume = 0;
      return;
    }
    
    // Attach remote participant audio
    try {
      audioTrack.detach(audioRef.current);
    } catch {}
    audioTrack.attach(audioRef.current);
    audioRef.current.muted = false; // ✅ Enable audio for remote participants
    
    return () => {
      try {
        if (audioRef.current && audioTrack) {
          audioTrack.detach(audioRef.current);
        }
      } catch {}
    };
  }, [audioTrack, participantId, isLocalParticipant]);
  
  // ✅ FIX: Shake animation when hand is raised - trigger initial shake and maintain continuous
  useEffect(() => {
    // Trigger initial shake when hand changes from NOT raised to RAISED
    if (isHandRaised && !previousHandRaised.current) {
      setShouldShake(true);
      
      // Remove initial shake class after animation completes (500ms) - continuous shake will remain via CSS class
      const timer = setTimeout(() => {
        setShouldShake(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
    
    // Update the previous state
    previousHandRaised.current = isHandRaised;
  }, [isHandRaised]);

  return (
    <div 
      className={`${styles['participant-thumbnail']} ${isSpeaking ? styles['speaking'] : ''} ${isHandRaised ? styles['hand-raised-shake'] : ''} ${shouldShake ? styles['shake-once'] : ''} ${isSelected ? styles['selected'] : ''}`}
      onClick={onClick}
      style={{
        position: 'relative',
        zIndex: isHandRaised ? 10 : 5, // Higher z-index when hand is raised
        border: isSelected ? '3px solid #3b82f6' : isHandRaised ? '3px solid #f59e0b' : '3px solid transparent', // ✅ FIX: Use orange border for hand raised
        boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.5)' : isHandRaised ? '0 0 15px rgba(245, 158, 11, 0.6)' : 'none', // ✅ FIX: Orange glow for hand raised
        // ✅ FIX: Don't use transform here as it conflicts with shake animation - let CSS handle it
        transition: isHandRaised ? 'none' : 'all 0.3s ease', // ✅ FIX: Disable transition during shake to prevent conflicts
      }}
    >
      {/* ✅ Audio element for remote participants - local is muted to prevent echo */}
      <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      
      <div className={styles['thumbnail-video-container']}>
        {!isVideoOff && videoTrack ? (
          <video
            ref={videoRef}
            className={styles['thumbnail-video']}
            autoPlay
            playsInline
            muted
          />
        ) : (
          <div className={styles['thumbnail-avatar']}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className={styles['avatar-image']} />
            ) : (
              <div className={styles['avatar-placeholder']}>
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✅ Host Control Buttons - Only visible to host for non-local participants */}
      {currentUserIsHost && !isLocalParticipant && (
        <div style={{ 
          position: 'absolute', 
          top: '4px', 
          right: '4px', 
          display: 'flex', 
          gap: '4px', 
          zIndex: 1000 
        }}>
          {/* Lower Hand Button - Only show when hand is raised */}
          {isHandRaised && onLowerHand && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering onClick on parent
                onLowerHand && onLowerHand(participantId);
              }}
              title="참가자 손 내리기"
              style={{ 
                width: '32px', 
                height: '32px', 
                background: '#f59e0b', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 'bold'
              }}
            >
              ✋
            </button>
          )}
          
          {/* Remove/Kick Button */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering onClick on parent
              onKickParticipant && onKickParticipant({ participantId, name });
            }}
            title="참가자 퇴장"
            style={{ 
              width: '32px', 
              height: '32px', 
              background: '#ef4444', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
          >
            ✖
          </button>
        </div>
      )}

      <div className={styles['thumbnail-info']}>
        <div className={styles['participant-name']} style={{
          color: isHandRaised ? '#3b82f6' : isSelected ? '#3b82f6' : 'inherit',
          fontWeight: isHandRaised || isSelected ? 'bold' : 'normal',
          fontSize: isHandRaised ? '11px' : '12px'
        }}>
          {isHandRaised && (
            <span style={{ 
              marginRight: '4px',
              fontSize: '14px'
            }}>✋</span>
          )}
          {isHost && <span className={styles['host-badge']}>HOST</span>}
          {isSelected && (
            <span style={{ 
              marginRight: '6px',
              width: '8px',
              height: '8px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              display: 'inline-block',
              verticalAlign: 'middle'
            }}></span>
          )}
          {name}
        </div>
        
        <div className={styles['thumbnail-indicators']}>
          {isMuted && (
            <div className={`${styles['indicator']} ${styles['mic-off']}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 11C19 11.5523 18.5523 12 18 12C17.4477 12 17 11.5523 17 11V10C17 6.68629 14.3137 4 11 4C10.4477 4 10 3.55228 10 3C10 2.44772 10.4477 2 11 2C15.4183 2 19 5.58172 19 10V11Z" fill="currentColor"/>
                <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
          )}
          
          {isScreenSharing && (
            <div className={`${styles['indicator']} ${styles['screen-sharing']}`} title="화면 공유 중">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
              </svg>
            </div>
          )}
          
          {isWhiteboarding && (
            <div 
              className={`${styles['indicator']} ${styles['whiteboard']}`} 
              title="화이트보드 사용 중" 
              style={{
                backgroundColor: '#8b5cf6',
                color: 'white',
                borderRadius: '4px',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 20,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </div>
          )}
          
          {isHandRaised && (
            <div className={`${styles['indicator']} ${styles['hand-raised']}`}>
              ✋
            </div>
          )}
          
          {isSpeaking && (
            <div className={`${styles['indicator']} ${styles['speaking-wave']}`}>
              <span className={styles['wave-bar']}></span>
              <span className={styles['wave-bar']}></span>
              <span className={styles['wave-bar']}></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

