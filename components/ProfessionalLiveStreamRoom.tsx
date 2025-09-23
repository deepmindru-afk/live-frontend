import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
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

interface ProfessionalLiveStreamRoomProps {
  meetingId?: string;
  role?: 'HOST' | 'PARTICIPANT';
  userId?: string;
}

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = ({
  meetingId,
  role = 'HOST',
  userId = 'p1'
}) => {
  // Simplified state management
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

  // Get meeting data from GraphQL
  const { data: meetingData, loading: meetingLoading, error: meetingError } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !authComplete,
    errorPolicy: 'all'
  });

  // GraphQL Queries
  const { data: participantsData, loading: participantsLoading, error: participantsError } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !authComplete || !hasJoinedMeeting,
    errorPolicy: 'all',
    pollInterval: (hasJoinedMeeting) ? 5000 : 0
  });

  const { data: waitingData, loading: waitingLoading, error: waitingError } = useQuery(GET_WAITING_PARTICIPANTS, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !authComplete || !hasJoinedMeeting,
    errorPolicy: 'all',
    pollInterval: (hasJoinedMeeting) ? 5000 : 0
  });

  const { data: chatData, loading: chatLoading, error: chatError } = useQuery(GET_CHAT_HISTORY, {
    variables: { 
      input: { 
        meetingId: actualMeetingId,
        limit: 50,
        offset: 0
      }
    },
    skip: !actualMeetingId || !authComplete || !hasJoinedMeeting,
    errorPolicy: 'all'
  });

  const { data: raisedHandsData, loading: raisedHandsLoading, error: raisedHandsError } = useQuery(GET_RAISED_HANDS, {
    variables: { 
      input: { meetingId: actualMeetingId }
    },
    skip: !actualMeetingId || !authComplete || !hasJoinedMeeting,
    errorPolicy: 'all',
    pollInterval: (hasJoinedMeeting) ? 2000 : 0
  });

  const { data: participantStatsData, loading: statsLoading, error: statsError } = useQuery(GET_PARTICIPANT_STATS, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !authComplete || !hasJoinedMeeting,
    errorPolicy: 'all',
    pollInterval: (hasJoinedMeeting) ? 10000 : 0
  });

  const { data: chatStatsData, loading: chatStatsLoading, error: chatStatsError } = useQuery(GET_CHAT_STATS, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !authComplete || !hasJoinedMeeting,
    errorPolicy: 'all',
    pollInterval: (hasJoinedMeeting) ? 30000 : 0
  });

  // GraphQL Mutations
  const [startMeeting] = useMutation(START_MEETING);
  const [endMeeting] = useMutation(END_MEETING);
  const [joinMeeting] = useMutation(JOIN_MEETING);
  const [leaveMeeting] = useMutation(LEAVE_MEETING);
  const [updateSession] = useMutation(UPDATE_SESSION);
  const [forceMute] = useMutation(FORCE_MUTE);
  const [forceCameraOff] = useMutation(FORCE_CAMERA_OFF);
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT);
  const [approveParticipant] = useMutation(APPROVE_PARTICIPANT);
  const [rejectParticipant] = useMutation(REJECT_PARTICIPANT);
  const [raiseHand] = useMutation(RAISE_HAND);
  const [lowerHand] = useMutation(LOWER_HAND);
  const [hostLowerHand] = useMutation(HOST_LOWER_HAND);
  const [lowerAllHands] = useMutation(LOWER_ALL_HANDS);
  const [deleteChatMessage] = useMutation(DELETE_CHAT_MESSAGE);

  // Real-time Subscriptions
  useSubscription(MEETING_UPDATED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }: { data: any }) => {
      console.log('Meeting updated:', data);
    }
  });

  useSubscription(PARTICIPANT_JOINED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }: { data: any }) => {
      console.log('Participant joined:', data);
    }
  });

  useSubscription(PARTICIPANT_LEFT, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }: { data: any }) => {
      console.log('Participant left:', data);
    }
  });

  useSubscription(PARTICIPANT_UPDATED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }: { data: any }) => {
      console.log('Participant updated:', data);
    }
  });

  useSubscription(CHAT_MESSAGE_ADDED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }: { data: any }) => {
      console.log('New chat message:', data);
    }
  });

  useSubscription(HAND_RAISED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }: { data: any }) => {
      console.log('Hand raised:', data);
      if (data?.data?.handRaised?.participantId) {
        setRaiseHands(prev => [...prev, data.data.handRaised.participantId]);
      }
    }
  });

  useSubscription(HAND_LOWERED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    onData: ({ data }: { data: any }) => {
      console.log('Hand lowered:', data);
      if (data?.data?.handLowered?.participantId) {
        setRaiseHands(prev => prev.filter(id => id !== data.data.handLowered.participantId));
      }
    }
  });

  // Extract data from queries
  const meeting = (meetingData as any)?.getMeetingById as Meeting;
  const participants = (participantsData as any)?.getParticipantsByMeeting as Participant[] || [];
  const waitingParticipants = (waitingData as any)?.getWaitingParticipants as WaitingParticipant[] || [];
  
  // Safe chat messages extraction with additional safety checks
  const rawChatData = (chatData as any)?.getChatHistory;
  const chatMessages = (() => {
    try {
      if (rawChatData && Array.isArray(rawChatData.messages)) {
        return rawChatData.messages as ChatMessage[];
      }
      return [];
    } catch (error) {
      console.error('Error processing chat messages:', error);
      return [];
    }
  })();
  
  // Debug logging for chat data
  useEffect(() => {
    if (chatData) {
      console.log('🔍 CHAT DEBUG - Full chatData:', chatData);
      console.log('🔍 CHAT DEBUG - getChatHistory:', rawChatData);
      console.log('🔍 CHAT DEBUG - messages array:', rawChatData?.messages);
      console.log('🔍 CHAT DEBUG - isArray?', Array.isArray(rawChatData?.messages));
      console.log('🔍 CHAT DEBUG - final chatMessages:', chatMessages);
    }
  }, [chatData, rawChatData, chatMessages]);
  
  const raisedHandsList = (raisedHandsData as any)?.getRaisedHands?.raisedHands || [];
  const participantStats = (participantStatsData as any)?.getParticipantStats as ParticipantStats;
  const chatStats = (chatStatsData as any)?.getChatStats as ChatStats;

  // Update raised hands state from subscription data
  useEffect(() => {
    if (raisedHandsList.length > 0) {
      const participantIds = raisedHandsList.map((hand: any) => hand.participantId);
      setRaiseHands(participantIds);
    }
  }, [raisedHandsList]);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔐 AUTH CHECK: Starting authentication check...');
      const authStatus = isAuthenticated();
      console.log('🔐 AUTH CHECK: Current auth status:', authStatus);
      setIsAuth(authStatus);
      
      if (authStatus) {
        try {
          const user = await getCurrentUser();
          console.log('🔐 AUTH CHECK: Current user:', user);
          if (user?.systemRole) {
            setCurrentUserRole(user.systemRole);
            setActualUserId(user._id);
            setActualUserEmail(user.email || '');
            setAuthComplete(true);
            console.log('🔐 AUTH CHECK: User system role:', user.systemRole);
          }
        } catch (error) {
          console.error('🔐 AUTH CHECK: Error getting user role:', error);
        }
      }
      
      if (!authStatus) {
        console.log('🔐 AUTH CHECK: User not authenticated, attempting auto-login...');
        setIsAuthenticating(true);
        try {
          const loginSuccess = await forceLogin();
          console.log('🔐 AUTH CHECK: forceLogin result:', loginSuccess);
          
          if (loginSuccess) {
            console.log('🔐 AUTH CHECK: Login successful, updating auth state');
            setIsAuth(true);
            setAuthError(null);
            
            try {
              const user = await getCurrentUser();
              console.log('🔐 AUTH CHECK: Current user after login:', user);
              if (user?.systemRole) {
                setCurrentUserRole(user.systemRole);
                setActualUserId(user._id);
                setActualUserEmail(user.email || '');
                setAuthComplete(true);
                console.log('🔐 AUTH CHECK: User system role after login:', user.systemRole);
              }
            } catch (error) {
              console.error('🔐 AUTH CHECK: Error getting user role after login:', error);
            }
          } else {
            console.log('🔐 AUTH CHECK: Login failed, setting error');
            setAuthError('Authentication failed. Please log in manually.');
          }
        } catch (error: any) {
          console.error('🔐 AUTH CHECK: Auto-login failed with error:', error);
          setAuthError(`Authentication failed: ${error.message || 'Unknown error'}`);
        } finally {
          setIsAuthenticating(false);
        }
      } else {
        console.log('🔐 AUTH CHECK: User already authenticated');
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    if (!meetingId && typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const id = pathParts[pathParts.length - 1];
      if (id && id !== 'livestream') {
        setActualMeetingId(id);
      } else {
        setActualMeetingId('68cb9c9cd2d6ea30031d018a');
      }
    } else if (meetingId) {
      setActualMeetingId(meetingId);
    } else {
      setActualMeetingId('68cb9c9cd2d6ea30031d018a');
    }
  }, [meetingId]);

  // Join meeting when auth is complete
  useEffect(() => {
    const joinMeetingWhenReady = async () => {
      if (!authComplete || !isAuth || hasJoinedMeeting || isJoiningMeeting || !actualMeetingId) {
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

        console.log('🚀 JOIN MEETING: Attempting to join...', joinMeetingInput);
        
        const result: any = await joinMeeting({
          variables: { input: joinMeetingInput }
        });

        console.log('🚀 JOIN MEETING: Join result:', result);
        
        if (result.data?.joinMeeting?._id) {
          console.log('🚀 JOIN MEETING: Successfully joined meeting!', {
            participantId: result.data.joinMeeting._id,
            meetingId: actualMeetingId,
            role: isTutor ? 'HOST' : 'PARTICIPANT'
          });
          
          setCurrentParticipantId(result.data.joinMeeting._id);
          setHasJoinedMeeting(true);
          setAuthError(null);
          
          // Auto-start meeting for tutors
          if (isTutor) {
            console.log('🚀 AUTO-START: Starting meeting automatically...');
            try {
              const startResult = await startMeeting({
                variables: { meetingId: actualMeetingId }
              });
              console.log('🚀 AUTO-START: Meeting started successfully:', startResult);
              setMeetingStatus('ACTIVE');
              setIsRecording(true);
            } catch (startError: any) {
              console.error('🚀 AUTO-START: Failed to start meeting:', startError);
            }
          }
        } else {
          throw new Error('No participant ID received from join meeting response');
        }
      } catch (error: any) {
        console.error('🚀 JOIN MEETING: Failed to join meeting:', error);
        setAuthError(`Failed to join meeting: ${error.message || 'Unknown error'}`);
      } finally {
        setIsJoiningMeeting(false);
      }
    };
    
    joinMeetingWhenReady();
  }, [authComplete, isAuth, hasJoinedMeeting, isJoiningMeeting, actualMeetingId, currentUserRole, joinMeeting, startMeeting]);

  // Start meeting function for hosts
  const handleStartMeeting = async () => {
    if (currentUserRole !== 'TUTOR' && currentUserRole !== 'ADMIN') {
      console.log('🚀 START MEETING: Only tutors and admins can start meetings');
      setAuthError('Only tutors and admins can start meetings');
      return;
    }
    
    try {
      console.log('🚀 START MEETING: Starting meeting...', actualMeetingId);
      const result = await startMeeting({
        variables: { meetingId: actualMeetingId }
      });
      
      console.log('🚀 START MEETING: Meeting started successfully:', result);
      setMeetingStatus('ACTIVE');
      setIsRecording(true);
      setAuthError(null);
    } catch (error: any) {
      console.error('🚀 START MEETING: Failed to start meeting:', error);
      setAuthError(`Failed to start meeting: ${error.message || 'Unknown error'}`);
    }
  };

  // Update loading state
  const isLoading = isAuthenticating || isJoiningMeeting || !authComplete;
  
  // Only check for errors on queries that are actually running
  // Ignore chat errors that are not critical (like "incoming is not iterable")
  const isChatErrorCritical = chatError && !chatError.message?.includes('incoming is not iterable');
  const hasError = meetingError || authError || 
    (hasJoinedMeeting && (participantsError || waitingError || isChatErrorCritical || raisedHandsError || statsError || chatStatsError));

  // Debug logging
  useEffect(() => {
    console.log('🔍 DEBUG: Component state:', {
      isLoading,
      hasError,
      authComplete,
      hasJoinedMeeting,
      meetingId: actualMeetingId,
      meeting: meeting ? 'exists' : 'null',
      meetingError: meetingError?.message,
      authError,
      participantsError: participantsError?.message,
      waitingError: waitingError?.message,
      chatError: chatError?.message
    });
  }, [isLoading, hasError, authComplete, hasJoinedMeeting, actualMeetingId, meeting, meetingError, authError, participantsError, waitingError, chatError]);

  useEffect(() => {
    if (!isLoading && actualMeetingId) {
      setLoading(false);
    }
  }, [isLoading, actualMeetingId]);

  if (loading || isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            width: '50px',
            height: '50px',
            border: '3px solid #333',
            borderTop: '3px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}
        ></div>
        <p>Loading Live Stream Room...</p>
      </div>
    );
  }

  // Show authentication error
  if (authError) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '600px', padding: '20px' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>
            {meetingStatus === 'WAITING' ? 'Waiting for Meeting to Start' : 'Authentication Required'}
          </h2>
          <p style={{ marginBottom: '20px' }}>
            {meetingStatus === 'WAITING' 
              ? 'The meeting host needs to start the meeting before participants can join.'
              : authError
            }
          </p>
          <div style={{ 
            backgroundColor: '#2a2a2a', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'left'
          }}>
            <p style={{ margin: '0 0 10px 0', color: '#fbbf24' }}>Debug Information:</p>
            <p style={{ margin: '0 0 5px 0' }}>• Auth Status: {isAuth ? 'Authenticated' : 'Not Authenticated'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Auth Complete: {authComplete ? 'Yes' : 'No'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Is Authenticating: {isAuthenticating ? 'Yes' : 'No'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Meeting ID: {actualMeetingId}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Has Joined Meeting: {hasJoinedMeeting ? 'Yes' : 'No'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Is Joining Meeting: {isJoiningMeeting ? 'Yes' : 'No'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Participant ID: {currentParticipantId || 'Not joined yet'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• User ID: {userId}</p>
            <p style={{ margin: '0 0 5px 0' }}>• System Role: {currentUserRole}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Meeting Role: {role}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Meeting Status: {meetingStatus}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                console.log('🔐 MANUAL LOGIN: Attempting manual login...');
                setIsAuthenticating(true);
                setAuthError(null);
                try {
                  const success = await forceLogin();
                  console.log('🔐 MANUAL LOGIN: Result:', success);
                  if (success) {
                    setIsAuth(true);
                    setAuthError(null);
                  } else {
                    setAuthError('Login failed. Please check if the backend is running and credentials are correct.');
                  }
                } catch (error: any) {
                  console.error('🔐 MANUAL LOGIN: Error:', error);
                  setAuthError(`Login failed: ${error.message || 'Unknown error'}`);
                } finally {
                  setIsAuthenticating(false);
                }
              }}
              disabled={isAuthenticating}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isAuthenticating ? 'not-allowed' : 'pointer',
                opacity: isAuthenticating ? 0.6 : 1
              }}
            >
              {isAuthenticating ? 'Logging in...' : 'Try Login Again'}
            </button>
            <button
              onClick={() => {
                console.log('🔐 REFRESH: Refreshing page...');
                window.location.reload();
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Refresh Page
            </button>
            {(currentUserRole === 'TUTOR' || currentUserRole === 'ADMIN') && (
              <button
                onClick={handleStartMeeting}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Start Meeting
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Error Loading Meeting</h2>
          <p style={{ marginBottom: '20px' }}>
            {meetingError?.message || participantsError?.message || waitingError?.message || chatError?.message || authError || 'An error occurred while loading the meeting data.'}
          </p>
          <div style={{ 
            backgroundColor: '#2a2a2a', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'left'
          }}>
            <p style={{ margin: '0 0 10px 0', color: '#fbbf24' }}>Debug Information:</p>
            <p style={{ margin: '0 0 5px 0' }}>• Meeting Error: {meetingError?.message || 'None'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Auth Error: {authError || 'None'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Participants Error: {participantsError?.message || 'None'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Waiting Error: {waitingError?.message || 'None'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Chat Error: {chatError?.message || 'None'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Has Joined Meeting: {hasJoinedMeeting ? 'Yes' : 'No'}</p>
            <p style={{ margin: '0 0 5px 0' }}>• Meeting Data: {meeting ? 'Loaded' : 'Not loaded'}</p>
          </div>
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
          color: 'white',
          flexDirection: 'column'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#f59e0b', marginBottom: '20px' }}>Meeting Not Found</h2>
          <p style={{ marginBottom: '20px' }}>
            The meeting with ID "{actualMeetingId}" could not be found.
          </p>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f5f5f5',
      color: '#2c3e50',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 20px',
          backgroundColor: '#2a2a2a',
          borderBottom: '1px solid #444'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              {meeting?.title || 'Live Stream Meeting'}
            </h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#ccc' }}>
              Meeting ID: {meeting?.inviteCode || 'N/A'} • {participants.length} participants
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {currentUserRole === 'TUTOR' || currentUserRole === 'ADMIN' ? (
              <>
                <button
                  onClick={handleStartMeeting}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: meetingStatus === 'ACTIVE' ? '#ef4444' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {meetingStatus === 'ACTIVE' ? 'End Meeting' : 'Start Meeting'}
                </button>
                {isRecording && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 12px',
                    backgroundColor: '#ef4444',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      animation: 'pulse 1.5s infinite'
                    }}></div>
                    Recording
                  </div>
                )}
              </>
            ) : (
              <div style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                Participant
              </div>
            )}
          </div>
        </div>

        {/* Main Video Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
          position: 'relative'
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#111',
            color: '#666',
            fontSize: '16px'
          }}>
            {mainVideoParticipant ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '200px',
                  height: '150px',
                  backgroundColor: '#333',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px'
                }}>
                  Video Feed
                </div>
                <p>{mainVideoParticipant}</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '200px',
                  height: '150px',
                  backgroundColor: '#333',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px'
                }}>
                  No Video
                </div>
                <p>Waiting for video to start...</p>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          backgroundColor: '#2a2a2a',
          gap: '15px'
        }}>
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isMicOn ? '#ef4444' : '#6c757d',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            {isMicOn ? '🎤' : '🔇'}
          </button>
          
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isVideoOn ? '#ef4444' : '#6c757d',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            {isVideoOn ? '📹' : '📷'}
          </button>
          
          <button
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: isScreenSharing ? '#059669' : '#6c757d',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            📺
          </button>
          
          <button
            onClick={() => setRaiseHands(prev => [...prev, currentParticipantId || 'current'])}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: raiseHands.includes(currentParticipantId || '') ? '#f59e0b' : '#6c757d',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}
          >
            ✋
          </button>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        width: '350px',
        backgroundColor: '#2a2a2a',
        borderLeft: '1px solid #444',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Panel Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #444'
        }}>
          <button
            onClick={() => setRightPanelTab('students')}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: rightPanelTab === 'students' ? '#007bff' : 'transparent',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Students ({participants.length})
          </button>
          <button
            onClick={() => setRightPanelTab('chat')}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: rightPanelTab === 'chat' ? '#007bff' : 'transparent',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Chat ({Array.isArray(chatMessages) ? chatMessages.length : 0})
          </button>
        </div>

        {/* Panel Content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {rightPanelTab === 'students' ? (
            <div style={{ padding: '15px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Participants</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {participants.map((participant) => (
                  <div
                    key={participant._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px',
                      backgroundColor: '#333',
                      borderRadius: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#007bff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {participant.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>
                          {participant.displayName}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#ccc' }}>
                          {participant.role}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {participant.micState === 'ON' ? '🎤' : '🔇'}
                      {participant.cameraState === 'ON' ? '📹' : '📷'}
                      {raiseHands.includes(participant._id) && '✋'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Chat</h3>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {(() => {
                  try {
                    if (!Array.isArray(chatMessages)) {
                      console.warn('Chat messages is not an array:', chatMessages);
                      return <div style={{ color: '#ff6b6b', fontSize: '14px' }}>No chat messages available</div>;
                    }
                    if (chatMessages.length === 0) {
                      return <div style={{ color: '#888', fontSize: '14px' }}>No messages yet</div>;
                    }
                    return chatMessages.map((message) => (
                    <div key={message._id} style={{
                      padding: '8px 12px',
                      backgroundColor: '#333',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}>
                      <p style={{ margin: '0 0 5px 0', fontWeight: '500' }}>
                        {message.displayName || 'Unknown User'}
                      </p>
                      <p style={{ margin: 0, color: '#ccc' }}>
                        {message.text || 'No message content'}
                      </p>
                    </div>
                    ));
                  } catch (error) {
                    console.error('Error rendering chat messages:', error);
                    return <div style={{ color: '#ff6b6b', fontSize: '14px' }}>Error loading messages</div>;
                  }
                })()}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    backgroundColor: '#333',
                    color: 'white',
                    border: '1px solid #555',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
                <button
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalLiveStreamRoom;