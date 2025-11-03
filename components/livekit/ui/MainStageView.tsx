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
      return;
    }


    if (el.offsetWidth === 0) {
      const timer = setTimeout(() => {
        if (el && el.offsetWidth > 0) {
          screenShareTrack.detach(el);
          screenShareTrack.attach(el);
        }
      }, 800);
      return () => clearTimeout(timer);
    }

    // Always detach before attaching to prevent race conditions
    screenShareTrack.detach(el);
    screenShareTrack.attach(el);

    return () => {
      screenShareTrack.detach(el);
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
              className={`${styles['main-stage-video']} ${styles['screen-share-video']}`}
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
                  <img src={avatarUrl} alt={name || 'Participant'} />
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
          {isHost && <span className={styles['host-badge']}>Host</span>}
          {isHandRaised && <span className={styles['hand-raised-badge']}>✋</span>}
          {isMuted && <span className={styles['muted-badge']}>🔇</span>}
          <span className={styles['participant-name']}>{name || 'Participant'}</span>
        </div>
      </div>
    </div>
  );
};
