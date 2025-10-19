import React, { useRef, useEffect } from 'react';
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
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoTrack) {
      // Attach the video track to the video element
      videoTrack.attach(videoRef.current);
      
      return () => {
        // Clean up: detach the track when component unmounts or track changes
        if (videoTrack && videoRef.current) {
          videoTrack.detach(videoRef.current);
        }
      };
    }
  }, [videoTrack, participantId, name, isVideoOff]);

  return (
    <div 
      className={`${styles['participant-thumbnail']} ${isSpeaking ? styles['speaking'] : ''} ${isHandRaised ? styles['hand-raised'] : ''}`}
      onClick={onClick}
    >
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
        <div className={styles['participant-name']}>
          {isHost && <span className={styles['host-badge']}>HOST</span>}
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

