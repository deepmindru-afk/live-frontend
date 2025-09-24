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
  
  // Device testing states
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isTestingDevices, setIsTestingDevices] = useState(false);
  
  // Media refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('🔍 PREJOIN DEBUG:', {
      meetingId,
      isLoading,
      meetingInfo
    });
  }, [meetingId, isLoading, meetingInfo]);

  // Device testing functions
  const testDevices = async () => {
    setIsTestingDevices(true);
    setDeviceError(null);
    
    try {
      console.log('🎥 Starting device test...');
      
      // First, check what devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      
      console.log('🔍 Available devices:', { audioInputs: audioInputs.length, videoInputs: videoInputs.length });
      
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
      
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });
      
      console.log('🎥 Stream obtained:', stream);
      setLocalStream(stream);
      
      // Check if we actually got video and audio tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log('🎥 Stream tracks:', { video: videoTracks.length, audio: audioTracks.length });
      
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
        console.log('🎥 Setting up video element...');
        videoRef.current.srcObject = stream;
        
        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          console.log('✅ Video metadata loaded successfully');
          videoRef.current?.play().then(() => {
            console.log('✅ Video started playing');
            setIsVideoOn(true);
            setDeviceError(null); // Clear any previous errors
          }).catch((playError) => {
            console.error('❌ Video play error:', playError);
            setDeviceError('Camera preview failed to play');
          });
        };
        
        videoRef.current.onerror = (error) => {
          console.error('❌ Video error:', error);
          setDeviceError('Camera preview failed to load');
        };
        
        videoRef.current.oncanplay = () => {
          console.log('✅ Video can play');
          setDeviceError(null); // Clear any previous errors
        };
      } else {
        console.error('❌ Video ref not available');
        // Don't set error immediately, wait a bit for the ref to be available
        setTimeout(() => {
          if (!videoRef.current) {
            setDeviceError('Video element not found');
          }
        }, 100);
      }
      
      // Set up audio
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        setIsMicOn(true);
        console.log('🎤 Audio setup complete');
      }
      
      // Test speaker with a simple beep
      testSpeaker();
      
    } catch (error: any) {
      console.error('❌ Device access error:', error);
      
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
      console.log('🔊 Speaker test completed successfully');
    } catch (error) {
      console.error('❌ Speaker test error:', error);
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
      console.log('🎥 Re-attaching stream to video element');
      videoRef.current.srcObject = localStream;
      videoRef.current.play().then(() => {
        console.log('✅ Video re-attached and playing');
        setIsVideoOn(true);
        setDeviceError(null);
      }).catch((error) => {
        console.error('❌ Video re-attach error:', error);
        setDeviceError('Camera preview failed to play');
      });
    }
  }, [localStream]);

  // Check device availability on component mount
  useEffect(() => {
    const checkDeviceAvailability = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        
        console.log('🔍 Device availability check:', { 
          audioInputs: audioInputs.length, 
          videoInputs: videoInputs.length 
        });
        
        // Show warning if no devices are detected
        if (videoInputs.length === 0 && audioInputs.length === 0) {
          setDeviceError('No camera or microphone detected. Please connect your devices before joining the meeting.');
        } else if (videoInputs.length === 0) {
          setDeviceError('No camera detected. You can still join with audio only.');
        } else if (audioInputs.length === 0) {
          setDeviceError('No microphone detected. You can still join with video only.');
        }
      } catch (error) {
        console.error('❌ Device enumeration error:', error);
      }
    };
    
    checkDeviceAvailability();
  }, []);

  const fetchMeetingInfo = async () => {
    try {
      console.log('🔍 PREJOIN: Fetching meeting info for ID:', meetingId);
      
      // Check if meetingId is a valid MongoDB ObjectId
      if (!isValidObjectId(meetingId as string)) {
        console.log('🔍 PREJOIN: Invalid meeting ID format, redirecting to instructor dashboard');
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
      
      console.log('🔍 PREJOIN: Raw backend response:', result);
      
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
        
        console.log('🔍 PREJOIN: Processed meeting data:', meeting);
        setMeetingInfo(meeting);
      } else {
        throw new Error('Meeting not found');
      }
    } catch (error: any) {
      console.error('🔍 PREJOIN: Error fetching meeting info:', error);
      
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
    }
  }, [meetingId]);

  const handleJoinMeeting = async () => {
    if (!meetingId) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      console.log('🔍 PREJOIN: Joining meeting with ID:', meetingId);
      
      // Join the meeting
      const joinResult = await makeGraphQLRequest(JOIN_MEETING, {
        input: {
          meetingId: meetingId as string,
          displayName: 'Participant'
          // Don't send role - let backend determine it
        } as JoinParticipantInput
      });

      console.log('🔍 PREJOIN: Join meeting result:', joinResult);

      if (joinResult.joinMeeting && joinResult.joinMeeting._id) {
        console.log('✅ Successfully joined meeting:', joinResult.joinMeeting);
        // Navigate to live room
        router.push(`/livestream/${meetingId}`);
      } else {
        throw new Error('Failed to join meeting');
      }
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      setJoinError(error.message || 'Failed to join meeting');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateAndStartMeeting = async () => {
    setIsJoining(true);
    setJoinError(null);

    try {
      console.log('🔍 PREJOIN: Creating new meeting');
      
      // Create meeting
      const createResult = await makeGraphQLRequest(CREATE_MEETING, {
        input: {
          title: 'Live Stream Session',
          notes: 'Professional live streaming session',
          isPrivate: false,
          scheduledFor: new Date().toISOString()
        } as CreateMeetingInput
      });

      console.log('🔍 PREJOIN: Create meeting result:', createResult);

      if (!createResult.createMeeting || !createResult.createMeeting._id) {
        throw new Error('Failed to create meeting');
      }

      const newMeetingId = createResult.createMeeting._id;
      console.log('✅ Meeting created:', newMeetingId);

      // Start meeting
      const startResult = await makeGraphQLRequest(START_MEETING, {
        meetingId: newMeetingId
      });

      console.log('🔍 PREJOIN: Start meeting result:', startResult);

      if (!startResult.startMeeting || !startResult.startMeeting._id) {
        throw new Error('Failed to start meeting');
      }

      console.log('✅ Meeting started');

      // Navigate to live room
      router.push(`/livestream/${newMeetingId}`);
    } catch (error: any) {
      console.error('❌ Failed to create/start meeting:', error);
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
          Loading Meeting
        </h2>
        <p style={{ 
          margin: '0 0 20px 0', 
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '16px',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          Preparing your meeting room...
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
          <div>Meeting ID: {meetingId}</div>
          <div style={{ marginTop: '4px' }}>Status: Loading...</div>
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
            Meeting Not Found
          </h2>
          
          <p style={{ 
            color: '#a0a0a0', 
            marginBottom: '32px', 
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            The meeting with ID "{meetingId}" could not be found or may have been deleted.
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
            {isJoining ? 'Creating...' : 'Create New Meeting'}
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
          Meeting ID: {meetingInfo.inviteCode}
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
            Camera Preview
          </h3>
          
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
                onLoadStart={() => console.log('🎥 Video load started')}
                onLoadedData={() => {
                  console.log('🎥 Video data loaded');
                  setDeviceError(null);
                }}
                onCanPlay={() => {
                  console.log('🎥 Video can play');
                  setDeviceError(null);
                }}
                onPlay={() => {
                  console.log('🎥 Video playing');
                  setDeviceError(null);
                }}
                onError={(e) => {
                  console.error('🎥 Video error:', e);
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
                <div>{isTestingDevices ? 'Testing camera...' : 'Camera not active'}</div>
                {!isTestingDevices && (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Click "Test Camera & Mic" to start
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
              {isVideoOn ? '📹 On' : '📹 Off'}
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
              {isMicOn ? '🎤 On' : '🎤 Off'}
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
              {isTestingDevices ? 'Testing...' : 'Test Camera & Mic'}
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
              Stop Test
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
              ✅ Camera working perfectly!
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
            Ready to Join?
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
              <span style={{ fontSize: '14px', color: '#666' }}>Camera</span>
              <span style={{ 
                fontSize: '14px',
                color: isVideoOn ? '#4A90E2' : '#E74C3C',
                fontWeight: '500'
              }}>
                {isVideoOn ? '✓ Working' : '✗ Not tested'}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid rgba(74, 144, 226, 0.2)'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Microphone</span>
              <span style={{ 
                fontSize: '14px',
                color: isMicOn ? '#4A90E2' : '#E74C3C',
                fontWeight: '500'
              }}>
                {isMicOn ? '✓ Working' : '✗ Not tested'}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0'
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Speaker</span>
              <span style={{ 
                fontSize: '14px',
                color: isSpeakerOn ? '#4A90E2' : '#E74C3C',
                fontWeight: '500'
              }}>
                {isSpeakerOn ? '✓ Working' : '✗ Not tested'}
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
            {isJoining ? 'Joining...' : 'Join Meeting'}
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
              <strong>Status:</strong> {meetingInfo.status}
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
      
      {/* Debug Panel */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '12px',
          zIndex: 1000,
          maxWidth: '300px'
        }}>
          <div><strong>Debug Info:</strong></div>
          <div>Local Stream: {localStream ? 'Yes' : 'No'}</div>
          <div>Video On: {isVideoOn ? 'Yes' : 'No'}</div>
          <div>Mic On: {isMicOn ? 'Yes' : 'No'}</div>
          <div>Speaker On: {isSpeakerOn ? 'Yes' : 'No'}</div>
          <div>Testing: {isTestingDevices ? 'Yes' : 'No'}</div>
          <div>Video Ref: {videoRef.current ? 'Yes' : 'No'}</div>
          {localStream && (
            <>
              <div>Video Tracks: {localStream.getVideoTracks().length}</div>
              <div>Audio Tracks: {localStream.getAudioTracks().length}</div>
            </>
          )}
          {deviceError && <div style={{ color: '#ff6b6b' }}>Error: {deviceError}</div>}
        </div>
      )}
      </div>
    </>
  );
};

export default PrejoinPage;