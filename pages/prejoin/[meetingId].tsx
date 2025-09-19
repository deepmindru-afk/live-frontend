import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
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
      console.log('🔍 PREJOIN: Fetching meeting info for ID:', meetingId);
      
      const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
        meetingId: meetingId as string
      });
      
      console.log('🔍 PREJOIN: Backend response:', result);
      
      if (result.getMeetingById) {
        const meeting: MeetingInfo = {
          _id: result.getMeetingById._id,
          title: result.getMeetingById.title,
          status: result.getMeetingById.status === 'CREATED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'SCHEDULED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'ENDED' ? 'ENDED' : 'SCHEDULED',
          inviteCode: result.getMeetingById.inviteCode
        };
        setMeetingInfo(meeting);
        console.log('🔍 PREJOIN: Successfully loaded meeting:', meeting);
      } else {
        throw new Error('Meeting not found');
      }
    } catch (error) {
      console.error('Error fetching meeting info:', error);
      await Swal.fire({
        icon: 'error',
        title: '미팅 정보 오류',
        text: '미팅 정보를 가져올 수 없습니다.',
        confirmButtonText: '확인'
      });
      router.push('/member'); // Default to member dashboard
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
        video: deviceSettings.cameraEnabled ? {
          deviceId: selectedDevices.camera ? { exact: selectedDevices.camera } : undefined
        } : false,
        audio: deviceSettings.microphoneEnabled ? {
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
      
      // Check if user is authenticated and get their role
      const { isAuthenticated, getCurrentUser } = await import('../../lib/simple-auth-handlers');
      
      if (isAuthenticated()) {
        const currentUser = await getCurrentUser();
        
        // If user is TUTOR (host), go directly to meeting room
        if (currentUser && currentUser.systemRole === 'TUTOR') {
          console.log('🎯 PREJOIN: User is TUTOR, going directly to meeting room');
          router.push(`/meeting/${meetingInfo._id}`);
          return;
        }
      }
      
      // For students/members, check meeting status and redirect accordingly
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
        <button onClick={() => router.push('/member')}>대시보드로 돌아가기</button>
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
          {/* Left Panel - Meeting Info and Join Button */}
          <div className="meeting-info-panel">
            <div className="meeting-header">
              <div className="connection-icon">📎</div>
              <h1>장치 연결</h1>
              <p>미팅 시작 전 장치가 정상적으로 연결 되었는지 확인하세요.</p>
            </div>
            
            <div className="meeting-details">
              <h3>{meetingInfo.title}</h3>
              <p>미팅 ID: {meetingInfo._id.slice(-8)}</p>
              <p>상태: {meetingInfo.status === 'STARTED' ? '진행 중' : '대기 중'}</p>
            </div>
            
            <button 
              className="join-button"
              onClick={handleJoinMeeting}
              disabled={isJoining}
            >
              {isJoining ? '참여 중...' : '미팅 입장하기'} →
            </button>
          </div>

          {/* Right Panel - Device Controls */}
          <div className="device-controls-panel">
            {/* Video Preview */}
            <div className="video-preview">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="preview-video"
              />
              {!deviceSettings.cameraEnabled && (
                <div className="camera-off-overlay">
                  <div className="camera-off-icon">📷</div>
                </div>
              )}
            </div>

            {/* Device Controls */}
            <div className="device-controls">
              {/* Camera Control */}
              <div className="device-control">
                <div className="device-header">
                  <span className="device-icon">📷</span>
                  <span>카메라</span>
                </div>
                
                {devices.cameras.length > 0 ? (
                  <div className="device-selection">
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
                    <button 
                      onClick={startPreview}
                      className="test-button"
                    >
                      미리보기
                    </button>
                  </div>
                ) : (
                  <div className="device-error">
                    <span>미디어 디바이스를 찾을 수 없습니다</span>
                  </div>
                )}
                
                <label className="device-checkbox">
                  <input
                    type="checkbox"
                    checked={deviceSettings.joinWithCameraOff}
                    onChange={(e) => handleSettingChange('joinWithCameraOff', e.target.checked)}
                  />
                  입장시 카메라 끄기
                </label>
              </div>

              {/* Microphone Control */}
              <div className="device-control">
                <div className="device-header">
                  <span className="device-icon">🎤</span>
                  <span>마이크</span>
                </div>
                
                {devices.microphones.length > 0 ? (
                  <div className="device-selection">
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
                    <button 
                      onClick={testMicrophone}
                      className="test-button"
                    >
                      TEST
                    </button>
                  </div>
                ) : (
                  <div className="device-error">
                    <span>미디어 디바이스를 찾을 수 없습니다</span>
                  </div>
                )}
                
                <label className="device-checkbox">
                  <input
                    type="checkbox"
                    checked={deviceSettings.joinWithMicOff}
                    onChange={(e) => handleSettingChange('joinWithMicOff', e.target.checked)}
                  />
                  입장시 마이크 끄기
                </label>
                
                <div className="audio-level">
                  <div className="level-bar"></div>
                </div>
              </div>

              {/* Speaker Control */}
              <div className="device-control">
                <div className="device-header">
                  <span className="device-icon">🔊</span>
                  <span>스피커</span>
                </div>
                
                {devices.speakers.length > 0 ? (
                  <div className="device-selection">
                    <select
                      value={selectedDevices.speaker}
                      onChange={(e) => handleDeviceChange('speaker', e.target.value)}
                      className="device-select"
                    >
                      {devices.speakers.map((speaker) => (
                        <option key={speaker.deviceId} value={speaker.deviceId}>
                          {speaker.label}
                        </option>
                      ))}
                    </select>
                    <button 
                      onClick={testSpeaker}
                      className="test-button"
                    >
                      TEST
                    </button>
                  </div>
                ) : (
                  <div className="device-error">
                    <span>미디어 디바이스를 찾을 수 없습니다</span>
                  </div>
                )}
                
                <label className="device-checkbox">
                  <input
                    type="checkbox"
                    checked={deviceSettings.joinWithSpeakerOff}
                    onChange={(e) => handleSettingChange('joinWithSpeakerOff', e.target.checked)}
                  />
                  입장시 스피커 끄기
                </label>
                
                <div className="volume-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    defaultValue="70"
                    className="volume-slider"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .prejoin-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .prejoin-content {
          display: flex;
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          max-width: 1200px;
          width: 100%;
          min-height: 600px;
        }

        .meeting-info-panel {
          flex: 1;
          padding: 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #f8f9ff;
        }

        .meeting-header {
          text-align: center;
        }

        .connection-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .meeting-header h1 {
          font-size: 2rem;
          color: #333;
          margin-bottom: 10px;
        }

        .meeting-header p {
          color: #666;
          font-size: 1rem;
          line-height: 1.5;
        }

        .meeting-details {
          background: white;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }

        .meeting-details h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .meeting-details p {
          margin: 5px 0;
          color: #666;
          font-size: 0.9rem;
        }

        .join-button {
          background: linear-gradient(135deg, #4A90E2, #357ABD);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 10px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .join-button:hover:not(:disabled) {
          background: linear-gradient(135deg, #357ABD, #2E6BA8);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(74, 144, 226, 0.3);
        }

        .join-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .device-controls-panel {
          flex: 1;
          padding: 40px;
          display: flex;
          flex-direction: column;
        }

        .video-preview {
          width: 100%;
          height: 200px;
          background: #000;
          border-radius: 10px;
          margin-bottom: 30px;
          position: relative;
          overflow: hidden;
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
          align-items: center;
          justify-content: center;
          background: #333;
        }

        .camera-off-icon {
          font-size: 48px;
          opacity: 0.5;
        }

        .device-controls {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .device-control {
          border: 2px solid #e1e5e9;
          border-radius: 10px;
          padding: 20px;
        }

        .device-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          font-weight: 600;
          color: #333;
        }

        .device-icon {
          font-size: 20px;
        }

        .device-selection {
          display: flex;
          gap: 10px;
          margin-bottom: 15px;
        }

        .device-select {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }

        .test-button {
          padding: 8px 16px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.3s ease;
        }

        .test-button:hover {
          background: #5a6268;
        }

        .device-error {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 15px;
          text-align: center;
          font-size: 14px;
        }

        .device-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #666;
          cursor: pointer;
        }

        .device-checkbox input[type="checkbox"] {
          margin: 0;
        }

        .audio-level {
          margin-top: 10px;
        }

        .level-bar {
          height: 4px;
          background: #e1e5e9;
          border-radius: 2px;
          position: relative;
        }

        .level-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 30%;
          background: #4A90E2;
          border-radius: 2px;
        }

        .volume-control {
          margin-top: 10px;
        }

        .volume-slider {
          width: 100%;
          height: 4px;
          background: #e1e5e9;
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
        }

        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #4A90E2;
          border-radius: 50%;
          cursor: pointer;
        }

        .loading-container, .error-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
            flex-direction: column;
            max-width: 500px;
          }
          
          .meeting-info-panel, .device-controls-panel {
            padding: 20px;
          }
        }
      `}</style>
    </>
  );
};

export default PreJoinPage;
