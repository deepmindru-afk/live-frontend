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
  isNetworkDisconnected?: boolean; // ✅ Show network issue overlay during grace period
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
  isNetworkDisconnected = false, // ✅ Network disconnection during grace period
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

  // 경쟁 조건 수정과 함께 화면 공유 트랙 연결
  useEffect(() => {
    const el = screenShareRef.current;
    if (!el || !screenShareTrack || !isScreenSharing) {
      // 트랙이 제거되면 정리
      if (el && screenShareRef.current) {
        try {
          screenShareTrack?.detach(el);
        } catch (err) {
          // detach 오류 무시
        }
      }
      return;
    }

    // 중요 수정: 연결하기 전에 트랙이 구독되고 준비되었는지 확인
    // 원격 트랙의 경우 구독되었는지 확인
    const isTrackReady = screenShareTrack.isSubscribed !== false && screenShareTrack.isMuted !== true;
    
    if (!isTrackReady) {
      // 트랙이 준비될 때까지 잠시 대기
      const waitTimer = setTimeout(() => {
        if (el && screenShareRef.current && screenShareTrack && isScreenSharing) {
          try {
            screenShareTrack.detach(el);
            screenShareTrack.attach(el);
          } catch (err) {
            console.error('[MainStageView] 화면 공유 트랙 연결 오류:', err);
          }
        }
      }, 100);
      return () => clearTimeout(waitTimer);
    }

    // 요소가 보일 때까지 대기
    if (el.offsetWidth === 0 || el.offsetHeight === 0) {
      const timer = setTimeout(() => {
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0 && screenShareTrack && isScreenSharing) {
          try {
            screenShareTrack.detach(el);
            screenShareTrack.attach(el);
          } catch (err) {
            console.error('[MainStageView] 화면 공유 트랙 연결 오류:', err);
          }
        }
      }, 200);
      return () => clearTimeout(timer);
    }

    // 경쟁 조건 방지를 위해 항상 연결 전에 분리
    try {
      screenShareTrack.detach(el);
      screenShareTrack.attach(el);
    } catch (err) {
      console.error('[MainStageView] 화면 공유 트랙 연결 오류:', err);
    }

    return () => {
      try {
        if (el && screenShareRef.current && screenShareTrack) {
          screenShareTrack.detach(el);
        }
      } catch (err) {
        // 정리 오류 무시
      }
    };
  }, [screenShareTrack, isScreenSharing]);

  // 중요: 소리를 위해 오디오 트랙 연결
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    if (!audioTrack) {
      audioElement.muted = true;
      audioElement.volume = 0;
      return;
    }

    const isLocal = isLocalParticipant || participantId === 'local';

    if (isLocal) {
      audioElement.muted = true;
      audioElement.volume = 0;
      try {
        audioTrack.detach(audioElement);
      } catch {}
      return () => {
        try {
          audioTrack.detach(audioElement);
        } catch {}
      };
    }

    try {
      audioTrack.detach(audioElement);
    } catch {}

    audioTrack.attach(audioElement);
    audioElement.muted = false;
    audioElement.volume = 1;

    return () => {
      try {
        audioTrack.detach(audioElement);
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
      {/* 참가자 오디오 재생을 위한 숨겨진 오디오 요소 - 녹화 중이 아닐 때 에코 방지를 위해 로컬 참가자 음소거 */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        muted={isLocalParticipant || participantId === 'local'}
        style={{ display: 'none' }}
      />
      
      {/* 메인 비디오 컨테이너 */}
      <div className={`${styles['main-stage-container']} ${isScreenSharing ? styles['screen-sharing'] : ''} ${isNetworkDisconnected ? styles['network-disconnected'] : ''}`} onClick={handleClick}>
        {/* 화면 공유 비디오 - 화면 공유 시 렌더링 */}
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
                backgroundColor: '#000000',
                filter: isNetworkDisconnected ? 'blur(8px)' : 'none',
                transition: 'filter 0.3s ease'
              }}
            />
          </>
        ) : (
          <>
            {/* 일반 카메라 비디오 */}
            {videoTrack && !isVideoOff ? (
              <video
                ref={mainVideoRef}
                autoPlay
                playsInline
                className={styles['main-stage-video']}
                style={{
                  filter: isNetworkDisconnected ? 'blur(8px)' : 'none',
                  transition: 'filter 0.3s ease'
                }}
              />
            ) : (
              // 비디오가 꺼져 있을 때 아바타/플레이스홀더
              <div className={styles['avatar-placeholder']} style={{
                filter: isNetworkDisconnected ? 'blur(8px)' : 'none',
                transition: 'filter 0.3s ease'
              }}>
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
        
        {/* ✅ Network Disconnection Overlay - Shows during grace period */}
        {isNetworkDisconnected && (
          <>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 1000,
              padding: '20px',
              textAlign: 'center'
            }}>
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.95)',
                borderRadius: '12px',
                padding: '24px 32px',
                maxWidth: '400px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                border: '2px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '16px',
                  animation: 'networkPulse 2s infinite'
                }}>
                  ⚠️
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  marginBottom: '12px'
                }}>
                  네트워크 연결 문제
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  lineHeight: '1.5',
                  marginBottom: '8px'
                }}>
                  연결을 복구하는 중입니다...<br/>
                  잠시만 기다려주세요.
                </div>
                <div style={{
                  marginTop: '16px',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    animation: 'networkPulse 1.5s infinite'
                  }}></div>
                  자동으로 재연결을 시도합니다
                </div>
              </div>
            </div>
            <style>{`
              @keyframes networkPulse {
                0%, 100% { 
                  opacity: 1; 
                  transform: scale(1);
                }
                50% { 
                  opacity: 0.6; 
                  transform: scale(1.1);
                }
              }
            `}</style>
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
