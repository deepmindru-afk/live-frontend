import React from 'react';
import mobileStyles from '../../styles/prejoin.mobile.module.css';

interface DeviceOption {
  deviceId: string;
  label: string;
}

interface DeviceCollections {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

interface PrejoinMobileProps {
  meetingTitle: string;
  meetingId: string;
  inviteCode?: string | null;
  isVideoOn: boolean;
  isMicOn: boolean;
  isSpeakerOn: boolean;
  isTestingDevices: boolean;
  isJoining: boolean;
  deviceError: string | null;
  joinError: string | null;
  localStream: MediaStream | null;
  availableDevices: DeviceCollections;
  selectedCamera: string;
  selectedMicrophone: string;
  selectedSpeaker: string;
  videoRef: React.RefObject<HTMLVideoElement> | React.MutableRefObject<HTMLVideoElement | null>;
  onToggleVideo: () => void;
  onToggleMic: () => void;
  onRefresh: () => void;
  onJoin: () => void;
  onSelectCamera: (deviceId: string) => void;
  onSelectMicrophone: (deviceId: string) => void;
  onSelectSpeaker: (deviceId: string) => void;
  cachedDeviceLabels: {
    camera?: string;
    microphone?: string;
    speaker?: string;
  };
  hasRequestedDevices: boolean;
}

const PrejoinMobile: React.FC<PrejoinMobileProps> = ({
  meetingTitle,
  meetingId,
  inviteCode,
  isVideoOn,
  isMicOn,
  isSpeakerOn,
  isTestingDevices,
  isJoining,
  deviceError,
  joinError,
  localStream,
  availableDevices,
  selectedCamera,
  selectedMicrophone,
  selectedSpeaker,
  videoRef,
  onToggleVideo,
  onToggleMic,
  onRefresh,
  onJoin,
  onSelectCamera,
  onSelectMicrophone,
  onSelectSpeaker,
  cachedDeviceLabels,
  hasRequestedDevices
}) => {
  const renderDeviceOptions = (devices: MediaDeviceInfo[], fallbackPrefix: string): DeviceOption[] =>
    devices.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `${fallbackPrefix} ${index + 1}`
    }));

  const cameraOptions =
    availableDevices.cameras.length > 0
      ? renderDeviceOptions(availableDevices.cameras, 'Camera')
      : cachedDeviceLabels.camera
      ? [
          {
            deviceId: selectedCamera || 'cached-camera',
            label: cachedDeviceLabels.camera
          }
        ]
      : [
          {
            deviceId: 'placeholder-camera',
            label: '장치 확인 버튼을 눌러 카메라를 불러오세요'
          }
        ];

  const microphoneOptions =
    availableDevices.microphones.length > 0
      ? renderDeviceOptions(availableDevices.microphones, 'Microphone')
      : cachedDeviceLabels.microphone
      ? [
          {
            deviceId: selectedMicrophone || 'cached-microphone',
            label: cachedDeviceLabels.microphone
          }
        ]
      : [
          {
            deviceId: 'placeholder-microphone',
            label: '장치 확인 버튼을 눌러 마이크를 불러오세요'
          }
        ];

  const speakerOptions =
    availableDevices.speakers.length > 0
      ? renderDeviceOptions(availableDevices.speakers, 'Speaker')
      : cachedDeviceLabels.speaker
      ? [
          {
            deviceId: selectedSpeaker || 'cached-speaker',
            label: cachedDeviceLabels.speaker
          }
        ]
      : [
          {
            deviceId: 'placeholder-speaker',
            label: '장치 확인 버튼을 눌러 스피커를 불러오세요'
          }
        ];

  const cameraValue = selectedCamera || (cameraOptions.length > 0 ? cameraOptions[0].deviceId : '');
  const microphoneValue =
    selectedMicrophone || (microphoneOptions.length > 0 ? microphoneOptions[0].deviceId : '');
  const speakerValue = selectedSpeaker || (speakerOptions.length > 0 ? speakerOptions[0].deviceId : '');

  const cameraSelectable = hasRequestedDevices && availableDevices.cameras.length > 0;
  const microphoneSelectable = hasRequestedDevices && availableDevices.microphones.length > 0;
  const speakerSelectable = hasRequestedDevices && availableDevices.speakers.length > 0;

  return (
    <div className={mobileStyles.mobilePage}>
      <div className={mobileStyles.mobileContent}>
        <header className={mobileStyles.mobileHeader}>
          <h1 className={mobileStyles.mobileHeaderTitle}>{meetingTitle}</h1>
          <div className={mobileStyles.mobileMeetingMeta}>
            {inviteCode && <span>예약코드 {inviteCode}</span>}
            <span>미팅 ID {meetingId}</span>
          </div>
        </header>

        <div className={mobileStyles.mobileCard}>
          <section className={mobileStyles.videoPanel}>
            <div className={mobileStyles.videoStage}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={!localStream || !isVideoOn ? mobileStyles.videoHidden : ''}
              />

              {localStream && isVideoOn && (
                <div className={mobileStyles.videoBadge}>
                  카메라 활성
                </div>
              )}

              {(!localStream || !isVideoOn) && (
                <div className={mobileStyles.videoPlaceholder}>
                  <div className={mobileStyles.videoPlaceholderIcon}>
                    <img src="/Icons/waitingRoom/waitingRoomCameraMain.svg" alt="카메라 아이콘" />
                  </div>
                  <div>카메라 및 마이크 테스트를 완료하고 시작하세요.</div>
                  <p className={mobileStyles.subtleText}>
                    하단 버튼으로 테스트를 실행하거나 장치를 새로고침할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            <div className={mobileStyles.videoControls}>
              <button
                type="button"
                className={`${mobileStyles.roundButton} ${isVideoOn ? mobileStyles.roundButtonPrimary : ''}`}
                onClick={onToggleVideo}
                disabled={!localStream}
              >
                <img
                  src={isVideoOn ? '/Icons/waitingRoom/onCamera.svg' : '/Icons/waitingRoom/offCamera.svg'}
                  alt={isVideoOn ? '카메라 켜짐' : '카메라 꺼짐'}
                />
                {isVideoOn ? '카메라 끄기' : '카메라 켜기'}
              </button>

              <button
                type="button"
                className={`${mobileStyles.roundButton} ${isMicOn ? mobileStyles.roundButtonPrimary : ''}`}
                onClick={onToggleMic}
                disabled={!localStream}
              >
                <img
                  src={isMicOn ? '/Icons/waitingRoom/unmutedMic.png' : '/Icons/waitingRoom/muteMic.png'}
                  alt={isMicOn ? '마이크 켜짐' : '마이크 꺼짐'}
                />
                {isMicOn ? '마이크 끄기' : '마이크 켜기'}
              </button>

              <button
                type="button"
                className={mobileStyles.roundButton}
                onClick={onRefresh}
                disabled={isTestingDevices}
              >
                <img src="/Icons/waitingRoom/reset.svg" alt="장치 새로고침" />
                새로고침
              </button>
            </div>
          </section>

          {deviceError && <div className={mobileStyles.deviceError}>{deviceError}</div>}

          <section className={mobileStyles.deviceCard}>
            <div className={mobileStyles.deviceHeader}>
              <span>장치 선택</span>
            </div>

            <div className={mobileStyles.deviceGroup}>
              <label className={mobileStyles.deviceField}>
                <span className={mobileStyles.deviceLabel}>카메라</span>
                <select
                  value={cameraValue}
                  onChange={(event) => onSelectCamera(event.target.value)}
                  className={mobileStyles.deviceSelect}
                  disabled={!cameraSelectable}
                >
                  {cameraOptions.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={mobileStyles.deviceField}>
                <span className={mobileStyles.deviceLabel}>마이크</span>
                <select
                  value={microphoneValue}
                  onChange={(event) => onSelectMicrophone(event.target.value)}
                  className={mobileStyles.deviceSelect}
                  disabled={!microphoneSelectable}
                >
                  {microphoneOptions.map((microphone) => (
                    <option key={microphone.deviceId} value={microphone.deviceId}>
                      {microphone.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={mobileStyles.deviceField}>
                <span className={mobileStyles.deviceLabel}>스피커</span>
                <select
                  value={speakerValue}
                  onChange={(event) => onSelectSpeaker(event.target.value)}
                  className={mobileStyles.deviceSelect}
                  disabled={!speakerSelectable}
                >
                  {speakerOptions.map((speaker) => (
                    <option key={speaker.deviceId} value={speaker.deviceId}>
                      {speaker.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              className={mobileStyles.confirmButton}
              onClick={onRefresh}
              disabled={isTestingDevices}
            >
              확인하기
            </button>

            {!hasRequestedDevices && (
              <p className={mobileStyles.subtleText}>
                확인하기를 눌러 장치 목록을 불러온 뒤 선택할 수 있습니다.
              </p>
            )}
          </section>

          <section className={mobileStyles.statusCard}>
            <h2 className={mobileStyles.statusTitle}>상태 확인</h2>
            <div className={mobileStyles.statusList}>
              <div className={mobileStyles.statusItem}>
                <span className={mobileStyles.statusLabel}>카메라</span>
                <span className={isVideoOn ? mobileStyles.statusValueSuccess : mobileStyles.statusValueError}>
                  {isVideoOn ? '연결 성공' : '테스트 필요'}
                </span>
              </div>
              <div className={mobileStyles.statusItem}>
                <span className={mobileStyles.statusLabel}>마이크</span>
                <span className={isMicOn ? mobileStyles.statusValueSuccess : mobileStyles.statusValueError}>
                  {isMicOn ? '연결 성공' : '테스트 필요'}
                </span>
              </div>
              <div className={mobileStyles.statusItem}>
                <span className={mobileStyles.statusLabel}>스피커</span>
                <span className={isSpeakerOn ? mobileStyles.statusValueSuccess : mobileStyles.statusValueError}>
                  {isSpeakerOn ? '연결 성공' : '테스트 필요'}
                </span>
              </div>
            </div>
          </section>

          {joinError && <div className={mobileStyles.errorBanner}>{joinError}</div>}

          <button
            type="button"
            className={mobileStyles.joinButton}
            onClick={onJoin}
            disabled={isJoining}
          >
            {isJoining ? '참여 중...' : '참여하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrejoinMobile;

