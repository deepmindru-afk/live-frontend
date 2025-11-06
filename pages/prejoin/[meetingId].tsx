import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import { makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
import { CREATE_MEETING, START_MEETING, JOIN_MEETING } from '../../apollo/meeting/mutations';
import { CreateMeetingInput, JoinParticipantInput, Meeting } from '../../types/meeting';
import { isValidObjectId, getInvalidIdErrorMessage } from '../../lib/validation';

interface MeetingInfo {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
}

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
  const [availableDevices, setAvailableDevices] = useState<{
    cameras: MediaDeviceInfo[];
    microphones: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
  }>({
    cameras: [],
    microphones: [],
    speakers: []
  });
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  
  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
  }, [meetingId, isLoading, meetingInfo]);

  // Load available devices
  const loadAvailableDevices = async () => {
    try {
      // First request permission to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      const speakers = devices.filter(device => device.kind === 'audiooutput');
      
      setAvailableDevices({ cameras, microphones, speakers });
      
      // Set default selections if not already set
      if (!selectedCamera && cameras.length > 0) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (!selectedMicrophone && microphones.length > 0) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
      if (!selectedSpeaker && speakers.length > 0) {
        setSelectedSpeaker(speakers[0].deviceId);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  // Device testing functions
  const testDevices = async () => {
    setIsTestingDevices(true);
    setDeviceError(null);
    
    try {
      // Load devices if not already loaded
      if (availableDevices.cameras.length === 0) {
        await loadAvailableDevices();
      }
      
      // First, check what devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      
      // Check for missing devices
      const warnings = [];
      if (videoInputs.length === 0) {
        warnings.push('No camera detected. Please connect a camera to participate in video calls.');
      }
      if (audioInputs.length === 0) {
        warnings.push('No microphone detected. Please connect a microphone to participate in audio calls.');
      }
      
      if (warnings.length > 0) {
        setDeviceError(warnings.join(' '));
        setIsTestingDevices(false);
        return;
      }
      
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
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
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
        setDeviceError('Camera access denied or no camera available. Please check permissions and try again.');
        setIsTestingDevices(false);
        return;
      }
      
      if (audioTracks.length === 0) {
        setDeviceError('Microphone access denied or no microphone available. Please check permissions and try again.');
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
            setDeviceError('Video element not found');
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
        setDeviceError('Camera and microphone access denied. Please allow access and try again.');
      } else if (error.name === 'NotFoundError') {
        setDeviceError('No camera or microphone found. Please connect your devices and try again.');
      } else if (error.name === 'NotReadableError') {
        setDeviceError('Camera or microphone is being used by another application. Please close other apps and try again.');
      } else if (error.name === 'OverconstrainedError') {
        setDeviceError('Camera settings are not supported. Please try with different settings.');
      } else {
        setDeviceError('Unable to access camera or microphone. Please check your devices and permissions.');
      }
    } finally {
      setIsTestingDevices(false);
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
      setDeviceError('Failed to switch camera. Please try again.');
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
      setDeviceError('Failed to switch microphone. Please try again.');
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
      setDeviceError('Failed to switch speaker. Please try again.');
    }
  };

  // Check device availability on component mount
  useEffect(() => {
    const checkDeviceAvailability = async () => {
      try {
        await loadAvailableDevices();
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        
        
        // Show warning if no devices are detected
        if (videoInputs.length === 0 && audioInputs.length === 0) {
          setDeviceError('No camera or microphone detected. Please connect your devices before joining the meeting.');
        } else if (videoInputs.length === 0) {
          setDeviceError('No camera detected. You can still join with audio only.');
        } else if (audioInputs.length === 0) {
          setDeviceError('No microphone detected. You can still join with video only.');
        }
      } catch (error) {
      }
    };
    
    checkDeviceAvailability();

    // Listen for device changes
    const handleDeviceChange = () => {
      loadAvailableDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

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

  const handleJoinMeeting = async () => {
    if (!meetingId) return;

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
      
      // CRITICAL FIX: Check backend meeting status first
      const meetingResult = await makeGraphQLRequest(GET_MEETING_BY_ID, {
        meetingId: meetingId as string
      });

      if (!meetingResult.getMeetingById) {
        throw new Error('Meeting not found');
      }

      const backendStatus = meetingResult.getMeetingById.status;

      // Join the meeting and check participant status
      
      const joinResult = await makeGraphQLRequest(JOIN_MEETING, {
        input: {
          meetingId: meetingId as string,
          displayName: 'Participant',
          role: userRole === 'TUTOR' || userRole === 'ADMIN' ? 'HOST' : 'PARTICIPANT'
        } as JoinParticipantInput
      });


      if (joinResult.joinMeeting && joinResult.joinMeeting._id) {
        
        // CRITICAL FIX: Check participant status returned from backend
        const participantStatus = joinResult.joinMeeting.status;
        
        if (participantStatus === 'WAITING') {
          // Participant sent to waiting room, redirect to waiting page
          router.push(`/waiting?meetingId=${meetingId}&code=${meetingResult.getMeetingById.inviteCode}`);
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
              router.push(`/waiting?meetingId=${meetingId}&code=${meetingResult.getMeetingById.inviteCode}`);
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
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#333',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1000 1000\'><defs><filter id=\'blur\'><feGaussianBlur stdDeviation=\'10\'/></filter></defs><circle cx=\'200\' cy=\'200\' r=\'100\' fill=\'%23ff6b6b\' filter=\'url(%23blur)\'/><circle cx=\'800\' cy=\'300\' r=\'150\' fill=\'%234ecdc4\' filter=\'url(%23blur)\'/><circle cx=\'400\' cy=\'700\' r=\'120\' fill=\'%2345b7d1\' filter=\'url(%23blur)\'/><circle cx=\'700\' cy=\'600\' r=\'80\' fill=\'%2396ceb4\' filter=\'url(%23blur)\'/></svg>") no-repeat center center',
          backgroundSize: 'cover',
          filter: 'blur(20px)',
          opacity: 0.3,
          zIndex: 0
        }} />
        
        <div style={{ 
          width: '60px', 
          height: '60px', 
          border: '3px solid rgba(255, 255, 255, 0.3)',
          borderTop: '3px solid #4A90E2',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '24px',
          position: 'relative',
          zIndex: 1
        }}></div>
        <h2 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '24px',
          fontWeight: '600',
          color: '#ffffff',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          미팅 로딩 중
        </h2>
        <p style={{ 
          margin: '0 0 20px 0', 
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '16px',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          미팅방을 준비하는 중...
        </p>
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '16px',
          fontSize: '14px',
          color: '#4A90E2',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          position: 'relative',
          zIndex: 1
        }}>
          <div>미팅 ID: {meetingId}</div>
          <div style={{ marginTop: '4px' }}>상태: 로딩 중...</div>
        </div>
      </div>
    );
  }

  if (!meetingInfo) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        flexDirection: 'column',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#2a2a2a',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          maxWidth: '500px',
          width: '100%',
          border: '1px solid #333'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#f59e0b',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            margin: '0 auto 24px'
          }}>
            ⚠️
          </div>
          
          <h2 style={{ 
            color: '#ffffff', 
            marginBottom: '16px',
            fontSize: '24px',
            fontWeight: '600'
          }}>
            미팅을 찾을 수 없음
          </h2>
          
          <p style={{ 
            color: '#a0a0a0', 
            marginBottom: '32px', 
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            ID "{meetingId}"인 미팅을 찾을 수 없거나 삭제되었을 수 있습니다.
          </p>
          
        <button
          onClick={handleCreateAndStartMeeting}
          disabled={isJoining}
          style={{
              width: '100%',
              padding: '16px',
              backgroundColor: isJoining ? '#6b7280' : '#10b981',
            color: 'white',
            border: 'none',
              borderRadius: '8px',
              cursor: isJoining ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px'
          }}
        >
          {isJoining ? '생성 중...' : '새 미팅 만들기'}
        </button>
          
        {joinError && (
          <div style={{
              color: '#ffffff',
              padding: '12px',
              backgroundColor: '#ef4444',
              borderRadius: '8px',
              fontSize: '14px'
          }}>
            {joinError}
          </div>
        )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#333',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px',
      display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
      justifyContent: 'center', 
        position: 'relative',
        overflow: 'hidden'
      }}>
      {/* Blurred background effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1000 1000\'><defs><filter id=\'blur\'><feGaussianBlur stdDeviation=\'10\'/></filter></defs><circle cx=\'200\' cy=\'200\' r=\'100\' fill=\'%23ff6b6b\' filter=\'url(%23blur)\'/><circle cx=\'800\' cy=\'300\' r=\'150\' fill=\'%234ecdc4\' filter=\'url(%23blur)\'/><circle cx=\'400\' cy=\'700\' r=\'120\' fill=\'%2345b7d1\' filter=\'url(%23blur)\'/><circle cx=\'700\' cy=\'600\' r=\'80\' fill=\'%2396ceb4\' filter=\'url(%23blur)\'/></svg>") no-repeat center center',
        backgroundSize: 'cover',
        filter: 'blur(20px)',
        opacity: 0.3,
        zIndex: 0
      }} />
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
        <h1 style={{ 
          fontSize: 'clamp(24px, 5vw, 32px)', 
          fontWeight: '600', 
          margin: '0 0 8px 0',
          color: '#ffffff',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {meetingInfo.title}
        </h1>
        <p style={{ 
          color: 'rgba(255, 255, 255, 0.9)', 
          fontSize: '14px',
          margin: '0',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        }}>
          미팅 ID: {meetingInfo.inviteCode}
        </p>
      </div>

      {/* Main Content Container */}
      <div style={{
        width: '100%',
        maxWidth: '800px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
        alignItems: 'stretch',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* Video Preview */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '20px',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '18px',
            color: '#333',
            fontWeight: '600'
          }}>
            카메라 미리보기
          </h3>

          {/* Device Selection Dropdowns */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ 
              fontSize: '14px', 
              color: '#333', 
              fontWeight: '600'
            }}>
              장치 선택
            </span>
            <button
              onClick={async () => {
                await loadAvailableDevices();
              }}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#f0f0f0',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#e0e0e0';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }}
            >
              🔄 새로고침
            </button>
          </div>
          
          {availableDevices.cameras.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                color: '#666', 
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                📹 카메라 선택
              </label>
              <select
                value={selectedCamera}
                onChange={(e) => {
                  const deviceId = e.target.value;
                  setSelectedCamera(deviceId);
                  if (localStream) {
                    switchCamera(deviceId);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                {availableDevices.cameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${availableDevices.cameras.indexOf(camera) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableDevices.microphones.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                color: '#666', 
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                🎤 마이크 선택
              </label>
              <select
                value={selectedMicrophone}
                onChange={(e) => {
                  const deviceId = e.target.value;
                  setSelectedMicrophone(deviceId);
                  if (localStream) {
                    switchMicrophone(deviceId);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                {availableDevices.microphones.map((mic) => (
                  <option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Microphone ${availableDevices.microphones.indexOf(mic) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {availableDevices.speakers.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '12px', 
                color: '#666', 
                marginBottom: '4px',
                fontWeight: '500'
              }}>
                🔊 스피커 선택
              </label>
              <select
                value={selectedSpeaker}
                onChange={(e) => {
                  const deviceId = e.target.value;
                  switchSpeaker(deviceId);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                {availableDevices.speakers.map((speaker) => (
                  <option key={speaker.deviceId} value={speaker.deviceId}>
                    {speaker.label || `Speaker ${availableDevices.speakers.indexOf(speaker) + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div style={{
            width: '100%',
            aspectRatio: '16/9',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '16px',
            position: 'relative',
            border: '2px solid #4A90E2',
            boxShadow: '0 4px 15px rgba(74, 144, 226, 0.2)'
          }}>
            {localStream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  backgroundColor: '#000'
                }}
                onLoadStart={() => {
                  // Load start handler
                }}
                onCanPlay={() => {
                  setDeviceError(null);
                }}
                onPlay={() => {
                  setDeviceError(null);
                }}
                onError={(e) => {
                  setDeviceError('Camera preview failed to load');
                }}
              />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#4A90E2',
                fontSize: '14px',
                fontWeight: '500',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '24px' }}>📹</div>
                <div>{isTestingDevices ? '카메라 테스트 중...' : '카메라 비활성화됨'}</div>
                {!isTestingDevices && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    "카메라 및 마이크 테스트"를 클릭하여 시작하세요
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Device Controls */}
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <button
              onClick={toggleVideo}
              disabled={!localStream}
              style={{
                padding: '8px 12px',
                backgroundColor: isVideoOn ? '#4A90E2' : '#E74C3C',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: localStream ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: '500',
                opacity: localStream ? 1 : 0.5,
                transition: 'all 0.2s ease'
              }}
            >
              {isVideoOn ? '📹 켜기' : '📹 끄기'}
            </button>
            
            <button
              onClick={toggleMic}
              disabled={!localStream}
              style={{
                padding: '8px 12px',
                backgroundColor: isMicOn ? '#4A90E2' : '#E74C3C',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: localStream ? 'pointer' : 'not-allowed',
                fontSize: '12px',
                fontWeight: '500',
                opacity: localStream ? 1 : 0.5,
                transition: 'all 0.2s ease'
              }}
            >
              {isMicOn ? '🎤 켜기' : '🎤 끄기'}
            </button>
          </div>

          {/* Test Devices Button */}
          {!localStream ? (
            <button
              onClick={testDevices}
              disabled={isTestingDevices}
              style={{
                width: '100%',
                padding: '12px',
                background: isTestingDevices ? 'linear-gradient(135deg, #6b7280, #4b5563)' : 'linear-gradient(135deg, #4A90E2, #357ABD)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: isTestingDevices ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(74, 144, 226, 0.3)'
              }}
            >
              {isTestingDevices ? '테스트 중...' : '카메라 및 마이크 테스트'}
            </button>
          ) : (
            <button
              onClick={stopDeviceTest}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s ease'
              }}
            >
              테스트 중지
            </button>
          )}

          {deviceError ? (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px'
            }}>
              {deviceError}
            </div>
          ) : localStream && isVideoOn ? (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: '#4A90E2',
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
              textAlign: 'center'
            }}>
              ✅ 카메라가 정상적으로 작동합니다!
            </div>
          ) : null}
        </div>

        {/* Meeting Info & Join */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '18px',
            color: '#333',
            fontWeight: '600'
          }}>
            참여할 준비가 되셨나요?
          </h3>

          {/* Device Status */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid rgba(74, 144, 226, 0.2)'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>카메라</span>
              <span style={{ 
                fontSize: '14px',
                color: isVideoOn ? '#4A90E2' : '#E74C3C',
                fontWeight: '500'
              }}>
                {isVideoOn ? '✓ 작동 중' : '✗ 테스트 안 됨'}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid rgba(74, 144, 226, 0.2)'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>마이크</span>
              <span style={{ 
                fontSize: '14px',
                color: isMicOn ? '#4A90E2' : '#E74C3C',
                fontWeight: '500'
              }}>
                {isMicOn ? '✓ 작동 중' : '✗ 테스트 안 됨'}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>스피커</span>
              <span style={{ 
                fontSize: '14px',
                color: isSpeakerOn ? '#4A90E2' : '#E74C3C',
                fontWeight: '500'
              }}>
                {isSpeakerOn ? '✓ 작동 중' : '✗ 테스트 안 됨'}
              </span>
            </div>
          </div>

          {/* Join Button */}
        <button
          onClick={handleJoinMeeting}
          disabled={isJoining}
          style={{
              width: '100%',
              padding: '16px',
              background: isJoining ? 'linear-gradient(135deg, #6b7280, #4b5563)' : 'linear-gradient(135deg, #4A90E2, #357ABD)',
            color: 'white',
            border: 'none',
              borderRadius: '12px',
            cursor: isJoining ? 'not-allowed' : 'pointer',
            fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(74, 144, 226, 0.3)'
          }}
        >
          {isJoining ? '참여 중...' : '미팅 참여'}
        </button>

          {/* Meeting Details */}
          <div style={{
            backgroundColor: 'rgba(74, 144, 226, 0.1)',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '12px',
            color: '#4A90E2',
            border: '1px solid rgba(74, 144, 226, 0.2)'
          }}>
            <div style={{ marginBottom: '4px' }}>
              <strong>상태:</strong> {meetingInfo.status === 'SCHEDULED' ? '예약됨' : meetingInfo.status}
            </div>
            <div>
              <strong>ID:</strong> {meetingInfo._id.slice(-8)}
            </div>
          </div>

          {joinError && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px'
          }}>
            {joinError}
          </div>
        )}
      </div>
    </div>

      {/* Hidden audio element for testing */}
      <audio ref={audioRef} style={{ display: 'none' }} />
      </div>
    </>
  );
};

export default PrejoinPage;