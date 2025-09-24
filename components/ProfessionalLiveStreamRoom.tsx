import React, { useState, useEffect, useRef } from 'react';
import { useLiveRoomData } from '../hooks/useLiveRoomData';

interface ProfessionalLiveStreamRoomProps {
  meetingId?: string;
  role?: 'HOST' | 'PARTICIPANT';
  userId?: string;
}

interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
}

interface ChatMessage {
  id: number;
  text: string;
  sender: string;
  timestamp: string;
}

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = ({
  meetingId,
  role,
  userId
}) => {
  // Debug logging for props
  console.log('🔍 PROFESSIONAL LIVE STREAM ROOM: Props received:', { meetingId, role, userId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  
  // Authentication state
  const [isAuth, setIsAuth] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('MEMBER');
  const [actualUserId, setActualUserId] = useState<string>('');
  const [actualUserEmail, setActualUserEmail] = useState<string>('');
  const [actualMeetingId, setActualMeetingId] = useState<string>('');
  const [isJoiningMeeting, setIsJoiningMeeting] = useState(false);
  const [hasJoinedMeeting, setHasJoinedMeeting] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [meetingStatus, setMeetingStatus] = useState<string>('CREATED');

  // Use the live room data hook for real-time updates
  const liveRoomData = useLiveRoomData(actualMeetingId || '');
  
  // Video refs and streams
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Authentication effect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔐 AUTH CHECK: Starting authentication check');
        setIsAuth(false);
        setAuthComplete(false);
        
        // Get actual user from localStorage
        const userStr = localStorage.getItem('user');
        const tokenStr = localStorage.getItem('token') || localStorage.getItem('jwt');
        const user = userStr ? JSON.parse(userStr) : null;

        console.log('🔐 AUTH CHECK: Local storage data:', {
          hasUser: !!user,
          hasToken: !!tokenStr,
          userRole: user?.systemRole,
          userEmail: user?.email
        });

        if (user && tokenStr) {
          setIsAuth(true);
          setAuthComplete(true);
          setCurrentUserRole(user.systemRole || 'MEMBER'); // Use actual role
          setActualUserId(user._id || 'user123');
          setActualUserEmail(user.email || 'user@example.com');
          console.log('🔐 AUTH CHECK: User authenticated with role:', user.systemRole);
        } else {
          // Fallback: set as member for testing
          setIsAuth(true);
            setAuthComplete(true);
          setCurrentUserRole('MEMBER');
          setActualUserId('user123');
          setActualUserEmail('user@example.com');
          console.log('🔐 AUTH CHECK: No user found, using default member role');
        }
        
        // Set meeting ID from prop or URL
        if (meetingId) {
          console.log('🔍 SETTING MEETING ID FROM PROP:', meetingId);
          setActualMeetingId(meetingId);
        } else {
          // Extract from URL if not provided as prop
          const pathParts = window.location.pathname.split('/');
          const meetingIdFromUrl = pathParts[pathParts.length - 1];
          console.log('🔍 EXTRACTING FROM URL:', { pathParts, meetingIdFromUrl });
          if (meetingIdFromUrl && meetingIdFromUrl !== 'livestream') {
            console.log('🔍 SETTING MEETING ID FROM URL:', meetingIdFromUrl);
            setActualMeetingId(meetingIdFromUrl);
          } else {
            console.log('🔍 NO VALID MEETING ID FOUND');
          }
        }
        
        console.log('🔐 AUTH CHECK: Authentication successful');
      } catch (error: any) {
        console.error('🔐 AUTH CHECK: Auth failed:', error);
        setError(`Authentication failed: ${error.message}`);
      } finally {
        setAuthComplete(true);
      }
    };
    
    checkAuth();
  }, [meetingId]);

  useEffect(() => {
    console.log('🔍 LOADING CHECK:', { actualMeetingId, authComplete, loading });
    
    if (actualMeetingId && authComplete) {
      console.log('🔍 STARTING MEETING LOAD...');
      // Simulate loading meeting data
      setTimeout(() => {
        setMeeting({
          _id: actualMeetingId,
          title: `Meeting ${actualMeetingId}`,
          status: 'ACTIVE',
          inviteCode: 'ABC123'
        });
        setLoading(false);
        console.log('🔍 LOADING COMPLETE!');
      }, 1000);
      
      // Initialize video stream only on client side
      if (typeof window !== 'undefined') {
        initializeVideo();
      }
    } else {
      console.log('🔍 WAITING FOR:', { actualMeetingId: !!actualMeetingId, authComplete });
      
      // If we have meetingId but auth is not complete, force auth complete after 2 seconds
      if (actualMeetingId && !authComplete) {
        console.log('🔍 FORCING AUTH COMPLETE...');
        setTimeout(() => {
          setAuthComplete(true);
          setIsAuth(true);
          setCurrentUserRole('MEMBER');
          setActualUserId('user123');
          setActualUserEmail('user@example.com');
          console.log('🔍 AUTH FORCED TO COMPLETE');
        }, 2000);
      }
    }
    
    // Force loading to complete after 10 seconds
    const timeout = setTimeout(() => {
      console.log('🔍 FORCE LOADING COMPLETE - TIMEOUT REACHED');
      setLoading(false);
      if (!meeting) {
        setMeeting({
          _id: actualMeetingId || 'timeout',
          title: `Meeting ${actualMeetingId || 'timeout'}`,
          status: 'ACTIVE',
          inviteCode: 'ABC123'
        });
      }
    }, 10000);
    
    // Cleanup function to stop streams when component unmounts
    return () => {
      clearTimeout(timeout);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [actualMeetingId, authComplete]);

  // Update local state with real-time data
  useEffect(() => {
    if (liveRoomData) {
      console.log('🔄 UPDATING WITH LIVE DATA:', liveRoomData);
      
      // Update participants
      if (liveRoomData.participants && Array.isArray(liveRoomData.participants)) {
        setParticipants(liveRoomData.participants);
        console.log('👥 PARTICIPANTS UPDATED:', liveRoomData.participants);
      }
      
      // Update chat messages
      if (liveRoomData.chatMessages && Array.isArray(liveRoomData.chatMessages)) {
        setChatMessages(liveRoomData.chatMessages);
        console.log('💬 CHAT MESSAGES UPDATED:', liveRoomData.chatMessages);
      }
      
      // Update meeting data
      if (liveRoomData.meeting) {
        setMeeting(liveRoomData.meeting);
        console.log('📋 MEETING UPDATED:', liveRoomData.meeting);
      }
    }
  }, [liveRoomData]);

  // Add debug logging for meeting data
  useEffect(() => {
    console.log('🔍 MEETING DEBUG:', {
      meetingData: liveRoomData?.meeting,
      meeting,
      meetingLoading: liveRoomData?.loading,
      meetingError: liveRoomData?.error?.message,
      actualMeetingId
    });
  }, [liveRoomData?.meeting, meeting, liveRoomData?.loading, liveRoomData?.error, actualMeetingId]);

  // Add debug logging for participant data
  useEffect(() => {
    console.log('🔍 PARTICIPANT DEBUG:', {
      participantsData: liveRoomData?.participants,
      participants,
      participantsLoading: liveRoomData?.loading,
      participantsError: liveRoomData?.error?.message,
      actualMeetingId
    });
  }, [liveRoomData?.participants, participants, liveRoomData?.loading, liveRoomData?.error, actualMeetingId]);

  // Meeting entry logic - Host starts meeting, Members join
  useEffect(() => {
    const handleMeetingEntry = async () => {
      console.log('🚀 MEETING ENTRY: Starting handleMeetingEntry', {
        authComplete,
        isAuth,
        actualMeetingId,
        loading,
        currentUserRole
      });

      if (!authComplete || !isAuth || !actualMeetingId || loading) {
        console.log('🚀 MEETING ENTRY: Conditions not met, skipping', {
          authComplete,
          isAuth,
          actualMeetingId: !!actualMeetingId,
          loading
        });
        return;
      }

      try {
        const isTutor = currentUserRole === 'TUTOR' || currentUserRole === 'ADMIN';
        
        console.log('🚀 JOIN MEETING DEBUG:', {
          currentUserRole,
          isTutor,
          actualUserId,
          actualMeetingId
        });
        
        if (isTutor) {
          // HOST FLOW: Start meeting first, then join
          console.log('🚀 HOST FLOW: Starting meeting...');
          
          // Step 1: Start the meeting
          const { START_MEETING } = await import('../apollo/livestream/mutations');
          const { makeGraphQLRequest } = await import('../lib/simple-auth-handlers');
          
          const startResult = await makeGraphQLRequest(START_MEETING, {
            meetingId: actualMeetingId
          });
          
          console.log('🚀 HOST FLOW: Meeting started:', startResult);
          
          // Step 2: Join the meeting
          const { JOIN_MEETING } = await import('../apollo/livestream/mutations');
          
          const joinMeetingInput = {
            meetingId: actualMeetingId,
            displayName: actualUserEmail || 'Host',
            role: 'HOST'
          };
          
          console.log('🚀 HOST FLOW: Joining with input:', joinMeetingInput);
          
          const joinResult = await makeGraphQLRequest(JOIN_MEETING, {
            input: joinMeetingInput
          });
          
          console.log('🚀 HOST FLOW: Joined meeting:', joinResult);
          
        } else {
          // MEMBER FLOW: Just join (if meeting is started)
          console.log('🚀 MEMBER FLOW: Joining meeting...');
          
          const { JOIN_MEETING } = await import('../apollo/livestream/mutations');
          const { makeGraphQLRequest } = await import('../lib/simple-auth-handlers');
          
          const joinMeetingInput = {
          meetingId: actualMeetingId,
            displayName: actualUserEmail || 'Participant',
            role: 'PARTICIPANT'
          };
          
          console.log('🚀 MEMBER FLOW: Joining with input:', joinMeetingInput);
          
          const joinResult = await makeGraphQLRequest(JOIN_MEETING, {
            input: joinMeetingInput
          });
          
          console.log('🚀 MEMBER FLOW: Joined meeting:', joinResult);
        }
        
        console.log('✅ Successfully entered meeting!');
        
      } catch (error: any) {
        console.error('❌ MEETING ENTRY: Failed:', error);
        console.error('❌ MEETING ENTRY: Error details:', {
          message: error.message,
          stack: error.stack,
          graphQLErrors: error.graphQLErrors,
          networkError: error.networkError,
          name: error.name
        });
        
        // Handle specific GraphQL errors
        if (error.graphQLErrors && error.graphQLErrors.length > 0) {
          const firstError = error.graphQLErrors[0];
          console.error('❌ GRAPHQL ERROR:', firstError);
          setError(`GraphQL Error: ${firstError.message}`);
        } else if (error.networkError) {
          console.error('❌ NETWORK ERROR:', error.networkError);
          setError(`Network Error: ${error.networkError.message || 'Failed to connect to server'}`);
        } else {
          setError(`Failed to enter meeting: ${error.message || 'Unknown error'}`);
        }
      }
    };
    
    handleMeetingEntry();
  }, [authComplete, isAuth, actualMeetingId, currentUserRole, loading]);

  const initializeVideo = async () => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !navigator.mediaDevices) {
      console.log('🔍 VIDEO: Not in browser environment or mediaDevices not available');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Store the stream reference
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('✅ Video stream initialized');
            } catch (error) {
      console.error('❌ Error accessing camera/microphone:', error);
      setError('Unable to access camera/microphone. Please check permissions.');
    }
  };

  const toggleMute = () => {
    if (typeof window === 'undefined' || !localStreamRef.current) {
      console.log('🔍 MUTE: Not in browser environment or no stream available');
        return;
      }

    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = isMuted; // Enable if currently muted, disable if currently unmuted
    });
    setIsMuted(!isMuted);
    console.log('🎤 Mute toggled:', !isMuted);
  };

  const toggleCamera = () => {
    if (typeof window === 'undefined' || !localStreamRef.current) {
      console.log('🔍 CAMERA: Not in browser environment or no stream available');
      return;
    }

    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = isCameraOn; // Enable if currently off, disable if currently on
    });
    setIsCameraOn(!isCameraOn);
    console.log('📹 Camera toggled:', !isCameraOn);
  };

  const toggleScreenShare = async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) {
      console.log('🔍 SCREEN SHARE: Not in browser environment or mediaDevices not available');
      return;
    }
    
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true 
        });
        
        // Store the remote stream reference
        remoteStreamRef.current = stream;
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        console.log('📺 Screen sharing started');
        } else {
        // Stop the screen sharing stream
        if (remoteStreamRef.current) {
          remoteStreamRef.current.getTracks().forEach(track => track.stop());
          remoteStreamRef.current = null;
        }
        
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        setIsScreenSharing(false);
        console.log('📺 Screen sharing stopped');
      }
    } catch (error) {
      console.error('❌ Error with screen sharing:', error);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        text: newMessage,
        sender: 'You',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setChatMessages(prev => [...prev, message]);
      setNewMessage('');
      console.log('💬 Message sent:', message);
    }
  };

  const startMeeting = () => {
    console.log('🚀 Meeting started');
    // TODO: Implement actual meeting start
  };

  const endMeeting = () => {
    console.log('🛑 Meeting ended');
    // TODO: Implement actual meeting end
    window.location.href = '/dashboard';
  };

  if (loading) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '3px solid #333',
            borderTop: '3px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
        <p>Loading Live Stream Room...</p>
        </div>
      </div>
    );
  }

  // Handle chat errors gracefully
  const handleChatError = (error: any) => {
    if (error?.message?.includes('incoming is not iterable')) {
      console.warn('Chat data structure error, continuing without chat...');
      return false; // Don't treat as critical error
    }
    return true; // Treat as critical error
  };

  if (error) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Error</h2>
          <p style={{ marginBottom: '20px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Meeting Not Found</h2>
          <p>Meeting ID: {meetingId}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
        backgroundColor: '#1a1a1a',
      color: 'white',
      display: 'flex',
      flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
        padding: '20px',
        borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        backgroundColor: '#2a2a2a'
        }}>
          <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>{meeting.title}</h1>
          <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '14px' }}>
            Meeting ID: {actualMeetingId} | Status: {meeting.status} | Role: {currentUserRole}
            </p>
          </div>
        <div style={{ display: 'flex', gap: '10px' }}>
                <button
            onClick={startMeeting}
                  style={{
                    padding: '8px 16px',
              backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
                  }}
                >
            🚀 Start Meeting
                </button>
          <button 
            onClick={endMeeting}
            style={{
                padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🛑 End Meeting
          </button>
          </div>
        </div>

      {/* Main Content */}
        <div style={{
          flex: 1,
          display: 'flex',
        padding: '20px',
        gap: '20px'
      }}>
        {/* Video Area */}
          <div style={{
          flex: 2,
            display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Main Video */}
                <div style={{
            flex: 1,
            backgroundColor: '#2a2a2a',
                  borderRadius: '8px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <video
              ref={remoteVideoRef}
              autoPlay
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            {!isScreenSharing && (
                <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                  width: '200px',
                  height: '150px',
                  backgroundColor: '#333',
                  borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: isCameraOn ? 'block' : 'none'
                  }}
                />
                {!isCameraOn && (
                <div style={{
                    width: '100%',
                    height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                    backgroundColor: '#333',
                    color: '#888',
                    fontSize: '14px'
                }}>
                    Camera Off
                </div>
                )}
              </div>
            )}
        </div>

        {/* Manual Join Button */}
        {!hasJoinedMeeting && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
            backgroundColor: '#2a2a2a'
        }}>
          <button
              onClick={async () => {
                console.log('🚀 MANUAL JOIN: Button clicked');
                setIsJoiningMeeting(true);
                setError(null);
                
                try {
                  const isTutor = currentUserRole === 'TUTOR' || currentUserRole === 'ADMIN';
                  
                  if (isTutor) {
                    // Start meeting first
                    const { START_MEETING } = await import('../apollo/livestream/mutations');
                    const { makeGraphQLRequest } = await import('../lib/simple-auth-handlers');
                    
                    const startResult = await makeGraphQLRequest(START_MEETING, {
                      meetingId: actualMeetingId
                    });
                    
                    console.log('🚀 MANUAL JOIN: Meeting started:', startResult);
                    setMeetingStatus('ACTIVE');
                  }
                  
                  // Then join
                  const { JOIN_MEETING } = await import('../apollo/livestream/mutations');
                  const { makeGraphQLRequest } = await import('../lib/simple-auth-handlers');
                  
                  const joinResult = await makeGraphQLRequest(JOIN_MEETING, {
                    input: {
                      meetingId: actualMeetingId,
                      displayName: actualUserEmail || (isTutor ? 'Host' : 'Participant'),
                      role: isTutor ? 'HOST' : 'PARTICIPANT'
                    }
                  });
                  
                  console.log('🚀 MANUAL JOIN: Joined meeting:', joinResult);
                  
                  if (joinResult?.joinMeeting?._id) {
                    setCurrentParticipantId(joinResult.joinMeeting._id);
                    setHasJoinedMeeting(true);
                    setError(null);
                  }
                } catch (error: any) {
                  console.error('🚀 MANUAL JOIN: Failed:', error);
                  setError(`Failed to join: ${error.message || 'Unknown error'}`);
                } finally {
                  setIsJoiningMeeting(false);
                }
              }}
              disabled={isJoiningMeeting}
            style={{
                padding: '15px 30px',
                backgroundColor: '#007bff',
              color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isJoiningMeeting ? 'not-allowed' : 'pointer',
                opacity: isJoiningMeeting ? 0.6 : 1,
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {isJoiningMeeting ? 'Joining...' : 'Join Meeting'}
          </button>
          </div>
        )}

          {/* Video Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
            gap: '15px',
            padding: '15px',
          backgroundColor: '#2a2a2a',
            borderRadius: '8px'
        }}>
          <button
              onClick={toggleMute}
            style={{
                padding: '12px 20px',
                backgroundColor: isMuted ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
                borderRadius: '50px',
              cursor: 'pointer',
                fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
                gap: '8px'
            }}
          >
              {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmute' : 'Mute'}
          </button>
          
          <button
              onClick={toggleCamera}
            style={{
                padding: '12px 20px',
                backgroundColor: isCameraOn ? '#28a745' : '#dc3545',
              color: 'white',
              border: 'none',
                borderRadius: '50px',
              cursor: 'pointer',
                fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
                gap: '8px'
            }}
          >
              {isCameraOn ? '📹' : '📷'} {isCameraOn ? 'Camera On' : 'Camera Off'}
          </button>
          
          <button
              onClick={toggleScreenShare}
            style={{
                padding: '12px 20px',
                backgroundColor: isScreenSharing ? '#ffc107' : '#17a2b8',
                color: isScreenSharing ? 'black' : 'white',
              border: 'none',
                borderRadius: '50px',
              cursor: 'pointer',
                fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
                gap: '8px'
            }}
          >
              📺 {isScreenSharing ? 'Stop Share' : 'Share Screen'}
          </button>
        </div>
      </div>

        {/* Sidebar */}
      <div style={{
          width: '300px',
        display: 'flex',
          flexDirection: 'column',
          gap: '20px'
      }}>
          {/* Participants */}
        <div style={{
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            padding: '15px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Participants ({participants.length + 1})</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#007bff',
                borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                justifyContent: 'center',
              color: 'white',
              fontSize: '14px'
              }}>
                {(role || 'P').charAt(0)}
        </div>
              <span>You ({role || 'Participant'})</span>
            </div>
            {participants.map((participant, index) => (
              <div key={participant._id || index} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                  backgroundColor: participant.role === 'HOST' ? '#007bff' : '#6c757d',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                  fontSize: '14px'
                      }}>
                  {participant.role === 'HOST' ? 'H' : 'P'}
                      </div>
                <span>{participant.displayName || `Participant ${index + 1}`} ({participant.role === 'HOST' ? 'Host' : 'Participant'})</span>
                  </div>
                ))}
              </div>

          {/* Chat */}
          <div style={{
            flex: 1,
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            padding: '15px',
            display: 'flex',
            flexDirection: 'column'
          }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Chat</h3>
            
            {/* Chat Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '15px',
              maxHeight: '200px'
            }}>
              {(() => {
                // Add safety check for chat messages
                const safeChatMessages = (() => {
                  try {
                    if (!Array.isArray(chatMessages)) {
                      console.warn('Chat messages is not an array:', chatMessages);
                      return [];
                    }
                    return chatMessages;
                  } catch (error) {
                    console.error('Error processing chat messages for rendering:', error);
                    return [];
                  }
                })();

                return safeChatMessages.length === 0 ? (
                  <p style={{ color: '#888', fontSize: '14px', textAlign: 'center' }}>No messages yet</p>
                ) : (
                  safeChatMessages.map((message) => (
                    <div key={message.id} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '2px' }}>
                        {message.sender} • {message.timestamp}
                  </div>
                      <div style={{ fontSize: '14px' }}>{message.text}</div>
              </div>
                  ))
                );
              })()}
              </div>
            
            {/* Chat Input */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#333',
                    color: 'white',
                    border: '1px solid #555',
                  borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                <button
                onClick={sendMessage}
                  style={{
                  padding: '8px 12px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                  borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalLiveStreamRoom;