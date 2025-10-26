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
  isLocalParticipant?: boolean;
  isSelected?: boolean;
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
  isLocalParticipant = false,
  isSelected = false,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [shouldShake, setShouldShake] = useState(false);
  const previousHandRaised = useRef(isHandRaised);

  // Video track attachment with race condition fixes
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;

    if (el.offsetWidth === 0) {
      const timer = setTimeout(() => videoTrack.attach(el), 300);
      return () => clearTimeout(timer);
    }

    // Always detach before attaching to prevent race conditions
    videoTrack.detach(el);
    videoTrack.attach(el);

    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  // ✅ CRITICAL: Attach audio track for sound
  useEffect(() => {
    if (audioRef.current && audioTrack) {
      audioTrack.attach(audioRef.current);
      
      // CRITICAL FIX: Always mute local participant audio to prevent echo
      if (isLocalParticipant || participantId === 'local') {
        audioRef.current.muted = true;
      }
      
      return () => {
        if (audioTrack && audioRef.current) {
          audioTrack.detach(audioRef.current);
        }
      };
    }
  }, [audioTrack, participantId, isLocalParticipant]);

  // Shake animation when hand is raised
  useEffect(() => {
    // Trigger shake only when hand changes from NOT raised to RAISED
    if (isHandRaised && !previousHandRaised.current) {
      setShouldShake(true);
      
      // Remove shake class after animation completes (500ms)
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
        border: isSelected ? '3px solid #3b82f6' : isHandRaised ? '3px solid #3b82f6' : '3px solid transparent',
        boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.5)' : isHandRaised ? '0 0 15px rgba(59, 130, 246, 0.4)' : 'none',
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.3s ease',
        animation: isHandRaised ? 'shake-continuous 0.6s ease-in-out infinite' : 'none'
      }}
    >
      {/* ✅ Hidden audio element for playing participant audio - MUTE LOCAL PARTICIPANT TO PREVENT ECHO */}
      <audio ref={audioRef} autoPlay playsInline muted={isLocalParticipant || participantId === 'local'} style={{ display: 'none' }} />
      
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

      <div className={styles['thumbnail-info']}>
        <div className={styles['participant-name']} style={{
          color: isHandRaised ? '#3b82f6' : isSelected ? '#3b82f6' : 'inherit',
          fontWeight: isHandRaised || isSelected ? 'bold' : 'normal',
          fontSize: isHandRaised ? '11px' : '12px'
        }}>
          {isHandRaised && (
            <span style={{ 
              marginRight: '4px',
              fontSize: '10px'
            }}>✋</span>
          )}
          {isHost && <span className={styles['host-badge']}>HOST</span>}
          {isSelected && !isHandRaised && (
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
            <div className={`${styles['indicator']} ${styles['screen-sharing']}`} title="Sharing screen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
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

