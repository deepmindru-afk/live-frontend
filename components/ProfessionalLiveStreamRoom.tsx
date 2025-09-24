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
          displayName: actualUserEmail || (isTutor ? 'Host' : 'Participant'),
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
          setHasJoinedMeeting(true);
          setAuthError(null);
          
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

  // Subscriptions for real-time updates
  useSubscription(PARTICIPANT_JOINED, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId
  });

  useSubscription(PARTICIPANT_LEFT, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId
  });

  // Extract data
  const meeting = (meetingData as any)?.getMeetingById;
  const participants = (participantsData as any)?.getParticipantsByMeeting || [];

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
      fontFamily: 'Arial, sans-serif'
    }}>
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
          padding: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderBottom: '1px solid #333'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>
              {meeting?.title || 'Live Meeting'}
            </h1>
            <p style={{ margin: '5px 0 0 0', color: '#ccc' }}>
              Meeting ID: {actualMeetingId}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              padding: '5px 10px',
              backgroundColor: meetingStatus === 'ACTIVE' ? '#28a745' : '#ffc107',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {meetingStatus}
            </span>
                {isRecording && (
              <span style={{
                padding: '5px 10px',
                backgroundColor: '#dc3545',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                REC
              </span>
            )}
          </div>
        </div>

        {/* Video Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
          position: 'relative'
        }}>
          {participants.length > 0 ? (
          <div style={{
              display: 'grid',
              gridTemplateColumns: participants.length === 1 ? '1fr' : 
                                 participants.length === 2 ? '1fr 1fr' : 
                                 participants.length <= 4 ? '1fr 1fr' : '1fr 1fr 1fr',
              gap: '10px',
            width: '100%',
            height: '100%',
              padding: '20px'
            }}>
              {participants.map((participant: any) => {
                // Get the real display name from the populated user data
                const realDisplayName = participant.userId?.displayName || participant.displayName || 'Anonymous';
                const realRole = participant.role === 'HOST' ? 'Host' : 'Participant';
                
                return (
                  <div key={participant._id} style={{
                    backgroundColor: '#333',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '200px',
                    border: participant.role === 'HOST' ? '2px solid #007bff' : '1px solid #555'
                  }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      backgroundColor: participant.role === 'HOST' ? '#007bff' : '#28a745',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      fontWeight: 'bold',
                      marginBottom: '10px'
                    }}>
                      {realDisplayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {realDisplayName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#ccc' }}>
                        {realRole}
                      </div>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>
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

        {/* Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderTop: '1px solid #333'
        }}>
          <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            style={{
                padding: '10px 15px',
                backgroundColor: isMicOn ? '#28a745' : '#dc3545',
              color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isMicOn ? '🎤 Mic On' : '🔇 Mic Off'}
          </button>
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            style={{
                padding: '10px 15px',
                backgroundColor: isVideoOn ? '#28a745' : '#dc3545',
              color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isVideoOn ? '📷 Camera On' : '📹 Camera Off'}
          </button>
          <button
            onClick={() => setIsScreenSharing(!isScreenSharing)}
            style={{
                padding: '10px 15px',
                backgroundColor: isScreenSharing ? '#007bff' : '#6c757d',
              color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {isScreenSharing ? '🖥️ Stop Share' : '🖥️ Share Screen'}
          </button>
            {currentUserRole === 'HOST' && (
          <button
                onClick={() => setIsRecording(!isRecording)}
            style={{
                  padding: '10px 15px',
                  backgroundColor: isRecording ? '#dc3545' : '#28a745',
              color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isRecording ? '⏹️ Stop Recording' : '⏺️ Start Recording'}
          </button>
            )}
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
              cursor: 'pointer'
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
              cursor: 'pointer'
            }}
          >
            Chat
          </button>
        </div>

        {/* Panel Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {rightPanelTab === 'students' ? (
            <div style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 15px 0' }}>Participants</h3>
              {participants.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {participants.map((participant: any) => {
                    // Get the real display name from the populated user data
                    const realDisplayName = participant.userId?.displayName || participant.displayName || 'Anonymous';
                    const realRole = participant.role === 'HOST' ? 'Host' : 'Participant';
                    
                    return (
                      <div key={participant._id} style={{
                        padding: '10px',
                        backgroundColor: '#333',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: participant.role === 'HOST' ? '#007bff' : '#28a745',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}>
                          {realDisplayName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold' }}>
                            {realDisplayName}
                          </div>
                          <div style={{ fontSize: '12px', color: '#ccc' }}>
                            {realRole}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px' }}>
                          {participant.micState === 'OFF' ? '🔇' : '🎤'} {participant.cameraState === 'OFF' ? '📹' : '📷'}
                        </div>
                      </div>
                    );
                  })}
              </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#ccc' }}>
                  <p>No participants yet</p>
                </div>
              )}
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
                  displayName: actualUserEmail || (isTutor ? 'Host' : 'Participant'),
                  role: isTutor ? 'HOST' : 'PARTICIPANT'
                };
                
                const result: any = await joinMeeting({
                  variables: { input: joinMeetingInput }
                });
                
                if (result.data?.joinMeeting?._id) {
                  setCurrentParticipantId(result.data.joinMeeting._id);
                  setHasJoinedMeeting(true);
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