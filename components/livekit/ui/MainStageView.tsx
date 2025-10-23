import React, { useRef, useEffect } from 'react';
import styles from './RoomMain.module.scss';

interface MainStageViewProps {
  participantId?: string;
  name?: string;
  videoTrack?: any;
  audioTrack?: any;
  isSpeaking?: boolean;
  isHandRaised?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  avatarUrl?: string;
  isHost?: boolean;
  isScreenSharing?: boolean;
  screenShareTrack?: any;
  connectionQuality?: number;
  isLocalParticipant?: boolean;
  onParticipantClick?: (participantId: string) => void;
}

export const MainStageView: React.FC<MainStageViewProps> = ({
  participantId,
  name = 'Main Stage',
  videoTrack,
  audioTrack,
  isSpeaking = false,
  isHandRaised = false,
  isMuted = false,
  isVideoOff = false,
  avatarUrl,
  isHost = false,
  isScreenSharing = false,
  screenShareTrack,
  connectionQuality = 5,
  isLocalParticipant = false,
  onParticipantClick,
}) => {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach video track
  useEffect(() => {
    if (mainVideoRef.current && videoTrack && !isScreenSharing) {
      console.log('🎥 MAIN STAGE VIDEO ATTACH:', {
        participantId,
        name,
        hasVideoTrack: !!videoTrack,
        videoElement: !!mainVideoRef.current,
        isVideoOff,
        isScreenSharing,
        videoElementVisible: mainVideoRef.current.offsetWidth > 0 && mainVideoRef.current.offsetHeight > 0
      });
      
      videoTrack.attach(mainVideoRef.current);
      
      // Mobile debugging
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        console.log('📱 MOBILE VIDEO DEBUG:', {
          videoElement: mainVideoRef.current,
          videoElementStyle: window.getComputedStyle(mainVideoRef.current),
          videoElementRect: mainVideoRef.current.getBoundingClientRect(),
          videoElementDisplay: mainVideoRef.current.style.display,
          videoElementVisibility: mainVideoRef.current.style.visibility
        });
      }
      
      return () => {
        videoTrack.detach(mainVideoRef.current);
      };
    }
  }, [videoTrack, isScreenSharing, participantId, name, isVideoOff]);

  // Attach screen share track
  useEffect(() => {
    if (screenShareRef.current && screenShareTrack && isScreenSharing) {
      screenShareTrack.attach(screenShareRef.current);
      return () => {
        screenShareTrack.detach(screenShareRef.current);
      };
    }
  }, [screenShareTrack, isScreenSharing]);

  // ✅ CRITICAL: Attach audio track for sound
  useEffect(() => {
    if (audioRef.current && audioTrack) {
      audioTrack.attach(audioRef.current);
      
      // CRITICAL FIX: Always mute local participant audio to prevent echo
      if (isLocalParticipant || participantId === 'local') {
        audioRef.current.muted = true;
      }
      
      return () => {
        audioTrack.detach(audioRef.current);
      };
    }
  }, [audioTrack, participantId, isLocalParticipant]);

  const handleClick = () => {
    if (onParticipantClick && participantId) {
      onParticipantClick(participantId);
    }
  };

  return (
    <div className={`${styles['main-stage-view']} ${isSpeaking ? styles['speaking'] : ''} ${isScreenSharing ? styles['screen-sharing'] : ''}`}>
      {/* ✅ Hidden audio element for playing participant audio - MUTE LOCAL PARTICIPANT TO PREVENT ECHO */}
      <audio ref={audioRef} autoPlay playsInline muted={isLocalParticipant || participantId === 'local'} style={{ display: 'none' }} />
      
      {/* Main Video Container */}
      <div className={styles['main-stage-container']} onClick={handleClick}>
        {/* Screen Share Video */}
        {isScreenSharing && screenShareTrack ? (
          <video
            ref={screenShareRef}
            className={`${styles['main-stage-video']} ${styles['screen-share-video']}`}
            autoPlay
            playsInline
            muted
            style={{
              // Mobile screen share fixes
              width: '100%',
              height: '100%',
              objectFit: 'contain', // Show full content without cropping
              objectPosition: 'center',
              background: '#000000',
              display: 'block',
              visibility: 'visible',
              opacity: 1,
              zIndex: 1,
              position: 'relative'
            }}
          />
        ) : (
          <>
            {/* Regular Video */}
            {!isVideoOff && videoTrack && !isScreenSharing ? (
              <video
                ref={mainVideoRef}
                className={styles['main-stage-video']}
                autoPlay
                playsInline
                muted
                style={{
                  // Mobile-specific fixes
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  visibility: 'visible',
                  opacity: 1,
                  zIndex: 1,
                  position: 'relative'
                }}
              />
            ) : (
              /* Beautiful Name Display When No Video */
              <div className={styles['main-stage-no-video']}>
                <div className={styles['no-video-content']}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className={styles['no-video-avatar']} />
                  ) : (
                    <div className={styles['no-video-avatar-placeholder']}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles['no-video-name']}>
                    {name}
                  </div>
                  <div className={styles['no-video-subtitle']}>
                    {isHost ? 'Host' : 'Participant'}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Mobile Video Debug Overlay */}
        {typeof window !== 'undefined' && window.innerWidth <= 768 && videoTrack && !isVideoOff && (
          <div style={{
            position: 'absolute',
            top: '1vh',
            right: '1vw',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '0.8vh',
            borderRadius: '0.4vh',
            fontSize: '1.2vh',
            zIndex: 1000,
            fontFamily: 'monospace'
          }}>
            Video: {mainVideoRef.current ? 'Attached' : 'Not Attached'}
            <br />
            Size: {mainVideoRef.current ? `${mainVideoRef.current.offsetWidth}x${mainVideoRef.current.offsetHeight}` : 'N/A'}
            <br />
            Viewport: {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}
          </div>
        )}

        {/* Overlay Information */}
        <div className={styles['main-stage-overlay']}>
          {/* Top Bar - Participant Info */}
          <div className={styles['main-stage-top-bar']}>
            <div className={styles['participant-info']}>
              {isHost && <span className={styles['host-badge']}>HOST</span>}
              <span className={styles['participant-name']}>{name}</span>
            </div>
            
            {/* Connection Quality Indicator */}
            <div className={styles['connection-quality']}>
              <div className={`${styles['quality-bar']} ${connectionQuality >= 4 ? styles['excellent'] : connectionQuality >= 3 ? styles['good'] : connectionQuality >= 2 ? styles['fair'] : styles['poor']}`}>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>

          {/* Bottom Bar - Status Indicators */}
          <div className={styles['main-stage-bottom-bar']}>
            <div className={styles['status-indicators']}>
              {/* Microphone Status */}
              <div className={`${styles['status-indicator']} ${styles['mic-status']} ${isMuted ? styles['muted'] : styles['unmuted']}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  {isMuted ? (
                    <>
                      <path d="M19 11C19 11.5523 18.5523 12 18 12C17.4477 12 17 11.5523 17 11V10C17 6.68629 14.3137 4 11 4C10.4477 4 10 3.55228 10 3C10 2.44772 10.4477 2 11 2C15.4183 2 19 5.58172 19 10V11Z" fill="currentColor"/>
                      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2"/>
                    </>
                  ) : (
                    <>
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                      <path d="M17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                    </>
                  )}
                </svg>
              </div>

              {/* Camera Status */}
              <div className={`${styles['status-indicator']} ${styles['camera-status']} ${isVideoOff ? styles['off'] : styles['on']}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  {isVideoOff ? (
                    <>
                      <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                    </>
                  ) : (
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  )}
                </svg>
              </div>

              {/* Screen Share Indicator */}
              {isScreenSharing && (
                <div className={`${styles['status-indicator']} ${styles['screen-share-status']}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 10l4-4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}

              {/* Hand Raise Indicator */}
              {isHandRaised && (
                <div className={`${styles['status-indicator']} ${styles['hand-raise-status']}`}>
                  <span className={styles['hand-emoji']}>✋</span>
                </div>
              )}
            </div>
          </div>

          {/* Speaking Indicator */}
          {isSpeaking && (
            <div className={styles['speaking-indicator']}>
              <div className={styles['speaking-wave']}>
                <span className={styles['wave-bar']}></span>
                <span className={styles['wave-bar']}></span>
                <span className={styles['wave-bar']}></span>
                <span className={styles['wave-bar']}></span>
                <span className={styles['wave-bar']}></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
