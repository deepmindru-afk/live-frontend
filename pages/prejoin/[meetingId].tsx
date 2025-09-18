import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { enhancedMakeGraphQLRequest } from '../../../lib/mock-graphql-service';
import Swal from 'sweetalert2';

interface DeviceInfo {
  deviceId: string;
  label: string;
}

interface MeetingInfo {
  _id: string;
  title: string;
  status: 'STARTED' | 'SCHEDULED' | 'ENDED';
  inviteCode: string;
}

const PreJoinPage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  
  // Device states
  const [devices, setDevices] = useState<{
    cameras: DeviceInfo[];
    microphones: DeviceInfo[];
    speakers: DeviceInfo[];
  }>({
    cameras: [],
    microphones: [],
    speakers: []
  });
  
  const [selectedDevices, setSelectedDevices] = useState({
    camera: '',
    microphone: '',
    speaker: ''
  });
  
  const [deviceSettings, setDeviceSettings] = useState({
    cameraEnabled: true,
    microphoneEnabled: true,
    speakerEnabled: true,
    joinWithCameraOff: false,
    joinWithMicOff: false,
    joinWithSpeakerOff: false
  });
  
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  
  // Refs for media streams
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (meetingId) {
      fetchMeetingInfo();
      getDevices();
    }
  }, [meetingId]);

  const fetchMeetingInfo = async () => {
    try {
      // This would be a real GraphQL query in production
      // For now, we'll use mock data
      const mockMeeting: MeetingInfo = {
        _id: meetingId as string,
        title: 'Sample Meeting',
        status: 'SCHEDULED', // This would come from the backend
        inviteCode: 'ABC123'
      };
      setMeetingInfo(mockMeeting);
    } catch (error) {
      console.error('Error fetching meeting info:', error);
      await Swal.fire({
        icon: 'error',
        title: '미팅 정보 오류',
        text: '미팅 정보를 가져올 수 없습니다.',
        confirmButtonText: '확인'
      });
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const getDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('Media devices not supported');
      }

      const deviceList = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = deviceList
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`
        }));
      
      const microphones = deviceList
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`
        }));
      
      const speakers = deviceList
        .filter(device => device.kind === 'audiooutput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`
        }));

      setDevices({ cameras, microphones, speakers });
      
      // Set default selections
      if (cameras.length > 0) {
        setSelectedDevices(prev => ({ ...prev, camera: cameras[0].deviceId }));
      }
      if (microphones.length > 0) {
        setSelectedDevices(prev => ({ ...prev, microphone: microphones[0].deviceId }));
      }
      if (speakers.length > 0) {
        setSelectedDevices(prev => ({ ...prev, speaker: speakers[0].deviceId }));
      }
    } catch (error) {
      console.error('Error getting devices:', error);
      await Swal.fire({
        icon: 'warning',
        title: '장치 감지 실패',
        text: '미디어 장치를 감지할 수 없습니다. 브라우저 권한을 확인해주세요.',
        confirmButtonText: '확인'
      });
    }
  };

  const startPreview = async () => {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: (deviceSettings.cameraEnabled && isVideoOn) ? {
          deviceId: selectedDevices.camera ? { exact: selectedDevices.camera } : undefined
        } : false,
        audio: (deviceSettings.microphoneEnabled && isMicOn) ? {
          deviceId: selectedDevices.microphone ? { exact: selectedDevices.microphone } : undefined
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error starting preview:', error);
      await Swal.fire({
        icon: 'error',
        title: '미디어 접근 실패',
        text: '카메라나 마이크에 접근할 수 없습니다. 브라우저 설정을 확인해주세요.',
        confirmButtonText: '확인'
      });
    }
  };

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedDevices.microphone ? { exact: selectedDevices.microphone } : undefined }
      });
      
      // Play a test sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
      
      stream.getTracks().forEach(track => track.stop());
      
      await Swal.fire({
        icon: 'success',
        title: '마이크 테스트',
        text: '마이크가 정상적으로 작동합니다.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Microphone test failed:', error);
      await Swal.fire({
        icon: 'error',
        title: '마이크 테스트 실패',
        text: '마이크에 접근할 수 없습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const testSpeaker = async () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1);
      
      await Swal.fire({
        icon: 'success',
        title: '스피커 테스트',
        text: '스피커가 정상적으로 작동합니다.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Speaker test failed:', error);
      await Swal.fire({
        icon: 'error',
        title: '스피커 테스트 실패',
        text: '스피커에 접근할 수 없습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleJoinMeeting = async () => {
    if (!meetingInfo) return;
    
    setIsJoining(true);
    
    try {
      // Stop preview
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Store device settings in localStorage for the meeting
      localStorage.setItem('meetingDeviceSettings', JSON.stringify({
        ...deviceSettings,
        selectedDevices
      }));
      
      // Check meeting status and redirect accordingly
      if (meetingInfo.status === 'STARTED') {
        // Meeting is already started, go directly to meeting
        router.push(`/meeting/${meetingInfo._id}`);
      } else {
        // Meeting not started yet, go to waiting room
        router.push(`/waiting?meetingId=${meetingInfo._id}&code=${meetingInfo.inviteCode}`);
      }
    } catch (error) {
      console.error('Error joining meeting:', error);
      await Swal.fire({
        icon: 'error',
        title: '미팅 참여 실패',
        text: '미팅에 참여할 수 없습니다.',
        confirmButtonText: '확인'
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleDeviceChange = (type: 'camera' | 'microphone' | 'speaker', deviceId: string) => {
    setSelectedDevices(prev => ({ ...prev, [type]: deviceId }));
  };

  const handleSettingChange = (setting: string, value: boolean) => {
    setDeviceSettings(prev => ({ ...prev, [setting]: value }));
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>미팅 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!meetingInfo) {
    return (
      <div className="error-container">
        <h2>미팅을 찾을 수 없습니다</h2>
        <button onClick={() => router.push('/dashboard')}>대시보드로 돌아가기</button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>HRDE - 미팅 참여 준비</title>
        <meta name="description" content="미팅 참여 전 장치를 확인하세요" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="prejoin-container">
        <div className="prejoin-content">
          {/* Header */}
          <div className="prejoin-header">
            <h1>{meetingInfo.title}</h1>
            <p>미팅 참여 전 장치를 확인하세요</p>
          </div>

          {/* Main Video Preview Area */}
          <div className="video-preview-container">
            <div className="video-preview">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="preview-video"
              />
              {!isVideoOn && (
                <div className="camera-off-overlay">
                  <div className="camera-off-icon">📷</div>
                  <p>카메라가 꺼져있습니다</p>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="control-buttons">
              <button 
                className={`control-button ${isVideoOn ? 'active' : 'inactive'}`}
                onClick={() => {
                  setIsVideoOn(!isVideoOn);
                  startPreview();
                }}
              >
                <span className="button-icon">
                  {isVideoOn ? '📹' : '📷'}
                </span>
                <span className="button-text">
                  {isVideoOn ? 'Video' : 'Video'}
                </span>
              </button>

              <button 
                className={`control-button ${isMicOn ? 'active' : 'inactive'}`}
                onClick={() => {
                  setIsMicOn(!isMicOn);
                  startPreview();
                }}
              >
                <span className="button-icon">
                  {isMicOn ? '🎤' : '🎤'}
                </span>
                <span className="button-text">
                  {isMicOn ? 'Audio' : 'Audio'}
                </span>
              </button>

              <button className="control-button backgrounds">
                <span className="button-icon">🎨</span>
                <span className="button-text">Backgrounds</span>
              </button>
            </div>

            {/* Device Selection */}
            <div className="device-selection">
              <div className="device-dropdown">
                <label>Audio</label>
                <select
                  value={selectedDevices.microphone}
                  onChange={(e) => handleDeviceChange('microphone', e.target.value)}
                  className="device-select"
                >
                  {devices.microphones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="device-dropdown">
                <label>Video</label>
                <select
                  value={selectedDevices.camera}
                  onChange={(e) => handleDeviceChange('camera', e.target.value)}
                  className="device-select"
                >
                  {devices.cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Settings */}
            <div className="settings-section">
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  checked={deviceSettings.joinWithCameraOff}
                  onChange={(e) => handleSettingChange('joinWithCameraOff', e.target.checked)}
                />
                입장시 카메라 끄기
              </label>
              
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  checked={deviceSettings.joinWithMicOff}
                  onChange={(e) => handleSettingChange('joinWithMicOff', e.target.checked)}
                />
                입장시 마이크 끄기
              </label>
            </div>
          </div>

          {/* Join Button */}
          <div className="join-section">
            <button 
              className="join-button"
              onClick={handleJoinMeeting}
              disabled={isJoining}
            >
              {isJoining ? '참여 중...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .prejoin-container {
          min-height: 100vh;
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .prejoin-content {
          background: #2d2d2d;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          max-width: 800px;
          width: 100%;
          min-height: 600px;
          display: flex;
          flex-direction: column;
        }

        .prejoin-header {
          padding: 30px 40px 20px;
          text-align: center;
          border-bottom: 1px solid #404040;
        }

        .prejoin-header h1 {
          font-size: 1.8rem;
          color: white;
          margin: 0 0 10px 0;
          font-weight: 600;
        }

        .prejoin-header p {
          color: #ccc;
          font-size: 1rem;
          margin: 0;
        }

        .video-preview-container {
          flex: 1;
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .video-preview {
          width: 100%;
          height: 300px;
          background: #000;
          border-radius: 15px;
          margin-bottom: 30px;
          position: relative;
          overflow: hidden;
          border: 2px solid #404040;
        }

        .preview-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-off-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #333;
          color: #ccc;
        }

        .camera-off-icon {
          font-size: 48px;
          margin-bottom: 10px;
          opacity: 0.7;
        }

        .camera-off-overlay p {
          margin: 0;
          font-size: 14px;
        }

        .control-buttons {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
        }

        .control-button {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 15px 20px;
          background: #404040;
          border: 2px solid #555;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 80px;
        }

        .control-button:hover {
          background: #505050;
          transform: translateY(-2px);
        }

        .control-button.active {
          background: #4A90E2;
          border-color: #357ABD;
        }

        .control-button.inactive {
          background: #dc3545;
          border-color: #c82333;
        }

        .control-button.backgrounds {
          background: #6c757d;
          border-color: #5a6268;
        }

        .button-icon {
          font-size: 24px;
        }

        .button-text {
          font-size: 12px;
          font-weight: 500;
        }

        .device-selection {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
          width: 100%;
          max-width: 400px;
        }

        .device-dropdown {
          flex: 1;
        }

        .device-dropdown label {
          display: block;
          color: #ccc;
          font-size: 14px;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .device-select {
          width: 100%;
          padding: 10px 12px;
          background: #404040;
          border: 1px solid #555;
          border-radius: 8px;
          color: white;
          font-size: 14px;
        }

        .device-select:focus {
          outline: none;
          border-color: #4A90E2;
        }

        .settings-section {
          display: flex;
          gap: 30px;
          margin-bottom: 30px;
        }

        .setting-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ccc;
          font-size: 14px;
          cursor: pointer;
        }

        .setting-checkbox input[type="checkbox"] {
          margin: 0;
          accent-color: #4A90E2;
        }

        .join-section {
          padding: 20px 40px 40px;
          text-align: center;
        }

        .join-button {
          background: linear-gradient(135deg, #4A90E2, #357ABD);
          color: white;
          border: none;
          padding: 15px 40px;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          min-width: 200px;
        }

        .join-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #357ABD, #2E6BA8);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(74, 144, 226, 0.3);
        }

        .join-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .loading-container, .error-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #1a1a1a;
          color: white;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .prejoin-content {
            max-width: 500px;
          }
          
          .prejoin-header, .video-preview-container, .join-section {
            padding: 20px;
          }

          .control-buttons {
            gap: 15px;
          }

          .control-button {
            min-width: 70px;
            padding: 12px 15px;
          }

          .device-selection {
            flex-direction: column;
            gap: 15px;
          }

          .settings-section {
            flex-direction: column;
            gap: 15px;
          }
        }
      `}</style>
    </>
  );
};

export default PreJoinPage;
