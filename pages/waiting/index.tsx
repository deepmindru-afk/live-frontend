import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { JOIN_MEETING_BY_CODE } from '../../apollo/meeting/mutations';
import Swal from 'sweetalert2';

interface DeviceStatus {
  camera: boolean;
  microphone: boolean;
  speaker: boolean;
}

interface MediaDevice {
  deviceId: string;
  label: string;
}

const WaitingRoom: React.FC = () => {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    camera: false,
    microphone: false,
    speaker: false
  });
  const [devices, setDevices] = useState<{
    cameras: MediaDevice[];
    microphones: MediaDevice[];
    speakers: MediaDevice[];
  }>({
    cameras: [],
    microphones: [],
    speakers: []
  });
  const [settings, setSettings] = useState({
    cameraOn: true,
    microphoneOn: true,
    speakerOn: true,
    volume: 50
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    checkDevices();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const checkDevices = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not supported');
        return;
      }

      // Get available devices
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = deviceList
        .filter(device => device.kind === 'videoinput')
        .map(device => ({ deviceId: device.deviceId, label: device.label || 'Camera' }));
      
      const microphones = deviceList
        .filter(device => device.kind === 'audioinput')
        .map(device => ({ deviceId: device.deviceId, label: device.label || 'Microphone' }));
      
      const speakers = deviceList
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({ deviceId: device.deviceId, label: device.label || 'Speaker' }));

      setDevices({ cameras, microphones, speakers });
      
      // Update device status
      setDeviceStatus({
        camera: cameras.length > 0,
        microphone: microphones.length > 0,
        speaker: speakers.length > 0
      });

      // Start camera preview if available
      if (cameras.length > 0) {
        startCameraPreview();
      }

    } catch (error) {
      console.error('Error checking devices:', error);
    }
  };

  const startCameraPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error starting camera preview:', error);
    }
  };

  const testMicrophone = async () => {
    try {
      await Swal.fire({
        title: '마이크 테스트',
        text: '3초간 녹음 후 재생됩니다.',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play();
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 3000);

    } catch (error) {
      console.error('Microphone test failed:', error);
      await Swal.fire({
        icon: 'error',
        title: '마이크 테스트 실패',
        text: '마이크에 접근할 수 없습니다.'
      });
    }
  };

  const testSpeaker = async () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU5k9n1unEiBC13yO/eizEIHWq+8+OWT');
      audio.volume = settings.volume / 100;
      await audio.play();
      
      await Swal.fire({
        icon: 'success',
        title: '스피커 테스트',
        text: '스피커가 정상적으로 작동합니다.'
      });
    } catch (error) {
      console.error('Speaker test failed:', error);
      await Swal.fire({
        icon: 'error',
        title: '스피커 테스트 실패',
        text: '스피커에 접근할 수 없습니다.'
      });
    }
  };

  const handleJoinMeeting = async () => {
    if (!inviteCode.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: '초대코드 필요',
        text: '초대코드를 입력해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚪 JOIN MEETING: Attempting to join meeting with code:', inviteCode);

      const result = await enhancedMakeGraphQLRequest(JOIN_MEETING_BY_CODE, {
        inviteCode: inviteCode.trim()
      });

      console.log('🚪 JOIN MEETING: Response received:', result);

      if (result.joinMeetingByCode && result.joinMeetingByCode.success) {
        const { meetingId } = result.joinMeetingByCode.meeting;
        
        await Swal.fire({
          icon: 'success',
          title: '미팅 입장 성공',
          text: '미팅에 성공적으로 입장했습니다!',
          confirmButtonText: '확인'
        });

        // Redirect to meeting page
        router.push(`/meeting/${meetingId}`);
      } else {
        throw new Error(result.joinMeetingByCode?.message || '미팅 입장에 실패했습니다.');
      }

    } catch (error: unknown) {
      console.error('🚪 JOIN MEETING: Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await Swal.fire({
        icon: 'error',
        title: '미팅 입장 실패',
        text: `미팅에 입장할 수 없습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const DeviceErrorBox = ({ type, icon, testFunction }: { type: string; icon: string; testFunction?: () => void }) => (
    <div style={{
      border: '2px solid #dc3545',
      borderRadius: '8px',
      padding: '12px',
      margin: '8px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#fff5f5'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: '20px', marginRight: '8px' }}>{icon}</span>
        <span style={{ color: '#dc3545', fontWeight: '500' }}>
          미디어 디바이스를 찾을 수 없습니다
        </span>
      </div>
      {testFunction && (
        <button
          onClick={testFunction}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          TEST
        </button>
      )}
    </div>
  );

  return (
    <>
      <Head>
        <title>미팅 대기실 - Meet: mate</title>
        <meta name="description" content="미팅 입장 전 장치 연결 확인" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '40px',
          maxWidth: '1000px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '40px'
        }}>
          {/* Left Section - Device Connection */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: '#e3f2fd',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '24px'
              }}>
                📎
              </div>
              <h2 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                marginBottom: '12px',
                color: '#333'
              }}>
                장치 연결
              </h2>
              <p style={{ 
                color: '#666', 
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                미팅 시작 전 장치가 정상적으로 연결 되었는지 확인하세요.
              </p>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '500',
                color: '#333'
              }}>
                초대코드
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="초대코드를 입력하세요"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '8px',
                  fontSize: '16px',
                  textAlign: 'center',
                  letterSpacing: '2px'
                }}
                maxLength={6}
              />
            </div>

            <button
              onClick={handleJoinMeeting}
              disabled={isLoading || !inviteCode.trim()}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: isLoading ? '#ccc' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? '입장 중...' : '미팅 입장하기'}
              {!isLoading && <span>→</span>}
            </button>
          </div>

          {/* Right Section - Video Preview and Device Settings */}
          <div>
            {/* Video Preview */}
            <div style={{
              width: '100%',
              height: '200px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {deviceStatus.camera ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📷</div>
                  <span>카메라를 찾을 수 없습니다</span>
                </div>
              )}
            </div>

            {/* Device Settings */}
            <div>
              {/* Camera Settings */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '8px', color: '#333' }}>카메라</h4>
                {!deviceStatus.camera ? (
                  <DeviceErrorBox type="camera" icon="📷" />
                ) : (
                  <div style={{
                    border: '2px solid #28a745',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#f8fff8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '20px' }}>📷</span>
                    <span style={{ color: '#28a745', fontWeight: '500' }}>
                      카메라가 연결되었습니다
                    </span>
                  </div>
                )}
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginTop: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={settings.cameraOn}
                    onChange={(e) => setSettings(prev => ({ ...prev, cameraOn: e.target.checked }))}
                    style={{ marginRight: '8px' }}
                  />
                  입장시 카메라 켜기
                </label>
              </div>

              {/* Microphone Settings */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '8px', color: '#333' }}>마이크</h4>
                {!deviceStatus.microphone ? (
                  <DeviceErrorBox type="microphone" icon="🎤" testFunction={testMicrophone} />
                ) : (
                  <div style={{
                    border: '2px solid #28a745',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#f8fff8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🎤</span>
                      <span style={{ color: '#28a745', fontWeight: '500' }}>
                        마이크가 연결되었습니다
                      </span>
                    </div>
                    <button
                      onClick={testMicrophone}
                      style={{
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      TEST
                    </button>
                  </div>
                )}
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginTop: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={settings.microphoneOn}
                    onChange={(e) => setSettings(prev => ({ ...prev, microphoneOn: e.target.checked }))}
                    style={{ marginRight: '8px' }}
                  />
                  입장시 마이크 켜기
                </label>
                <p style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  margin: '4px 0 0 0' 
                }}>
                  테스트시, 3초간 녹음 후 재생됩니다.
                </p>
              </div>

              {/* Speaker Settings */}
              <div>
                <h4 style={{ marginBottom: '8px', color: '#333' }}>스피커</h4>
                {!deviceStatus.speaker ? (
                  <DeviceErrorBox type="speaker" icon="🔊" testFunction={testSpeaker} />
                ) : (
                  <div style={{
                    border: '2px solid #28a745',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#f8fff8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>🔊</span>
                      <span style={{ color: '#28a745', fontWeight: '500' }}>
                        스피커가 연결되었습니다
                      </span>
                    </div>
                    <button
                      onClick={testSpeaker}
                      style={{
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      TEST
                    </button>
                  </div>
                )}
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginTop: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={settings.speakerOn}
                    onChange={(e) => setSettings(prev => ({ ...prev, speakerOn: e.target.checked }))}
                    style={{ marginRight: '8px' }}
                  />
                  입장시 스피커 켜기
                </label>
                <div style={{ marginTop: '8px' }}>
                  <label style={{ fontSize: '12px', color: '#666' }}>
                    볼륨: {settings.volume}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.volume}
                    onChange={(e) => setSettings(prev => ({ ...prev, volume: parseInt(e.target.value) }))}
                    style={{
                      width: '100%',
                      marginTop: '4px'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WaitingRoom;
