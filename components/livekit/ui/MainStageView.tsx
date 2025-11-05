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
  isRecording?: boolean; // ✅ Check if recording is active
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
  isRecording = false, // ✅ Whether recording is active
  onParticipantClick,
}) => {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach video track with race condition fixes
  useEffect(() => {
    const el = mainVideoRef.current;
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
        if (el && el.offsetWidth > 0 && !isVideoOff) {
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
  }, [videoTrack, isScreenSharing, isVideoOff]); // ✅ CRITICAL FIX: Include isVideoOff

  // Attach screen share track with race condition fixes
  useEffect(() => {
    const el = screenShareRef.current;
    if (!el || !screenShareTrack || !isScreenSharing) {
      // Cleanup if track is removed
      if (el && screenShareRef.current) {
        try {
          screenShareTrack?.detach(el);
        } catch (err) {
          // Ignore detach errors
        }
      }
      return;
    }

    // CRITICAL FIX: Ensure track is subscribed and ready before attaching
    // For remote tracks, check if they're subscribed
    const isTrackReady = screenShareTrack.isSubscribed !== false && screenShareTrack.isMuted !== true;
    
    if (!isTrackReady) {
      // Wait a bit for track to be ready
      const waitTimer = setTimeout(() => {
        if (el && screenShareRef.current && screenShareTrack && isScreenSharing) {
          try {
            screenShareTrack.detach(el);
            screenShareTrack.attach(el);
            console.log('[MainStageView] Screen share track attached after wait');
          } catch (err) {
            console.error('[MainStageView] Error attaching screen share track:', err);
          }
        }
      }, 100);
      return () => clearTimeout(waitTimer);
    }

    // Wait for element to be visible
    if (el.offsetWidth === 0 || el.offsetHeight === 0) {
      const timer = setTimeout(() => {
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0 && screenShareTrack && isScreenSharing) {
          try {
            screenShareTrack.detach(el);
            screenShareTrack.attach(el);
            console.log('[MainStageView] Screen share track attached to video element');
          } catch (err) {
            console.error('[MainStageView] Error attaching screen share track:', err);
          }
        }
      }, 200);
      return () => clearTimeout(timer);
    }

    // Always detach before attaching to prevent race conditions
    try {
      screenShareTrack.detach(el);
      screenShareTrack.attach(el);
      console.log('[MainStageView] Screen share track attached successfully');
    } catch (err) {
      console.error('[MainStageView] Error attaching screen share track:', err);
    }

    return () => {
      try {
        if (el && screenShareRef.current && screenShareTrack) {
          screenShareTrack.detach(el);
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    };
  }, [screenShareTrack, isScreenSharing]);

  // ✅ CRITICAL: Attach audio track for sound
  useEffect(() => {
    if (!audioRef.current || !audioTrack) return;

    // ✅ Always mute local participant audio
    if (isLocalParticipant || participantId === 'local') {
      audioRef.current.muted = true;
    }

    // Prevent duplicate playback
    try {
      audioTrack.detach(audioRef.current);
    } catch {}

    // Attach audio track safely
    audioTrack.attach(audioRef.current);

    // Force mute again just in case
    if (isLocalParticipant || participantId === 'local') {
      audioRef.current.muted = true;
      audioRef.current.volume = 0; // ✅ guarantee no playback
    }

    return () => {
      try {
        if (audioRef.current && audioTrack) {
          audioTrack.detach(audioRef.current);
        }
      } catch {}
    };
  }, [audioTrack, participantId, isLocalParticipant]);

  const handleClick = () => {
    if (onParticipantClick && participantId) {
      onParticipantClick(participantId);
    }
  };

  return (
    <div className={`${styles['main-stage-view']} ${isSpeaking ? styles['speaking'] : ''} ${isScreenSharing ? styles['screen-sharing'] : ''}`}>
      {/* ✅ Hidden audio element for playing participant audio - MUTE LOCAL PARTICIPANT TO PREVENT ECHO EXCEPT WHEN RECORDING */}
      <audio ref={audioRef} autoPlay playsInline muted={(isLocalParticipant || participantId === 'local') && !isRecording} style={{ display: 'none' }} />
      
      {/* Main Video Container */}
      <div className={styles['main-stage-container']} onClick={handleClick}>
        {/* Screen Share Video - Render when screen sharing */}
        {isScreenSharing && screenShareTrack ? (
          <>
            <video
              ref={screenShareRef}
              autoPlay
              playsInline
              muted={false}
              className={`${styles['main-stage-video']} ${styles['screen-share-video']}`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#000000'
              }}
              onLoadedMetadata={() => {
                console.log('[MainStageView] Screen share video metadata loaded');
              }}
              onCanPlay={() => {
                console.log('[MainStageView] Screen share video can play');
              }}
            />
          </>
        ) : (
          <>
            {/* Regular Camera Video */}
            {videoTrack && !isVideoOff ? (
              <video
                ref={mainVideoRef}
                autoPlay
                playsInline
                className={styles['main-stage-video']}
              />
            ) : (
              /* Avatar/Placeholder when video is off */
              <div className={styles['avatar-placeholder']}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name || '참가자'} />
                ) : (
                  <div className={styles['avatar-initial']}>
                    {name && name.length > 0 ? name.trim().charAt(0).toUpperCase() : '?'}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        {/* Participant Info Overlay - Bottom */}
        <div className={styles['participant-info']}>
          {isHost && <span className={styles['host-badge']}>호스트</span>}
          {isHandRaised && <span className={styles['hand-raised-badge']}>✋</span>}
          {isMuted && <span className={styles['muted-badge']}>🔇</span>}
          <span className={styles['participant-name']}>{name || '참가자'}</span>
        </div>
      </div>
    </div>
  );
};
