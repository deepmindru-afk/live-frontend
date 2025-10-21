import React, { useRef, useEffect } from 'react';
import styles from './RoomMain.module.scss';

interface ShareScreenProps {
  screenShareTrack?: any;
  participantName?: string;
  participantId?: string;
  isActive?: boolean;
  onClose?: () => void;
}

export const ShareScreen: React.FC<ShareScreenProps> = ({
  screenShareTrack,
  participantName = 'Unknown',
  participantId,
  isActive = false,
  onClose,
}) => {
  const screenShareRef = useRef<HTMLVideoElement>(null);

  // Attach screen share track
  useEffect(() => {
    if (screenShareRef.current && screenShareTrack && isActive) {
      screenShareTrack.attach(screenShareRef.current);
      return () => {
        screenShareTrack.detach(screenShareRef.current);
      };
    }
  }, [screenShareTrack, isActive]);

  if (!isActive || !screenShareTrack) {
    return null;
  }

  return (
    <div className={styles['share-screen-container']}>
      {/* Header Bar */}
      <div className={styles['share-screen-header']}>
        <div className={styles['share-screen-info']}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
          </svg>
          <span className={styles['sharing-label']}>
            {participantName} is sharing screen
          </span>
        </div>
        
        {onClose && (
          <button 
            className={styles['share-screen-close']}
            onClick={onClose}
            aria-label="Exit screen share view"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {/* Screen Share Video */}
      <div className={styles['share-screen-video-container']}>
        <video
          ref={screenShareRef}
          className={styles['share-screen-video']}
          autoPlay
          playsInline
          muted
        />
      </div>

      {/* Footer Info */}
      <div className={styles['share-screen-footer']}>
        <div className={styles['screen-share-status-indicator']}>
          <span className={styles['live-dot']}></span>
          <span>Live</span>
        </div>
      </div>
    </div>
  );
};


