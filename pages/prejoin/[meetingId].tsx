import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import { makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
import { CREATE_MEETING, START_MEETING, JOIN_MEETING } from '../../apollo/meeting/mutations';
import { CreateMeetingInput, JoinParticipantInput } from '../../types/meeting';
import { isValidObjectId, getInvalidIdErrorMessage } from '../../lib/validation';
import styles from '../../styles/prejoin.module.css';
import PrejoinMobile from '../../components/prejoin/PrejoinMobile';

interface MeetingInfo {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
}

type DeviceCollections = {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
};

const PrejoinPage = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasRedirectedToWaiting, setHasRedirectedToWaiting] = useState<boolean>(false);
  
  // Device testing states
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isTestingDevices, setIsTestingDevices] = useState(false);
  
  // Device selection states
  const [availableDevices, setAvailableDevices] = useState<DeviceCollections>({
    cameras: [],
    microphones: [],
    speakers: []
  });
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [hasRequestedDevices, setHasRequestedDevices] = useState(false);
  const [cachedDeviceLabels, setCachedDeviceLabels] = useState<{
    camera: string;
    microphone: string;
    speaker: string;
  }>({
    camera: '',
    microphone: '',
    speaker: ''
  });
  
  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [loadingTimeoutReached, setLoadingTimeoutReached] = useState(false);

  const createMockDevice = (deviceId: string, label: string, kind: MediaDeviceKind): MediaDeviceInfo => ({
    deviceId,
    groupId: '',
    kind,
    label,
    toJSON: () => ({
      deviceId,
      groupId: '',
      kind,
      label
    })
  } as MediaDeviceInfo);

  const syncSelectionWithStorage = useCallback((
    key: 'camera' | 'microphone' | 'speaker',
    list: MediaDeviceInfo[],
    currentId: string,
    setSelection: React.Dispatch<React.SetStateAction<string>>
  ): string => {
    if (typeof window === 'undefined') {
      return currentId;
    }

    if (list.length === 0) {
      sessionStorage.removeItem(`prejoin_${key}_device_id`);
      sessionStorage.removeItem(`prejoin_${key}_label`);
      setCachedDeviceLabels(prev => ({
        ...prev,
        [key]: ''
      }));
      return '';
    }

    let resolvedId = currentId;

    if (!resolvedId || !list.some(device => device.deviceId === resolvedId)) {
      resolvedId = list[0].deviceId;
      setSelection(resolvedId);
    }

    const resolvedDevice =
      list.find(device => device.deviceId === resolvedId) ?? list[0];
    const fallbackPrefix =
      key === 'camera' ? 'Camera' : key === 'microphone' ? 'Microphone' : 'Speaker';
    const resolvedLabel =
      resolvedDevice.label ||
      `${fallbackPrefix} ${list.findIndex(device => device.deviceId === resolvedDevice.deviceId) + 1}`;

    sessionStorage.setItem(`prejoin_${key}_device_id`, resolvedId);
    sessionStorage.setItem(`prejoin_${key}_label`, resolvedLabel);
    setCachedDeviceLabels(prev => ({
      ...prev,
      [key]: resolvedLabel
    }));

    return resolvedId;
  }, [setCachedDeviceLabels]);

  const getTimestamp = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const logPerformance = (label: string, durationMs: number) => {
    if (typeof console !== 'undefined') {
      console.info(`[Prejoin] ${label} took ${durationMs.toFixed(0)}ms`);
    }
  };

  useEffect(() => {
  }, [meetingId, isLoading, meetingInfo]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

useEffect(() => {
  if (typeof window === 'undefined') return;

  setLoadingTimeoutReached(false);
  if (!isLoading) return;

  const timeoutId = window.setTimeout(() => {
    setLoadingTimeoutReached(true);
  }, 8000);

  return () => {
    window.clearTimeout(timeoutId);
  };
}, [isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCameraId = sessionStorage.getItem('prejoin_camera_device_id');
    const storedMicrophoneId = sessionStorage.getItem('prejoin_microphone_device_id');
    const storedSpeakerId = sessionStorage.getItem('prejoin_speaker_device_id');

    const storedCameraLabel = sessionStorage.getItem('prejoin_camera_label') || '';
    const storedMicrophoneLabel = sessionStorage.getItem('prejoin_microphone_label') || '';
    const storedSpeakerLabel = sessionStorage.getItem('prejoin_speaker_label') || '';

    setCachedDeviceLabels({
      camera: storedCameraLabel,
      microphone: storedMicrophoneLabel,
      speaker: storedSpeakerLabel
    });

    if (storedCameraId) {
      setSelectedCamera(storedCameraId);
    }
    if (storedMicrophoneId) {
      setSelectedMicrophone(storedMicrophoneId);
    }
    if (storedSpeakerId) {
      setSelectedSpeaker(storedSpeakerId);
    }

    const cachedCameras =
      storedCameraId && storedCameraLabel
        ? [createMockDevice(storedCameraId, storedCameraLabel, 'videoinput')]
        : [];
    const cachedMicrophones =
      storedMicrophoneId && storedMicrophoneLabel
        ? [createMockDevice(storedMicrophoneId, storedMicrophoneLabel, 'audioinput')]
        : [];
    const cachedSpeakers =
      storedSpeakerId && storedSpeakerLabel
        ? [createMockDevice(storedSpeakerId, storedSpeakerLabel, 'audiooutput')]
        : [];

    if (cachedCameras.length || cachedMicrophones.length || cachedSpeakers.length) {
      setAvailableDevices({
        cameras: cachedCameras,
        microphones: cachedMicrophones,
        speakers: cachedSpeakers
      });
    }
  }, []);

  // Load available devices only after explicit user action
  const loadAvailableDevices = useCallback(async (): Promise<DeviceCollections> => {
    const loadStart = getTimestamp();
    const empty: DeviceCollections = { cameras: [], microphones: [], speakers: [] };

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return empty;
    }

    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tempStream.getTracks().forEach(track => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      const speakers = devices.filter(device => device.kind === 'audiooutput');

      setAvailableDevices({ cameras, microphones, speakers });
      setHasRequestedDevices(true);

      syncSelectionWithStorage('camera', cameras, selectedCamera, setSelectedCamera);
      syncSelectionWithStorage('microphone', microphones, selectedMicrophone, setSelectedMicrophone);
      syncSelectionWithStorage('speaker', speakers, selectedSpeaker, setSelectedSpeaker);

      const duration = getTimestamp() - loadStart;
      logPerformance('loadAvailableDevices', duration);
      return { cameras, microphones, speakers };
    } catch (error) {
      console.error('Error loading devices:', error);
      logPerformance('loadAvailableDevices (failed)', getTimestamp() - loadStart);
      return empty;
    }
  }, [selectedCamera, selectedMicrophone, selectedSpeaker, syncSelectionWithStorage]);

  // Device testing functions
  const testDevices = async () => {
    const overallStart = getTimestamp();
    setIsTestingDevices(true);
    setDeviceError(null);
    
    try {
      // First, check what devices are available
      const enumerateStart = getTimestamp();
      const devices = await navigator.mediaDevices.enumerateDevices();
      logPerformance('Device enumeration', getTimestamp() - enumerateStart);
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      
      // Check for missing devices
      const warnings: string[] = [];
      if (videoInputs.length === 0) {
        warnings.push('카메라를 찾을 수 없습니다. 비디오 통화를 위해 카메라를 연결해 주세요.');
      }
      if (audioInputs.length === 0) {
        warnings.push('마이크를 찾을 수 없습니다. 오디오 통화를 위해 마이크를 연결해 주세요.');
      }
      
      if (warnings.length > 0) {
        setDeviceError(warnings.join(' '));
        setIsTestingDevices(false);
        return;
      }

      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      const speakers = devices.filter(device => device.kind === 'audiooutput');

      setAvailableDevices({ cameras, microphones, speakers });
      setHasRequestedDevices(true);

      syncSelectionWithStorage('camera', cameras, selectedCamera, setSelectedCamera);
      syncSelectionWithStorage('microphone', microphones, selectedMicrophone, setSelectedMicrophone);
      syncSelectionWithStorage('speaker', speakers, selectedSpeaker, setSelectedSpeaker);
      
      // Request camera and microphone access with selected devices
      const constraints: MediaStreamConstraints = {
        video: selectedCamera ? {
          deviceId: { exact: selectedCamera },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: selectedMicrophone ? {
          deviceId: { exact: selectedMicrophone }
        } : true
      };
      
      const mediaStart = getTimestamp();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      logPerformance('Prejoin device getUserMedia', getTimestamp() - mediaStart);
      
      // Set audio output device if speaker is selected
      if (selectedSpeaker && audioRef.current && 'setSinkId' in audioRef.current) {
        try {
          await (audioRef.current as any).setSinkId(selectedSpeaker);
        } catch (err) {
          console.warn('Could not set audio output device:', err);
        }
      }
      
      setLocalStream(stream);
      
      // Check if we actually got video and audio tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      
      if (videoTracks.length === 0) {
        setDeviceError('카메라 접근이 거부되었거나 카메라가 연결되어 있지 않습니다. 권한과 장치를 확인해 주세요.');
        setIsTestingDevices(false);
        return;
      }
      
      if (audioTracks.length === 0) {
        setDeviceError('마이크 접근이 거부되었거나 마이크가 연결되어 있지 않습니다. 권한과 장치를 확인해 주세요.');
        setIsTestingDevices(false);
        return;
      }
      
      // Set up video with proper event handling
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setIsVideoOn(true);
            setDeviceError(null); // Clear any previous errors
          }).catch((playError) => {
            setDeviceError('Camera preview failed to play');
          });
        };
        
        videoRef.current.onerror = (error) => {
          setDeviceError('Camera preview failed to load');
        };
        
        videoRef.current.oncanplay = () => {
          setDeviceError(null); // Clear any previous errors
        };
      } else {
        // Don't set error immediately, wait a bit for the ref to be available
        setTimeout(() => {
          if (!videoRef.current) {
            setDeviceError('비디오 요소를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.');
          }
        }, 100);
      }
      
      // Set up audio - CRITICAL FIX: Don't play local mic audio back to self
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.muted = true; // Always mute local audio to prevent echo
        setIsMicOn(true);
      }
      
      // Test speaker with a simple beep
      testSpeaker();
      
    } catch (error: any) {
      
      // Provide specific error messages based on the error type
      if (error.name === 'NotAllowedError') {
        setDeviceError('카메라와 마이크 접근이 거부되었습니다. 브라우저 권한을 허용한 뒤 다시 시도해 주세요.');
      } else if (error.name === 'NotFoundError') {
        setDeviceError('카메라 또는 마이크를 찾을 수 없습니다. 장치를 연결한 뒤 다시 시도해 주세요.');
      } else if (error.name === 'NotReadableError') {
        setDeviceError('다른 프로그램이 카메라 또는 마이크를 사용 중입니다. 해당 프로그램을 종료한 뒤 다시 시도해 주세요.');
      } else if (error.name === 'OverconstrainedError') {
        setDeviceError('해당 카메라 설정을 사용할 수 없습니다. 다른 설정으로 다시 시도해 주세요.');
      } else {
        setDeviceError('카메라 또는 마이크에 접근하지 못했습니다. 장치와 권한을 확인해 주세요.');
      }
    } finally {
      setIsTestingDevices(false);
      logPerformance('Device test total', getTimestamp() - overallStart);
    }
  };

  const testSpeaker = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
      
      setIsSpeakerOn(true);
    } catch (error) {
      // Don't set device error for speaker test failure as it's not critical
      // Just log it and continue
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
        setIsVideoOn(!isVideoOn);
        // Clear any errors when toggling video
        if (videoTrack.enabled) {
          setDeviceError(null);
        }
      }
    }
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
      }
    }
  };

  const handleRefresh = async () => {
    const refreshStart = getTimestamp();
    await loadAvailableDevices();
    await testDevices();
    logPerformance('Full refresh + test', getTimestamp() - refreshStart);
  };

  const stopDeviceTest = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsVideoOn(false);
    setIsMicOn(false);
    setIsSpeakerOn(false);
    setDeviceError(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  const handleCameraSelect = (deviceId: string) => {
    const resolvedId = syncSelectionWithStorage('camera', availableDevices.cameras, deviceId, setSelectedCamera);
    if (localStream && resolvedId) {
      switchCamera(resolvedId);
    }
  };

  const handleMicrophoneSelect = (deviceId: string) => {
    const resolvedId = syncSelectionWithStorage('microphone', availableDevices.microphones, deviceId, setSelectedMicrophone);
    if (localStream && resolvedId) {
      switchMicrophone(resolvedId);
    }
  };

  const handleSpeakerSelect = (deviceId: string) => {
    const resolvedId = syncSelectionWithStorage('speaker', availableDevices.speakers, deviceId, setSelectedSpeaker);
    if (resolvedId) {
      switchSpeaker(resolvedId);
    }
  };

  // Ensure video element is properly set up
  useEffect(() => {
    if (localStream && videoRef.current) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().then(() => {
        setIsVideoOn(true);
        setDeviceError(null);
      }).catch((error) => {
        setDeviceError('Camera preview failed to play');
      });
    }
  }, [localStream]);

  // Switch camera device
  const switchCamera = async (deviceId: string) => {
    if (!localStream) return;
    
    try {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStream.removeTrack(videoTrack);
        
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        const newVideoTrack = newVideoStream.getVideoTracks()[0];
        localStream.addTrack(newVideoTrack);
        
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }
        
        setSelectedCamera(deviceId);
      }
    } catch (error) {
      setDeviceError('카메라 전환에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  // Switch microphone device
  const switchMicrophone = async (deviceId: string) => {
    if (!localStream) return;
    
    try {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.stop();
        localStream.removeTrack(audioTrack);
        
        const newAudioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId }
          }
        });
        
        const newAudioTrack = newAudioStream.getAudioTracks()[0];
        localStream.addTrack(newAudioTrack);
        
        setSelectedMicrophone(deviceId);
      }
    } catch (error) {
      setDeviceError('마이크 전환에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  // Switch speaker device
  const switchSpeaker = async (deviceId: string) => {
    try {
      if (audioRef.current && 'setSinkId' in audioRef.current) {
        await (audioRef.current as any).setSinkId(deviceId);
        setSelectedSpeaker(deviceId);
      }
    } catch (error) {
      setDeviceError('스피커 전환에 실패했습니다. 다시 시도해 주세요.');
    }
  };

  // Refresh device list only after the user has explicitly requested it
  useEffect(() => {
    if (!hasRequestedDevices) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) return;

    const handleDeviceChange = () => {
      loadAvailableDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [hasRequestedDevices, loadAvailableDevices]);

  const fetchMeetingInfo = async () => {
    try {
      
      // Check if meetingId is a valid MongoDB ObjectId
      if (!isValidObjectId(meetingId as string)) {
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Meeting ID',
          text: getInvalidIdErrorMessage(meetingId as string),
          confirmButtonText: 'Go to Dashboard'
        });
        router.push('/instructor');
        return;
      }
      
      // Wrap the GraphQL request in a try-catch to handle auth errors gracefully
      let result;
      try {
        result = await makeGraphQLRequest(GET_MEETING_BY_ID, {
        meetingId: meetingId as string
      });
      } catch (authError: any) {
        // Handle authentication errors immediately
        if (authError.message === 'JWT_EXPIRED' || authError.message === 'TOKEN_NOT_EXIST' || authError.message === 'Invalid credentials') {
          await Swal.fire({
            icon: 'warning',
            title: '세션이 만료되었습니다',
            text: '다시 로그인해 주세요.',
            confirmButtonText: '로그인',
            showCancelButton: true,
            cancelButtonText: '취소'
          }).then((result) => {
            if (result.isConfirmed) {
              // Clear any stored tokens
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              // Redirect to login
              router.push('/login');
            } else {
              // Redirect to dashboard
              router.push('/instructor');
            }
          });
          return;
        }
        // Re-throw other errors
        throw authError;
      }
      
      
      if (result.getMeetingById) {
        // Check if required fields exist
        if (!result.getMeetingById._id) {
          throw new Error('Meeting ID is missing from response');
        }
        
        const meeting: MeetingInfo = {
          _id: result.getMeetingById._id,
          title: result.getMeetingById.title || 'Untitled Meeting',
          status: result.getMeetingById.status === 'CREATED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'SCHEDULED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'ENDED' ? 'ENDED' : 'SCHEDULED',
          inviteCode: result.getMeetingById.inviteCode || 'N/A'
        };
        
        setMeetingInfo(meeting);
      } else {
        throw new Error('Meeting not found');
      }
    } catch (error: any) {
      
      // Handle authentication errors specifically
      if (error.message === 'JWT_EXPIRED' || error.message === 'TOKEN_NOT_EXIST' || error.message === 'Invalid credentials') {
        await Swal.fire({
          icon: 'warning',
          title: '세션이 만료되었습니다',
          text: '다시 로그인해 주세요.',
          confirmButtonText: '로그인',
          showCancelButton: true,
          cancelButtonText: '취소'
        }).then((result) => {
          if (result.isConfirmed) {
            // Clear any stored tokens
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Redirect to login
            router.push('/login');
          } else {
            // Redirect to dashboard
            router.push('/dashboard');
          }
        });
      } else {
        // Handle other errors
      const errorMessage = error.message || '미팅 정보를 가져올 수 없습니다.';
      await Swal.fire({
        icon: 'error',
        title: '미팅 정보 오류',
        text: errorMessage,
        confirmButtonText: '확인'
      });
      router.push('/instructor'); // Redirect to instructor dashboard
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (meetingId) {
      fetchMeetingInfo();
      // FIXED: Check if user is already a participant and redirect accordingly
      checkExistingParticipantStatus();
    }
  }, [meetingId]);

  const checkExistingParticipantStatus = async () => {
    try {
      
      // Get current user info
      const { isAuthenticated, getCurrentUser } = await import('../../lib/simple-auth-handlers');
      if (!isAuthenticated()) {
        return;
      }

      const currentUser = await getCurrentUser();
      if (!currentUser) {
        return;
      }

      // Check if user is already a participant in this meeting
      // Note: This query might not be available, so we'll skip this check for now
      // const participantResult = await makeGraphQLRequest(GET_PARTICIPANT_BY_USER_MEETING, {
      //   meetingId: meetingId as string
      // });

      // Skip participant status check for now since the query is not available
      // This will be handled by the normal join flow
    } catch (error) {
      // Continue with normal flow if check fails
    }
  };

  const normalizeMeetingStatus = useCallback((status?: string | null): MeetingInfo['status'] => {
    if (!status) return 'SCHEDULED';
    if (status === 'CREATED' || status === 'SCHEDULED') return 'SCHEDULED';
    if (status === 'ENDED') return 'ENDED';
    if (status === 'LIVE') return 'LIVE';
    return 'SCHEDULED';
  }, []);

  const handleJoinMeeting = async () => {
    if (!meetingId || !meetingInfo) return;

    const joinStart = getTimestamp();
    setIsJoining(true);
    setJoinError(null);

    try {
      
      // Store audio/video preferences for the LiveKit room
      const audioVideoPreferences = {
        enableMicrophone: isMicOn,
        enableCamera: isVideoOn
      };
      
      // Store in sessionStorage so livestream page can read them
      sessionStorage.setItem('prejoin_audio_enabled', String(isMicOn));
      sessionStorage.setItem('prejoin_video_enabled', String(isVideoOn));
      
      // Store selected device IDs
      if (selectedCamera) {
        sessionStorage.setItem('prejoin_camera_device_id', selectedCamera);
      }
      if (selectedMicrophone) {
        sessionStorage.setItem('prejoin_microphone_device_id', selectedMicrophone);
      }
      if (selectedSpeaker) {
        sessionStorage.setItem('prejoin_speaker_device_id', selectedSpeaker);
      }
      
      // Check user authentication and role
      const { isAuthenticated, getCurrentUser } = await import('../../lib/simple-auth-handlers');
      let userRole = 'MEMBER';
      
      if (isAuthenticated()) {
        const currentUser = await getCurrentUser();
        userRole = currentUser?.systemRole || 'MEMBER';
      }
      
      let backendStatus: MeetingInfo['status'] = meetingInfo.status;
      let inviteCode = meetingInfo.inviteCode;
      const shouldRefreshStatus = userRole === 'TUTOR' || userRole === 'ADMIN';

      const joinPromise = makeGraphQLRequest(JOIN_MEETING, {
        input: {
          meetingId: meetingId as string,
          displayName: 'Participant',
          role: userRole === 'TUTOR' || userRole === 'ADMIN' ? 'HOST' : 'PARTICIPANT'
        } as JoinParticipantInput
      });
      const statusPromise = shouldRefreshStatus
        ? makeGraphQLRequest(GET_MEETING_BY_ID, {
            meetingId: meetingId as string
          }).catch((error) => {
            console.warn('Failed to refresh meeting status before join:', error);
            return null;
          })
        : Promise.resolve(null);

      const [joinResult, refreshedMeeting] = await Promise.all([joinPromise, statusPromise]);
      logPerformance('Join mutation + optional status refresh', getTimestamp() - joinStart);

      if (refreshedMeeting?.getMeetingById) {
        const refreshedStatus = normalizeMeetingStatus(refreshedMeeting.getMeetingById.status);
        backendStatus = refreshedStatus;
        inviteCode = refreshedMeeting.getMeetingById.inviteCode || inviteCode;

        setMeetingInfo((prev) =>
          prev
            ? {
                ...prev,
                status: refreshedStatus,
                inviteCode: inviteCode
              }
            : prev
        );
      }


      if (joinResult.joinMeeting && joinResult.joinMeeting._id) {
        
        // CRITICAL FIX: Check participant status returned from backend
        const participantStatus = joinResult.joinMeeting.status;
        
        if (participantStatus === 'WAITING') {
          // Participant sent to waiting room, redirect to waiting page
          router.push(`/waiting?meetingId=${meetingId}&code=${inviteCode}`);
        } else if (participantStatus === 'ADMITTED') {
          // Participant admitted directly, go to live room
          router.push(`/livestream/${meetingId}`);
        } else if (!participantStatus) {
          // If status is undefined, fallback to backend meeting status logic
          
          // CRITICAL FIX: Only allow non-hosts into live room if meeting is truly LIVE
          if (backendStatus === 'LIVE' && (userRole === 'TUTOR' || userRole === 'ADMIN')) {
            // Only hosts can join LIVE meetings directly
            router.push(`/livestream/${meetingId}`);
          } else if ((userRole === 'TUTOR' || userRole === 'ADMIN') && (backendStatus === 'CREATED' || backendStatus === 'SCHEDULED')) {
            // Host can join even if meeting not started yet
            router.push(`/livestream/${meetingId}`);
          } else {
            // Non-host participants should go to waiting room regardless of meeting status
            
            // Prevent infinite redirect loop using localStorage with timestamp
            const redirectKey = `redirected_${meetingId}_anonymous`;
            const lastRedirectTime = localStorage.getItem(redirectKey);
            const now = Date.now();
            const REDIRECT_COOLDOWN = 30000; // 10 seconds cooldown
            
            
            if (!lastRedirectTime || (now - parseInt(lastRedirectTime)) > REDIRECT_COOLDOWN) {
              localStorage.setItem(redirectKey, now.toString());
              router.push(`/waiting?meetingId=${meetingId}&code=${inviteCode}`);
            } else {
              // Clear the flag since we're going to live room
              localStorage.removeItem(redirectKey);
        router.push(`/livestream/${meetingId}`);
            }
          }
        } else {
          throw new Error('Unknown participant status: ' + participantStatus);
        }
      } else {
        throw new Error('Failed to join meeting');
      }
    } catch (error: any) {
      setJoinError(error.message || 'Failed to join meeting');
    } finally {
      setIsJoining(false);
      logPerformance('Total join flow', getTimestamp() - joinStart);
    }
  };

  const handleCreateAndStartMeeting = async () => {
    setIsJoining(true);
    setJoinError(null);

    try {
      
      // Create meeting
      const createResult = await makeGraphQLRequest(CREATE_MEETING, {
        input: {
          title: 'Live Stream Session',
          notes: 'Professional live streaming session',
          isPrivate: false,
          scheduledFor: new Date().toISOString()
        } as CreateMeetingInput
      });


      if (!createResult.createMeeting || !createResult.createMeeting._id) {
        throw new Error('Failed to create meeting');
      }

      const newMeetingId = createResult.createMeeting._id;

      // Start meeting
      const startResult = await makeGraphQLRequest(START_MEETING, {
        meetingId: newMeetingId
      });


      if (!startResult.startMeeting || !startResult.startMeeting._id) {
        throw new Error('Failed to start meeting');
      }


      // Navigate to live room
      router.push(`/livestream/${newMeetingId}`);
    } catch (error: any) {
      setJoinError(error.message || 'Failed to create meeting');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loaderContainer}>
        <div className={styles.loaderSpinner} />
        <h2 className={styles.meetingTitle}>미팅을 준비하고 있습니다</h2>
        <p className={styles.subtleText}>장치를 초기화하는 동안 잠시만 기다려 주세요.</p>
        <div className={styles.loaderCard}>
          <div className={styles.loaderMeta}>
            <span>Meeting ID: {meetingId}</span>
            <span>상태: 연결 중...</span>
          </div>
          {loadingTimeoutReached && (
            <div className={styles.loaderHint}>
              네트워크 상태를 확인해주세요. 모바일 데이터나 VPN 연결이 느릴 경우 최대 30초까지 소요될 수 있습니다.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!meetingInfo) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h2 className={styles.emptyTitle}>미팅을 찾을 수 없습니다</h2>
          <p className={styles.emptyDescription}>
            ID "{meetingId}"인 미팅이 존재하지 않거나 이미 종료되었을 수 있습니다.
          </p>
          <div className={styles.buttonRow}>
            <button
              onClick={handleCreateAndStartMeeting}
              disabled={isJoining}
              className={styles.actionButton}
            >
              {isJoining ? '새 미팅 생성 중...' : '새 미팅 만들기'}
            </button>
            {joinError && (
              <div className={styles.errorBanner}>{joinError}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const resolvedMeetingId = Array.isArray(meetingId) ? meetingId[0] : meetingId ?? '';

  const cameraOptionsDesktop =
    availableDevices.cameras.length > 0
      ? availableDevices.cameras.map((camera, index) => ({
          deviceId: camera.deviceId,
          label: camera.label || `Camera ${index + 1}`
        }))
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

  const microphoneOptionsDesktop =
    availableDevices.microphones.length > 0
      ? availableDevices.microphones.map((mic, index) => ({
          deviceId: mic.deviceId,
          label: mic.label || `Microphone ${index + 1}`
        }))
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

  const speakerOptionsDesktop =
    availableDevices.speakers.length > 0
      ? availableDevices.speakers.map((speaker, index) => ({
          deviceId: speaker.deviceId,
          label: speaker.label || `Speaker ${index + 1}`
        }))
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

  const cameraValueDesktop = selectedCamera || (cameraOptionsDesktop[0]?.deviceId ?? '');
  const microphoneValueDesktop =
    selectedMicrophone || (microphoneOptionsDesktop[0]?.deviceId ?? '');
  const speakerValueDesktop = selectedSpeaker || (speakerOptionsDesktop[0]?.deviceId ?? '');

  const cameraSelectableDesktop = hasRequestedDevices && availableDevices.cameras.length > 0;
  const microphoneSelectableDesktop = hasRequestedDevices && availableDevices.microphones.length > 0;
  const speakerSelectableDesktop = hasRequestedDevices && availableDevices.speakers.length > 0;

  if (isMobile) {
    return (
      <>
        <PrejoinMobile
          meetingTitle={meetingInfo.title}
          meetingId={resolvedMeetingId}
          inviteCode={meetingInfo.inviteCode}
          isVideoOn={isVideoOn}
          isMicOn={isMicOn}
          isSpeakerOn={isSpeakerOn}
          isTestingDevices={isTestingDevices}
          isJoining={isJoining}
          deviceError={deviceError}
          joinError={joinError}
          localStream={localStream}
          availableDevices={availableDevices}
          selectedCamera={selectedCamera}
          selectedMicrophone={selectedMicrophone}
          selectedSpeaker={selectedSpeaker}
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          onToggleVideo={toggleVideo}
          onToggleMic={toggleMic}
          onRefresh={handleRefresh}
          onJoin={handleJoinMeeting}
          onSelectCamera={handleCameraSelect}
          onSelectMicrophone={handleMicrophoneSelect}
          onSelectSpeaker={handleSpeakerSelect}
          cachedDeviceLabels={cachedDeviceLabels}
          hasRequestedDevices={hasRequestedDevices}
        />
        <audio ref={audioRef} style={{ display: 'none' }} />
      </>
    );
  }

  return (
    <div className={styles.prejoinPage}>
      <div className={styles.backgroundBlur} />
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.meetingTitle}>{meetingInfo.title}</h1>
        </header>

        <div className={styles.layout}>
          <section className={styles.leftColumn}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>카메라 &amp; 오디오 테스트</span>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={handleRefresh}
                aria-label="장치 새로고침 및 테스트"
              >
                <img src="/Icons/waitingRoom/reset.svg" alt="새로고침" />
                새로고침
              </button>
            </div>

            <div className={styles.videoPreview}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={!isVideoOn || !localStream ? styles.videoHidden : ''}
                onCanPlay={() => setDeviceError(null)}
                onPlay={() => setDeviceError(null)}
                onError={() => setDeviceError('Camera preview failed to load')}
              />

              {localStream && isVideoOn && <div className={styles.cameraBadge}>카메라 활성</div>}

              {(!localStream || !isVideoOn) && (
                <div className={styles.videoPlaceholder}>
                  <div className={styles.videoPlaceholderIcon}>
                    <img src="/Icons/waitingRoom/waitingRoomCameraMain.svg" alt="카메라 준비" />
                  </div>
                  <div>
                    {isTestingDevices
                      ? '카메라 테스트 중...'
                      : localStream
                      ? '카메라가 꺼져 있습니다'
                      : '카메라 비활성화됨'}
                  </div>
                  {!isTestingDevices && (
                    <div className={styles.videoPlaceholderHint}>
                      오른쪽에서 장치를 선택하고 확인하기를 눌러 테스트하세요.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.videoControls}>
              <button
                type="button"
                className={`${styles.controlButton} ${isVideoOn ? styles.controlButtonPrimary : ''}`}
                onClick={toggleVideo}
                disabled={!localStream}
                aria-pressed={isVideoOn}
                aria-label={isVideoOn ? '카메라 끄기' : '카메라 켜기'}
              >
                <img
                  src={isVideoOn ? '/Icons/waitingRoom/onCamera.svg' : '/Icons/waitingRoom/offCamera.svg'}
                  alt={isVideoOn ? '카메라 켜짐' : '카메라 꺼짐'}
                />
              </button>
              <button
                type="button"
                className={`${styles.controlButton} ${isMicOn ? styles.controlButtonPrimary : ''}`}
                onClick={toggleMic}
                disabled={!localStream}
                aria-pressed={isMicOn}
                aria-label={isMicOn ? '마이크 끄기' : '마이크 켜기'}
              >
                <img
                  src={isMicOn ? '/Icons/waitingRoom/unmutedMic.png' : '/Icons/waitingRoom/muteMic.png'}
                  alt={isMicOn ? '마이크 켜짐' : '마이크 꺼짐'}
                />
              </button>
              <button
                type="button"
                className={styles.controlButton}
                onClick={handleRefresh}
                disabled={isTestingDevices}
                aria-label="장치 새로고침 및 테스트"
              >
                <img src="/Icons/waitingRoom/reset.svg" alt="장치 테스트" />
              </button>
            </div>

            {deviceError && <div className={styles.deviceError}>{deviceError}</div>}
          </section>

          <section className={styles.rightColumn}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>장치 선택 </span>
            </div>

            <div className={styles.deviceSelectGroup}>
              <label className={styles.deviceField}>
                <span className={styles.deviceLabel}>카메라</span>
                <select
                  value={cameraValueDesktop}
                  onChange={(e) => handleCameraSelect(e.target.value)}
                  className={styles.deviceSelect}
                  disabled={!cameraSelectableDesktop}
                >
                  {cameraOptionsDesktop.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.deviceField}>
                <span className={styles.deviceLabel}>마이크</span>
                <select
                  value={microphoneValueDesktop}
                  onChange={(e) => handleMicrophoneSelect(e.target.value)}
                  className={styles.deviceSelect}
                  disabled={!microphoneSelectableDesktop}
                >
                  {microphoneOptionsDesktop.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.deviceField}>
                <span className={styles.deviceLabel}>스피커</span>
                <select
                  value={speakerValueDesktop}
                  onChange={(e) => handleSpeakerSelect(e.target.value)}
                  className={styles.deviceSelect}
                  disabled={!speakerSelectableDesktop}
                >
                  {speakerOptionsDesktop.map((speaker) => (
                    <option key={speaker.deviceId} value={speaker.deviceId}>
                      {speaker.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              className={styles.confirmButton}
              onClick={handleRefresh}
              disabled={isTestingDevices}
            >
              확인하기
            </button>

            {!hasRequestedDevices && (
              <p className={styles.subtleText}>
                확인하기를 눌러 장치를 탐색한 뒤 선택할 수 있습니다.
              </p>
            )}

            <div className={styles.statusPanel}>
              <div className={styles.statusPanelTitle}>상태 확인</div>
              <div className={styles.statusList}>
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>카메라</span>
                  <span
                    className={`${styles.statusValue} ${
                      isVideoOn ? styles.statusValueSuccess : styles.statusValueError
                    }`}
                  >
                    {isVideoOn ? '연결 성공' : '테스트 필요'}
                  </span>
                </div>
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>마이크</span>
                  <span
                    className={`${styles.statusValue} ${
                      isMicOn ? styles.statusValueSuccess : styles.statusValueError
                    }`}
                  >
                    {isMicOn ? '연결 성공' : '테스트 필요'}
                  </span>
                </div>
                <div className={styles.statusItem}>
                  <span className={styles.statusLabel}>스피커</span>
                  <span
                    className={`${styles.statusValue} ${
                      isSpeakerOn ? styles.statusValueSuccess : styles.statusValueError
                    }`}
                  >
                    {isSpeakerOn ? '연결 성공' : '테스트 필요'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleJoinMeeting}
              disabled={isJoining}
              className={styles.actionButton}
            >
              {isJoining ? '참여 중...' : '참여하기'}
            </button>

            {joinError && <div className={styles.errorBanner}>{joinError}</div>}
          </section>
        </div>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
};

export default PrejoinPage;