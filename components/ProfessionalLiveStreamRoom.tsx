import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { isAuthenticated, getCurrentUser, forceLogin } from '../lib/simple-auth-handlers';
import { GET_MEETING_BY_ID } from '../apollo/livestream/queries';
import {
  GET_PARTICIPANTS_BY_MEETING,
  GET_WAITING_PARTICIPANTS,
  GET_CHAT_HISTORY,
  GET_RAISED_HANDS,
  GET_PARTICIPANT_STATS,
  GET_CHAT_STATS,
  START_MEETING,
  END_MEETING,
  JOIN_MEETING,
  LEAVE_MEETING,
  UPDATE_SESSION,
  FORCE_MUTE,
  FORCE_CAMERA_OFF,
  REMOVE_PARTICIPANT,
  APPROVE_PARTICIPANT,
  REJECT_PARTICIPANT,
  RAISE_HAND,
  LOWER_HAND,
  HOST_LOWER_HAND,
  LOWER_ALL_HANDS,
  DELETE_CHAT_MESSAGE,
  MEETING_UPDATED,
  PARTICIPANT_JOINED,
  PARTICIPANT_LEFT,
  PARTICIPANT_UPDATED,
  CHAT_MESSAGE_ADDED,
  HAND_RAISED,
  HAND_LOWERED,
  type Meeting,
  type Participant,
  type ChatMessage,
  type WaitingParticipant,
  type ParticipantStats,
  type ChatStats,
  type JoinParticipantInput,
  type UpdateSessionInput,
  type ForceMuteInput,
  type ForceCameraOffInput,
  type ApproveParticipantInput,
  type RejectParticipantInput,
  type RaiseHandInput,
  type LowerHandInput,
  type HostLowerHandInput,
  type DeleteMessageInput
} from '../apollo/livestream/mutations';

// Add additional mutations for leave functionality
const FORCE_LEAVE_MEETING = gql`
  mutation ForceLeaveMeeting($meetingId: ID!) {
    forceLeaveMeeting(meetingId: $meetingId)
  }
`;

const GET_PARTICIPANT_BY_USER_MEETING = gql`
  query GetParticipantByUserAndMeeting($meetingId: ID!) {
    getParticipantByUserAndMeeting(meetingId: $meetingId) {
      _id
      displayName
      role
      status
      userId {
        _id
        displayName
        email
      }
    }
  }
`;

interface ProfessionalLiveStreamRoomProps {
  meetingId?: string;
  role?: 'HOST' | 'PARTICIPANT';
  userId?: string;
}

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = ({
  meetingId: propMeetingId,
  role = 'HOST',
  userId = 'p1'
}) => {
  // State management
  const [actualMeetingId, setActualMeetingId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'participants' | 'waiting' | 'chat' | 'analytics' | null>(
    role === 'HOST' ? 'participants' : null
  );
  const [raiseHands, setRaiseHands] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [participantChat, setParticipantChat] = useState<{
    [key: string]: { _id: string; text: string; displayName: string; createdAt: string }[];
  }>({});
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'students'>('students');
  const [mainVideoParticipant, setMainVideoParticipant] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [hasJoinedMeeting, setHasJoinedMeeting] = useState<boolean>(false);
  const [isJoiningMeeting, setIsJoiningMeeting] = useState<boolean>(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('MEMBER');
  const [meetingStatus, setMeetingStatus] = useState<string>('WAITING');
  const [authComplete, setAuthComplete] = useState<boolean>(false);
  const [actualUserId, setActualUserId] = useState<string>('');
  const [actualUserEmail, setActualUserEmail] = useState<string>('');
  const [currentParticipant, setCurrentParticipant] = useState<any>(null);

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Refs for video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);

  // Set meetingId from prop or URL
  useEffect(() => {
    if (propMeetingId) {
      console.log('🎯 FRONTEND: Setting meetingId from prop:', propMeetingId);
      setActualMeetingId(propMeetingId);
    } else if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const meetingIdFromUrl = pathParts[pathParts.length - 1];
      if (meetingIdFromUrl && meetingIdFromUrl !== 'livestream') {
        console.log('🎯 FRONTEND: Setting meetingId from URL:', meetingIdFromUrl);
        setActualMeetingId(meetingIdFromUrl);
      }
    }
  }, [propMeetingId]);

  // Authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setIsAuth(true);
          setActualUserId(user._id);
          setActualUserEmail(user.email);
          setCurrentUserRole(user.systemRole || 'MEMBER');
          console.log('✅ FRONTEND: User authenticated:', user);
        } else {
          console.log('❌ FRONTEND: User not authenticated');
          setIsAuth(false);
        }
      } catch (error) {
        console.error('❌ FRONTEND: Auth check failed:', error);
        setIsAuth(false);
      } finally {
        setAuthComplete(true);
      }
    };

    checkAuth();
  }, []);

  // GraphQL Queries
  const { data: meetingData, loading: meetingLoading, error: meetingError } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId
  });

  const { data: participantsData, loading: participantsLoading, error: participantsError, refetch: refetchParticipants } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !hasJoinedMeeting,
    pollInterval: 5000 // Poll every 5 seconds
  });

  // Mutations
  const [joinMeeting] = useMutation(JOIN_MEETING);
  const [startMeeting] = useMutation(START_MEETING);
  const [leaveMeeting] = useMutation(LEAVE_MEETING);
  const [forceLeaveMeeting] = useMutation(FORCE_LEAVE_MEETING);

  // Get current user's participant data
  const { data: currentParticipantData } = useQuery(GET_PARTICIPANT_BY_USER_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !hasJoinedMeeting
  });

  // Media access functions
  const startCamera = async () => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      setIsVideoOn(true);
      setIsMicOn(true);
      
      // Attach stream to video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      console.log('✅ Camera and microphone started');
    } catch (error) {
      console.error('❌ Failed to start camera:', error);
      setMediaError('Failed to access camera and microphone. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      setIsVideoOn(false);
      setIsMicOn(false);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      
      console.log('✅ Camera and microphone stopped');
    }
  };

  const toggleCamera = async () => {
    if (isVideoOn) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  const toggleMicrophone = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !isMicOn;
      });
      setIsMicOn(!isMicOn);
      console.log(`✅ Microphone ${isMicOn ? 'muted' : 'unmuted'}`);
    }
  };

  const startScreenShare = async () => {
    try {
      setMediaError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      setScreenStream(stream);
      setIsScreenSharing(true);
      
      // Attach stream to screen share element
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = stream;
      }
      
      // Handle screen share end
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      console.log('✅ Screen sharing started');
        } catch (error) {
      console.error('❌ Failed to start screen share:', error);
      setMediaError('Failed to start screen sharing. Please check permissions.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = null;
      }
      
      console.log('✅ Screen sharing stopped');
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
          } else {
      await startScreenShare();
    }
  };


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle leaving the meeting
  const handleLeaveMeeting = async () => {
    try {
      console.log('🚪 FRONTEND: Leaving meeting...');
      console.log('🚪 FRONTEND: Current participant data:', currentParticipantData);
      console.log('🚪 FRONTEND: Meeting ID:', actualMeetingId);
      
      // Get the current user's participant from the dedicated query
      const currentUserParticipant = (currentParticipantData as any)?.getParticipantByUserAndMeeting;
      
      if (currentUserParticipant?._id) {
        console.log('🚪 FRONTEND: Using participant ID from getParticipantByUserAndMeeting:', currentUserParticipant._id);
        console.log('🚪 FRONTEND: Participant details:', {
          _id: currentUserParticipant._id,
          displayName: currentUserParticipant.displayName,
          role: currentUserParticipant.role,
          status: currentUserParticipant.status,
          userId: currentUserParticipant.userId?._id
        });
        
        const result = await leaveMeeting({
          variables: {
            input: {
              participantId: currentUserParticipant._id
            }
          }
        });
        
        console.log('✅ FRONTEND: Leave meeting success:', (result.data as any)?.leaveMeeting?.message);
        alert('Successfully left the meeting');
        window.location.href = '/dashboard';
        
      } else {
        console.log('🚪 FRONTEND: No participant found, using force leave for meeting:', actualMeetingId);
        
        const result = await forceLeaveMeeting({
          variables: {
            meetingId: actualMeetingId
          }
        });
        
        console.log('✅ FRONTEND: Force leave success:', result.data);
        alert('Successfully left the meeting');
        window.location.href = '/dashboard';
      }
      
    } catch (error: any) {
      console.error('❌ FRONTEND: Failed to leave meeting:', error);
      console.error('❌ FRONTEND: Error details:', {
        message: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError
      });
      alert('Failed to leave meeting: ' + (error.message || 'Unknown error'));
    }
  };


  // Auto-join meeting when ready
  useEffect(() => {
    const joinMeetingWhenReady = async () => {
      if (!authComplete || !isAuth || hasJoinedMeeting || isJoiningMeeting || !actualMeetingId) {
        console.log('⏳ FRONTEND: Not ready to join meeting', {
          authComplete,
          isAuth,
          hasJoinedMeeting,
          isJoiningMeeting,
          actualMeetingId
        });
        return;
      }

      setIsJoiningMeeting(true);
      setAuthError(null);
      
      try {
        const isTutor = currentUserRole === 'TUTOR' || currentUserRole === 'ADMIN';
        
        const joinMeetingInput: JoinParticipantInput = {
          meetingId: actualMeetingId,
          displayName: actualUserId || (isTutor ? 'Host' : 'Participant'),
          role: isTutor ? 'HOST' : 'PARTICIPANT'
        };

        console.log('🚀 FRONTEND: Attempting to join meeting...', joinMeetingInput);
        
        const result: any = await joinMeeting({
          variables: { input: joinMeetingInput }
        });

        console.log('🚀 FRONTEND: Join result:', result);
        
        if (result.data?.joinMeeting?._id) {
          console.log('✅ FRONTEND: Successfully joined meeting!', {
            participantId: result.data.joinMeeting._id,
            meetingId: actualMeetingId,
            role: result.data.joinMeeting.role
          });
          
          setCurrentParticipantId(result.data.joinMeeting._id);
          setCurrentParticipant(result.data.joinMeeting);
          setHasJoinedMeeting(true);
          setAuthError(null);
          
          // Auto-start camera after joining
          await startCamera();
          
          // Auto-start meeting for tutors
          if (isTutor) {
            console.log('🚀 FRONTEND: Auto-starting meeting...');
            try {
              const startResult = await startMeeting({
                variables: { meetingId: actualMeetingId }
              });
              console.log('✅ FRONTEND: Meeting started successfully:', startResult);
              setMeetingStatus('ACTIVE');
              setIsRecording(true);
            } catch (startError: any) {
              console.error('❌ FRONTEND: Failed to start meeting:', startError);
            }
          }
        } else {
          throw new Error('No participant ID received from join meeting response');
        }
      } catch (error: any) {
        console.error('❌ FRONTEND: Join meeting failed:', error);
        setAuthError(`Failed to join meeting: ${error.message}`);
      } finally {
        setIsJoiningMeeting(false);
      }
    };
    
    joinMeetingWhenReady();
  }, [authComplete, isAuth, hasJoinedMeeting, isJoiningMeeting, actualMeetingId, currentUserRole, actualUserId, joinMeeting, startMeeting]);

  // Extract data
  const meeting = (meetingData as any)?.getMeetingById;
  const participants = (participantsData as any)?.getParticipantsByMeeting || [];


  // Track current participant ID for leave functionality
  useEffect(() => {
    console.log('🔍 PARTICIPANT TRACKING: Checking participants...', {
      participantsCount: participants?.length || 0,
      actualUserId,
      currentParticipantId
    });

    if (participants && participants.length > 0 && actualUserId) {
      console.log('🔍 PARTICIPANT TRACKING: Searching through participants...', {
        participants: participants.map((p: any) => ({
          _id: p._id,
          userId: p.userId?._id,
          displayName: p.displayName,
          role: p.role
        }))
      });

      const currentParticipant = participants.find((p: any) => {
        const participantUserId = p.userId?._id || p.userId;
        const matches = participantUserId && participantUserId.toString() === actualUserId.toString();
        console.log('🔍 CHECKING PARTICIPANT:', {
          participantId: p._id,
          participantUserId: participantUserId,
          actualUserId: actualUserId,
          matches: matches,
          displayName: p.displayName
        });
        return matches;
      });
      
      if (currentParticipant) {
        console.log('🎯 CURRENT PARTICIPANT: Found and setting', {
          participantId: currentParticipant._id,
          displayName: currentParticipant.displayName,
          role: currentParticipant.role,
          userId: currentParticipant.userId?._id,
          actualUserId
        });
        setCurrentParticipantId(currentParticipant._id);
      } else {
        console.log('❌ CURRENT PARTICIPANT: Not found in participants list', {
          actualUserId,
          participants: participants.map((p: any) => ({
            _id: p._id,
            userId: p.userId?._id,
            displayName: p.displayName
          }))
        });
      }
    } else {
      console.log('❌ PARTICIPANT TRACKING: Missing data', {
        hasParticipants: !!(participants && participants.length > 0),
        hasActualUserId: !!actualUserId,
        participantsCount: participants?.length || 0
      });
    }
  }, [participants, actualUserId]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 FRONTEND DEBUG: Current participant:', currentParticipant);
    console.log('🔍 FRONTEND DEBUG: Meeting ID:', actualMeetingId);
    console.log('🔍 FRONTEND DEBUG: Participants count:', participants.length);
  }, [currentParticipant, actualMeetingId, participants.length]);

  // Subscriptions for real-time updates
  useSubscription(PARTICIPANT_JOINED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId
  });

  useSubscription(PARTICIPANT_LEFT, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId
  });

  // Loading state
  if (meetingLoading || !authComplete) {
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

  // Error state
  if (meetingError) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
      }}>
        <h2>Error Loading Meeting</h2>
        <p>{meetingError.message}</p>
            <button
          onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          Reload Page
            </button>
      </div>
    );
  }

  // No meeting ID
  if (!actualMeetingId) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
      }}>
        <h2>No Meeting ID Found</h2>
        <p>Please check the URL or try again.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '20px'
            }}
          >
          Reload Page
          </button>
      </div>
    );
  }

  // Main render
    return (
    <div style={{
          display: 'flex',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
      fontFamily: 'Arial, sans-serif',
      position: 'relative'
    }}>
      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
          padding: '10px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          maxWidth: '300px'
        }}>
        <div><strong>Debug Info:</strong></div>
        <div>Meeting ID: {actualMeetingId}</div>
        <div>User ID: {actualUserId}</div>
        <div>User Role: {currentUserRole}</div>
        <div>Participants: {participants.length}</div>
        <div>Has Joined: {hasJoinedMeeting ? 'Yes' : 'No'}</div>
        <div>Current Participant ID: {currentParticipantId || 'Not set'}</div>
        <div>Current User Participant: {(currentParticipantData as any)?.getParticipantByUserAndMeeting ? JSON.stringify((currentParticipantData as any).getParticipantByUserAndMeeting, null, 2) : 'None'}</div>
        <div>Local Stream: {localStream ? 'Yes' : 'No'}</div>
        <div>Camera: {isVideoOn ? 'On' : 'Off'}</div>
        <div>Mic: {isMicOn ? 'On' : 'Off'}</div>
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={handleLeaveMeeting}
              style={{
                padding: '5px 10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              Test Leave Meeting
            </button>
          </div>
        </div>
      )}

      {/* Main Video Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 20px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderBottom: '1px solid #333',
          zIndex: 100
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px' }}>
              {meeting?.title || 'Live Meeting'}
            </h1>
            <p style={{ margin: '5px 0 0 0', color: '#ccc', fontSize: '14px' }}>
              Meeting ID: {actualMeetingId}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              padding: '4px 8px',
              backgroundColor: meetingStatus === 'ACTIVE' ? '#28a745' : '#ffc107',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {meetingStatus}
            </span>
            {isRecording && (
              <span style={{
                padding: '4px 8px',
                backgroundColor: '#dc3545',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                REC
              </span>
            )}
                <button
              onClick={toggleFullscreen}
                  style={{
                padding: '8px',
                backgroundColor: 'transparent',
                border: '1px solid #555',
                borderRadius: '4px',
                    color: 'white',
                cursor: 'pointer'
                  }}
                >
              {isFullscreen ? '⤓' : '⤢'}
                </button>
          </div>
        </div>

        {/* Main Video Area - Zoom-like Layout */}
        <div 
          style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          {participants.length > 0 ? (
          <div style={{
              display: 'grid',
              gridTemplateColumns: participants.length === 1 ? '1fr' : 
                                 participants.length === 2 ? '1fr 1fr' : 
                                 participants.length <= 4 ? '1fr 1fr' : 
                                 participants.length <= 9 ? '1fr 1fr 1fr' : '1fr 1fr 1fr 1fr',
              gap: '8px',
            width: '100%',
            height: '100%',
              padding: '10px'
            }}>
              {participants.map((participant: any) => {
                const realDisplayName = participant.userId?.displayName || participant.displayName || 'Anonymous';
                const realRole = participant.role === 'HOST' ? 'Host' : 'Participant';
                const isCurrentUser = participant.userId?._id === actualUserId;
                
                return (
                  <div key={participant._id} style={{
                  backgroundColor: '#333',
                  borderRadius: '8px',
                  display: 'flex',
                    flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                    minHeight: '200px',
                    border: participant.role === 'HOST' ? '2px solid #007bff' : '1px solid #555',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                  onClick={() => setMainVideoParticipant(participant._id)}
                  >
                    {/* Video Element - Only show for current user */}
                    {isCurrentUser && localStream && (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          position: 'absolute',
                          top: 0,
                          left: 0
                        }}
                      />
                    )}
                    
                    {/* Screen Share Overlay - Only show for current user */}
                    {isCurrentUser && isScreenSharing && screenStream && (
                      <video
                        ref={screenShareRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          zIndex: 1
                        }}
                      />
                    )}
                    
                    {/* Fallback Avatar */}
                    {(!isCurrentUser || !localStream) && (
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        backgroundColor: participant.role === 'HOST' ? '#007bff' : '#28a745',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        marginBottom: '10px'
                      }}>
                        {realDisplayName.charAt(0).toUpperCase()}
                </div>
                    )}
                    
                    {/* Name and Status Overlay */}
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      left: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '2px', color: 'white', fontSize: '12px' }}>
                        {realDisplayName} {isCurrentUser && '(You)'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#ccc' }}>
                        {realRole}
                      </div>
                      <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>
                        {participant.micState === 'OFF' ? '🔇' : '🎤'} {participant.cameraState === 'OFF' ? '📹' : '📷'}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                  backgroundColor: '#333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                fontSize: '48px',
                margin: '0 auto 20px'
                }}>
                👥
                </div>
              <h3>No Participants Yet</h3>
              <p>Waiting for participants to join...</p>
              </div>
            )}
        </div>

        {/* Bottom Controls - Zoom-like */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '15px 20px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderTop: '1px solid #333',
          opacity: showControls ? 1 : 0.3,
          transition: 'opacity 0.3s ease'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Mic Control */}
          <button
              onClick={toggleMicrophone}
            style={{
                width: '40px',
                height: '40px',
              borderRadius: '50%',
              border: 'none',
                backgroundColor: isMicOn ? '#28a745' : '#dc3545',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
                fontSize: '16px'
            }}
          >
            {isMicOn ? '🎤' : '🔇'}
          </button>
          
            {/* Camera Control */}
          <button
              onClick={toggleCamera}
            style={{
                width: '40px',
                height: '40px',
              borderRadius: '50%',
              border: 'none',
                backgroundColor: isVideoOn ? '#28a745' : '#dc3545',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
                fontSize: '16px'
            }}
          >
              {isVideoOn ? '📷' : '📹'}
          </button>
          
            {/* Screen Share Control */}
          <button
              onClick={toggleScreenShare}
            style={{
                width: '40px',
                height: '40px',
              borderRadius: '50%',
              border: 'none',
                backgroundColor: isScreenSharing ? '#007bff' : '#6c757d',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
                fontSize: '16px'
            }}
          >
              🖥️
          </button>
          
            {/* Recording Control (Host only) */}
            {currentUserRole === 'HOST' && (
          <button
                onClick={() => setIsRecording(!isRecording)}
            style={{
                  width: '40px',
                  height: '40px',
              borderRadius: '50%',
              border: 'none',
                  backgroundColor: isRecording ? '#dc3545' : '#28a745',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                {isRecording ? '⏹️' : '⏺️'}
              </button>
            )}
            
            {/* More Options */}
            <button
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#6c757d',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}
            >
              ⋯
            </button>
            
            {/* Leave Meeting Button */}
            <button
              onClick={handleLeaveMeeting}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: '#dc3545',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                marginLeft: '20px'
              }}
            >
              📞
          </button>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        width: '300px',
        backgroundColor: '#2a2a2a',
        borderLeft: '1px solid #333',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Panel Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #333'
        }}>
          <button
            onClick={() => setRightPanelTab('students')}
            style={{
              flex: 1,
              padding: '15px',
              backgroundColor: rightPanelTab === 'students' ? '#007bff' : 'transparent',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Participants ({participants.length})
          </button>
          <button
            onClick={() => setRightPanelTab('chat')}
            style={{
              flex: 1,
              padding: '15px',
              backgroundColor: rightPanelTab === 'chat' ? '#007bff' : 'transparent',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Chat
          </button>
        </div>

        {/* Panel Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {rightPanelTab === 'students' ? (
            <div style={{ padding: '15px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Participants</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {participants.map((participant: any) => {
                  const realDisplayName = participant.userId?.displayName || participant.displayName || 'Anonymous';
                  const realRole = participant.role === 'HOST' ? 'Host' : 'Participant';
                  const isCurrentUser = participant.userId?._id === actualUserId;
                  
                  return (
                  <div
                    key={participant._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                        padding: '8px',
                        backgroundColor: isCurrentUser ? '#444' : '#333',
                        borderRadius: '6px',
                        border: isCurrentUser ? '1px solid #007bff' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                          width: '28px',
                          height: '28px',
                        borderRadius: '50%',
                          backgroundColor: participant.role === 'HOST' ? '#007bff' : '#28a745',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                          fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                          {realDisplayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                          <p style={{ margin: 0, fontSize: '12px', fontWeight: '500' }}>
                            {realDisplayName} {isCurrentUser && '(You)'}
                        </p>
                          <p style={{ margin: 0, fontSize: '10px', color: '#ccc' }}>
                            {realRole}
                        </p>
                      </div>
                    </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#888' }}>
                          {participant.micState === 'OFF' ? '🔇' : '🎤'} {participant.cameraState === 'OFF' ? '📹' : '📷'}
                        </span>
                        {isCurrentUser && (
                          <span style={{ fontSize: '8px', color: '#007bff' }}>
                            YOU
                          </span>
                        )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>Chat</h3>
              <div style={{ color: '#ccc' }}>
                <p>Chat functionality coming soon...</p>
                  </div>
              </div>
          )}
        </div>
      </div>

      {/* Media Error Display */}
      {mediaError && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#dc3545',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '4px',
          zIndex: 1000
        }}>
          {mediaError}
          <button
            onClick={() => setMediaError(null)}
                  style={{
              marginLeft: '10px',
              backgroundColor: 'transparent',
              border: 'none',
                    color: 'white',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Manual Join Button (for debugging) */}
      {!hasJoinedMeeting && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          padding: '30px',
          borderRadius: '8px',
          textAlign: 'center',
          zIndex: 1000,
          border: '2px solid #007bff'
        }}>
          <h3>Join Meeting</h3>
          <p>Meeting ID: {actualMeetingId}</p>
          <p>Your Role: {currentUserRole}</p>
          <p>Status: {isJoiningMeeting ? 'Joining...' : 'Ready to join'}</p>
                <button
            onClick={async () => {
              try {
                const isTutor = currentUserRole === 'TUTOR' || currentUserRole === 'ADMIN';
                const joinMeetingInput: JoinParticipantInput = {
                  meetingId: actualMeetingId,
                  displayName: actualUserId || (isTutor ? 'Host' : 'Participant'),
                  role: isTutor ? 'HOST' : 'PARTICIPANT'
                };
                
                const result: any = await joinMeeting({
                  variables: { input: joinMeetingInput }
                });
                
                if (result.data?.joinMeeting?._id) {
                  setCurrentParticipantId(result.data.joinMeeting._id);
                  setHasJoinedMeeting(true);
                  await startCamera();
                  console.log('✅ Manually joined meeting:', result.data.joinMeeting);
                }
              } catch (error) {
                console.error('❌ Manual join failed:', error);
              }
            }}
            disabled={isJoiningMeeting}
                  style={{
              padding: '15px 30px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
              borderRadius: '4px',
                    cursor: 'pointer',
              marginTop: '15px',
              fontSize: '16px'
                  }}
                >
            {isJoiningMeeting ? 'Joining...' : 'Join Meeting'}
                </button>
            </div>
          )}
    </div>
  );
};

export default ProfessionalLiveStreamRoom;