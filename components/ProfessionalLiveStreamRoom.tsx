import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { isAuthenticated, getCurrentUser } from '../lib/simple-auth-handlers';
import Swal from 'sweetalert2';
import { GET_MEETING_BY_ID } from '../apollo/livestream/queries';
import {
  GET_PARTICIPANTS_BY_MEETING,
  GET_WAITING_PARTICIPANTS,
  START_MEETING,
  END_MEETING,
  JOIN_MEETING,
  LEAVE_MEETING,
  APPROVE_PARTICIPANT,
  REJECT_PARTICIPANT,
  RAISE_HAND,
  LOWER_HAND,
  TRANSFER_HOST,
  REMOVE_PARTICIPANT,
} from '../apollo/livestream/mutations';
import ParticipantView from './ParticipantView';
import ChatView from './ChatView';
import WebSocketChatView from './WebSocketChatView';
import ChatDebug from './ChatDebug';

// Additional mutations for leave functionality
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
      micState
      cameraState
      user {
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

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = memo(({
  meetingId: propMeetingId,
  role = 'HOST',
  userId = 'p1'
}) => {
  // State management
  const [actualMeetingId, setActualMeetingId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'participants' | 'waiting' | 'chat'>('participants');
  const [isRecording, setIsRecording] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHandsCount, setRaisedHandsCount] = useState(0);
  const [isAuth, setIsAuth] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [actualUserId, setActualUserId] = useState<string>('');
  const [currentParticipant, setCurrentParticipant] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
  const [meetingStatus, setMeetingStatus] = useState<string>('CREATED');
  
  // 🔧 ANTI-FLICKERING: Reduced debounce for faster updates
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const DEBOUNCE_DELAY = 300; // 🔧 FIX: Reduced from 1s to 300ms for faster updates

  // GraphQL Queries - 🔧 OPTIMIZED: Fast polling for real-time updates
  const { data: meetingData, loading: meetingLoading, error: meetingError, refetch: refetchMeeting } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 2000, // 🔧 FIX: Faster 2-second refresh for meeting data
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'ignore'
  });

  const { data: participantsData, loading: participantsLoading, error: participantsError } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 1500, // 🔧 FIX: Fast 1.5-second refresh for participants
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  const { data: waitingData, loading: waitingLoading, error: waitingError } = useQuery(GET_WAITING_PARTICIPANTS, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 2000, // 🔧 FIX: 2-second refresh for waiting participants
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  const { data: currentParticipantData, loading: currentParticipantLoading, error: currentParticipantError } = useQuery(GET_PARTICIPANT_BY_USER_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 1000, // 🔧 FIX: Very fast 1-second refresh for current participant
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  // GraphQL Mutations
  const [startMeeting] = useMutation(START_MEETING);
  const [endMeeting] = useMutation(END_MEETING);
  const [joinMeeting] = useMutation(JOIN_MEETING);
  const [leaveMeeting] = useMutation(LEAVE_MEETING);
  const [forceLeaveMeeting] = useMutation(FORCE_LEAVE_MEETING);
  const [approveParticipant] = useMutation(APPROVE_PARTICIPANT);
  const [rejectParticipant] = useMutation(REJECT_PARTICIPANT);
  const [raiseHand] = useMutation(RAISE_HAND);
  const [lowerHand] = useMutation(LOWER_HAND);
  const [transferHost] = useMutation(TRANSFER_HOST);
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT);

  // Authentication and initialization
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = isAuthenticated();
        setIsAuth(authStatus);
        
        if (authStatus) {
          const user = await getCurrentUser();
          if (user && typeof user === 'object') {
            setCurrentUser(user);
            setActualUserId(user._id || user.id || '');
          }
        }
        
        setAuthComplete(true);
    } catch (error) {
        console.error('❌ AUTH: Error checking authentication:', error);
        setIsAuth(false);
        setAuthComplete(true);
      }
    };

    checkAuth();
  }, []);

  // Meeting ID initialization
  useEffect(() => {
    if (propMeetingId) {
      setActualMeetingId(propMeetingId);
      setLoading(false);
    } else {
      // Try to get from URL or other sources
      const urlParams = new URLSearchParams(window.location.search);
      const urlMeetingId = urlParams.get('meetingId');
      if (urlMeetingId) {
        setActualMeetingId(urlMeetingId);
        setLoading(false);
      }
    }
  }, [propMeetingId]);

  // Update meeting status
  useEffect(() => {
    if (meetingData) {
      const meeting = (meetingData as any)?.getMeetingById;
      if (meeting) {
        console.log('🔄 MEETING STATUS UPDATE:', {
          previousStatus: meetingStatus,
          newStatus: meeting.status,
          meetingId: meeting._id,
          timestamp: new Date().toISOString()
        });
        
        setMeetingStatus(meeting.status);
        setIsLive(meeting.status === 'LIVE' || meeting.status === 'ACTIVE');
        setIsRecording(meeting.isRecording || false);
        
        // 🔧 NEW: Redirect to dashboard when meeting ends
        if (meeting.status === 'ENDED') {
          console.log('🔄 MEETING ENDED: Redirecting to dashboard...');
          Swal.fire({
            title: 'Meeting Ended',
            text: 'The meeting has been ended by the host. You will be redirected to the dashboard.',
            icon: 'info',
            confirmButtonText: 'Go to Dashboard',
            allowOutsideClick: false,
            allowEscapeKey: false
          }).then(() => {
            console.log('🔄 REDIRECTING TO DASHBOARD...');
            window.location.href = '/dashboard';
          });
        }
      }
    }
  }, [meetingData, meetingStatus]);

  // Update participants - 🔧 OPTIMIZED: Fast refresh with smart debouncing
  useEffect(() => {
    if (participantsData && !participantsError) {
      try {
        const participantsList = (participantsData as any)?.getParticipantsByMeeting || [];
        const now = Date.now();
        
        // 🔧 DEBUG: Log participant data for debugging
        console.log('🔍 PARTICIPANTS UPDATE:', {
          totalParticipants: participantsList.length,
          participants: participantsList.map((p: any) => ({
            _id: p._id,
            displayName: p.displayName,
            status: p.status,
            role: p.role
          }))
        });
        
        // 🔧 OPTIMIZED: Only debounce if data hasn't changed significantly
        const hasSignificantChange = participantsList.length !== participants.length ||
          participantsList.some((p: any, index: number) => 
            !participants[index] || 
            p.status !== participants[index].status ||
            p.role !== participants[index].role
          );
        
        if (!hasSignificantChange && now - lastUpdateTime < DEBOUNCE_DELAY) {
          return;
        }
        
        // 🔧 OPTIMIZED: Update immediately for significant changes
        setParticipants(prevParticipants => {
          const hasChanged = JSON.stringify(prevParticipants) !== JSON.stringify(participantsList);
          if (hasChanged) {
            setLastUpdateTime(now);
            setIsRefreshing(true);
            // Hide refresh indicator after 300ms for faster feedback
            setTimeout(() => setIsRefreshing(false), 300);
            console.log('🔄 PARTICIPANTS UPDATED:', participantsList.length, 'participants');
            return participantsList;
          }
          return prevParticipants;
        });
        
        // Count raised hands
        const raisedHands = participantsList.filter((p: any) => p.hasHandRaised);
        setRaisedHandsCount(prevCount => {
          return prevCount !== raisedHands.length ? raisedHands.length : prevCount;
        });
      } catch (error) {
        console.warn('⚠️ Error processing participants data:', error);
        // Keep existing participants to prevent UI refresh
      }
    }
  }, [participantsData, participantsError, lastUpdateTime, DEBOUNCE_DELAY, participants.length]);

  // Update waiting participants - 🔧 OPTIMIZED: 3-second refresh with debouncing
  useEffect(() => {
    if (waitingData && !waitingError) {
      try {
        const waitingList = (waitingData as any)?.getWaitingParticipants || [];
        const now = Date.now();
        
        // 🔧 ANTI-FLICKERING: Debounce rapid updates
        if (now - lastUpdateTime < DEBOUNCE_DELAY) {
          return;
        }
        
        // 🔧 OPTIMIZED: Only update if data actually changed to prevent flickering
        setWaitingParticipants(prevWaiting => {
          const hasChanged = JSON.stringify(prevWaiting) !== JSON.stringify(waitingList);
          if (hasChanged) {
            setLastUpdateTime(now);
            return waitingList;
          }
          return prevWaiting;
        });
      } catch (error) {
        console.warn('⚠️ Error processing waiting participants data:', error);
        // Keep existing waiting participants
      }
    }
  }, [waitingData, waitingError, lastUpdateTime, DEBOUNCE_DELAY]);

  // Update current participant - 🔧 OPTIMIZED: 3-second refresh with debouncing
  useEffect(() => {
    if (currentParticipantData && !currentParticipantError) {
      try {
        const participant = (currentParticipantData as any)?.getParticipantByUserAndMeeting;
        if (participant) {
          const now = Date.now();
          
          // 🔧 ANTI-FLICKERING: Debounce rapid updates
          if (now - lastUpdateTime < DEBOUNCE_DELAY) {
            return;
          }
          
          // 🔧 OPTIMIZED: Only update if data actually changed to prevent flickering
          setCurrentParticipant((prevParticipant: any) => {
            const hasChanged = JSON.stringify(prevParticipant) !== JSON.stringify(participant);
            if (hasChanged) {
              setLastUpdateTime(now);
              return participant;
            }
            return prevParticipant;
          });
          
          setHandRaised(prevHandRaised => {
            const newHandRaised = participant.hasHandRaised || false;
            return prevHandRaised !== newHandRaised ? newHandRaised : prevHandRaised;
          });
        }
      } catch (error) {
        console.warn('⚠️ Error processing current participant data:', error);
        // Keep existing participant data
      }
    }
  }, [currentParticipantData, currentParticipantError, lastUpdateTime, DEBOUNCE_DELAY]);

  // 🔧 FIX: Handle GraphQL errors gracefully
  useEffect(() => {
    if (currentParticipantError) {
      console.warn('⚠️ CURRENT_PARTICIPANT_ERROR:', currentParticipantError);
      // Don't break the UI, just log the error
      // Reset current participant to prevent UI issues
      setCurrentParticipant(null);
    }
  }, [currentParticipantError]);

  useEffect(() => {
    if (participantsError) {
      console.warn('⚠️ PARTICIPANTS_ERROR:', participantsError);
      // Don't break the UI, just log the error
      // Keep existing participants to prevent UI refresh
    }
  }, [participantsError]);

  useEffect(() => {
    if (waitingError) {
      console.warn('⚠️ WAITING_ERROR:', waitingError);
      // Don't break the UI, just log the error
      // Keep existing waiting participants
    }
  }, [waitingError]);

  useEffect(() => {
    if (meetingError) {
      console.warn('⚠️ MEETING_ERROR:', meetingError);
      // Don't break the UI, just log the error
    }
  }, [meetingError]);

  // 🔧 FIX: Removed excessive fallback polling that was causing flickering
  // The main polling intervals are now sufficient and less aggressive

  // Auto-join meeting when authenticated
  useEffect(() => {
    const autoJoinMeeting = async () => {
      if (!isAuth || !authComplete || !actualMeetingId || !currentUser) return;
      
      // 🔧 NEW: Don't auto-join if meeting is ended
      if (meetingStatus === 'ENDED') {
        console.log('🚫 AUTO-JOIN: Meeting is ended, skipping auto-join');
        return;
      }
      
      try {
        console.log('🔄 AUTO-JOIN: Attempting to join meeting...');
        await joinMeeting({
          variables: {
            input: {
              meetingId: actualMeetingId,
              displayName: currentUser.displayName || currentUser.email || 'User',
              role: role
            }
          }
        });
        console.log('✅ AUTO-JOIN: Successfully joined meeting');
      } catch (error) {
        console.error('❌ AUTO-JOIN: Error joining meeting:', error);
      }
    };

    autoJoinMeeting();
  }, [isAuth, authComplete, actualMeetingId, currentUser, role, joinMeeting, meetingStatus]);

  // Auto-start meeting if host
  useEffect(() => {
    const autoStartMeeting = async () => {
      if (!isAuth || !authComplete || !actualMeetingId || meetingStatus !== 'CREATED') return;
      if (role !== 'HOST' && currentParticipant?.role !== 'HOST') return;
      
      try {
        console.log('🔄 AUTO-START: Starting meeting...');
        await startMeeting({
          variables: {
            meetingId: actualMeetingId
          }
        });
        console.log('✅ AUTO-START: Meeting started successfully');
        setMeetingStatus('LIVE');
        setIsLive(true);
      } catch (error) {
        console.error('❌ AUTO-START: Error starting meeting:', error);
      }
    };

    // Auto-start after a short delay
    const timer = setTimeout(autoStartMeeting, 2000);
    return () => clearTimeout(timer);
  }, [isAuth, authComplete, actualMeetingId, meetingStatus, role, currentParticipant, startMeeting]);

  // Helper functions - 🔧 FIX: Memoized callbacks to prevent unnecessary re-renders
  const handleStartRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      // Add recording start logic here
      console.log('🎥 Recording started');
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setIsRecording(false);
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      // Add recording stop logic here
      console.log('🎥 Recording stopped');
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  }, []);

  const handleMicToggle = useCallback(() => {
    setMicEnabled(prev => !prev);
    // Add mic toggle logic here
  }, []);

  const handleCameraToggle = useCallback(() => {
    setCameraEnabled(prev => !prev);
    // Add camera toggle logic here
  }, []);

  const handleScreenShareToggle = useCallback(() => {
    setScreenSharing(prev => !prev);
    // Add screen share logic here
  }, []);

  const handleRaiseHand = async () => {
    try {
      if (!handRaised) {
        await raiseHand({
          variables: {
            input: {
              meetingId: actualMeetingId
      }
    }
  });
        setHandRaised(true);
      } else {
        await lowerHand({
          variables: {
            input: {
            meetingId: actualMeetingId
          }
          }
        });
        setHandRaised(false);
      }
    } catch (error) {
      console.error('❌ Error toggling hand raise:', error);
    }
  };

  const handleApproveParticipant = async (participantId: string) => {
    try {
      await approveParticipant({
        variables: {
          input: {
            participantId: participantId
          }
        }
      });
    } catch (error) {
      console.error('❌ Error approving participant:', error);
    }
  };

  const handleRejectParticipant = async (participantId: string) => {
    try {
      await rejectParticipant({
        variables: {
          input: {
            participantId: participantId
          }
        }
      });
    } catch (error) {
      console.error('❌ Error rejecting participant:', error);
    }
  };

  const handleKickParticipant = async (participantId: string) => {
    const result = await Swal.fire({
      title: 'Kick Participant',
      text: 'Are you sure you want to remove this participant from the meeting?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Kick',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      try {
        await removeParticipant({
          variables: {
            participantId: participantId
          }
        });
        await Swal.fire('Participant Removed', 'The participant has been removed from the meeting.', 'success');
      } catch (error) {
        console.error('❌ Error kicking participant:', error);
        await Swal.fire('Error', 'Failed to remove participant. Please try again.', 'error');
      }
    }
  };

  const handleLeaveMeeting = async () => {
    const isHost = currentParticipant?.role === 'HOST';
    
    if (isHost) {
      const { value: exitOption } = await Swal.fire({
        title: 'Exit Meeting',
        text: 'You are the host. Choose how you want to exit:',
        input: 'select',
        inputOptions: {
          'force': 'Force Exit - End meeting for all participants',
          'transfer': 'Transfer Host Role - Give host role to another member'
        },
        showCancelButton: true,
        confirmButtonText: 'Continue',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
          if (!value) {
            return 'You need to select an exit option!';
          }
          return null;
        }
      });

      if (exitOption === 'force') {
        try {
          console.log('🔄 FORCE EXIT: Attempting to end meeting...');
          await forceLeaveMeeting({
            variables: {
              meetingId: actualMeetingId
            }
          });
          
          console.log('✅ FORCE EXIT: Meeting ended successfully');
          await Swal.fire('Meeting Ended', 'The meeting has been ended for all participants.', 'success');
          
          // Redirect to dashboard after successful force leave
          window.location.href = '/dashboard';
        } catch (error) {
          console.error('❌ FORCE EXIT: Error force leaving meeting:', error);
          
          // Show detailed error message with retry option
          const errorMessage = (error as Error).message || 'Unknown error occurred';
          await Swal.fire({
            title: 'Force Leave Failed',
            html: `Failed to end meeting.<br><br><strong>Error:</strong> ${errorMessage}<br><br>Please try again or contact support if the issue persists.`,
            icon: 'error',
            confirmButtonText: 'Try Again',
            showCancelButton: true,
            cancelButtonText: 'Cancel'
          }).then((result) => {
            if (result.isConfirmed) {
              // Retry force leave
              handleLeaveMeeting();
            }
          });
        }
      } else if (exitOption === 'transfer') {
        // Show transfer dialog - 🔧 FIX: Filter only active participants
        console.log('🔍 TRANSFER HOST: All participants:', participants.map(p => ({
          _id: p._id,
          displayName: p.displayName,
          role: p.role,
          status: p.status,
          hasUser: !!p.user
        })));
        
        const eligibleParticipants = participants.filter(p => {
          // Basic checks
          if (p.role === 'HOST' || !p.user) {
            console.log('❌ Excluding participant - role:', p.role, 'hasUser:', !!p.user);
            return false;
          }
          
          // If status field exists, use it for filtering
          if (p.status) {
            const isEligible = p.status !== 'LEFT' && (p.status === 'ADMITTED' || p.status === 'APPROVED');
            console.log(`🔍 Participant ${p.displayName}: status=${p.status}, eligible=${isEligible}`);
            return isEligible;
          }
          
          // 🔧 FALLBACK: If no status field, assume participant is eligible
          // This handles cases where the status field might not be populated
          console.warn('⚠️ Participant missing status field, assuming eligible:', p);
          return true;
        });
        
        console.log('🔍 TRANSFER HOST: Eligible participants:', eligibleParticipants.map(p => ({
          _id: p._id,
          displayName: p.displayName,
          role: p.role,
          status: p.status
        })));
        
        if (eligibleParticipants.length === 0) {
          await Swal.fire({
            title: 'No Participants',
            text: 'There are no other participants to transfer host role to. The meeting will be ended.',
            icon: 'info',
            confirmButtonText: 'End Meeting',
            showCancelButton: true,
            cancelButtonText: 'Cancel'
          }).then(async (result) => {
            if (result.isConfirmed) {
              try {
                console.log('🔄 FORCE EXIT (no participants): Attempting to end meeting...');
                await forceLeaveMeeting({
                  variables: {
                    meetingId: actualMeetingId
                  }
                });
                
                console.log('✅ FORCE EXIT (no participants): Meeting ended successfully');
                await Swal.fire('Meeting Ended', 'The meeting has been ended.', 'success');
                window.location.href = '/dashboard';
              } catch (error) {
                console.error('❌ FORCE EXIT (no participants): Error force leaving meeting:', error);
                await Swal.fire('Force Leave Failed', 'Failed to end meeting. Please try again.', 'error');
              }
            }
          });
          return;
        }

        const { value: selectedParticipantId } = await Swal.fire({
          title: 'Transfer Host Role',
          text: 'Select a participant to become the new host:',
          input: 'select',
          inputOptions: eligibleParticipants.reduce((options, p) => {
            options[p._id] = p.displayName || p.user?.displayName || p.user?.email || 'Unknown';
            return options;
          }, {} as Record<string, string>),
          showCancelButton: true,
          confirmButtonText: 'Transfer',
          cancelButtonText: 'Cancel',
          inputValidator: (value) => {
            if (!value) {
              return 'You need to select a participant!';
            }
            return null;
          }
        });

        if (selectedParticipantId) {
          try {
            console.log('🔄 TRANSFER HOST: Attempting to transfer host role...');
            await transferHost({
              variables: {
                input: {
                  meetingId: actualMeetingId,
                  newHostParticipantId: selectedParticipantId,
                  reason: 'Host transferring role and leaving'
                }
              }
            });

            console.log('✅ TRANSFER HOST: Host role transferred successfully');

            // 🔧 FIX: After host transfer, don't try to leave immediately
            // The host transfer already handles the role change
            // Just redirect to dashboard after a short delay
            await Swal.fire({
              title: 'Host Role Transferred',
              text: 'You have successfully transferred the host role. You will be redirected to the dashboard.',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
            
            // Redirect to dashboard after successful transfer
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 2000);
        } catch (error) {
          console.error('❌ TRANSFER HOST: Error transferring host:', error);
          
          // Show detailed error message with fallback option
          const errorMessage = (error as Error).message || 'Unknown error occurred';
            await Swal.fire({
              title: 'Transfer Failed',
              html: `Failed to transfer host role.<br><br><strong>Error:</strong> ${errorMessage}<br><br>Would you like to try force exit instead?`,
              icon: 'error',
              confirmButtonText: 'Force Exit',
              showCancelButton: true,
              cancelButtonText: 'Cancel'
            }).then(async (result) => {
              if (result.isConfirmed) {
                // Try force exit as fallback
                try {
                  console.log('🔄 FALLBACK FORCE EXIT: Attempting force exit...');
                  await forceLeaveMeeting({
                    variables: {
                      meetingId: actualMeetingId
                    }
                  });
                  
                  console.log('✅ FALLBACK FORCE EXIT: Meeting ended successfully');
                  await Swal.fire('Meeting Ended', 'The meeting has been ended for all participants.', 'success');
                  window.location.href = '/dashboard';
                } catch (forceError) {
                  console.error('❌ FALLBACK FORCE EXIT: Error force leaving meeting:', forceError);
                  await Swal.fire('Force Exit Failed', 'Both transfer and force exit failed. Please contact support.', 'error');
                }
              }
            });
          }
        }
              }
            } else {
      const result = await Swal.fire({
        title: 'Leave Meeting',
        text: 'Are you sure you want to leave this meeting?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, Leave',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
        try {
          // Fallback participant ID if currentParticipant is null
          const participantId = currentParticipant?._id || participants.find(p => p.user?._id === actualUserId)?._id;
          
          if (!participantId) {
            await Swal.fire('Error', 'Unable to identify participant. Please refresh and try again.', 'error');
              return;
            }
          
          await leaveMeeting({
            variables: {
              input: {
                participantId: participantId
              }
            }
          });
          
          await Swal.fire('Left Meeting', 'You have successfully left the meeting.', 'success');
          
          // Redirect to dashboard after successful leave
          window.location.href = '/dashboard';
        } catch (error) {
          console.error('❌ Error leaving meeting:', error);
          await Swal.fire('Leave Failed', 'Failed to leave meeting. Please try again.', 'error');
        }
      }
    }
  };

  if (loading || meetingLoading) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  const meeting = (meetingData as any)?.getMeetingById;
  
  // 🔧 NEW: Show ended meeting message
  if (meetingStatus === 'ENDED') {
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
        <div style={{ fontSize: '60px', marginBottom: '20px' }}>📹</div>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>Meeting Ended</div>
        <div style={{ fontSize: '16px', marginBottom: '20px' }}>This meeting has been ended by the host.</div>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }
  
  const isHost = currentParticipant?.role === 'HOST';

    return (
      <>
        {/* 🔧 CSS ANIMATION FOR REFRESH SPINNER */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        
        <div style={{
          display: 'flex',
          height: '100vh',
          backgroundColor: '#1a1a1a',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      position: 'relative'
      }}>
      {/* Header */}
          <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '80px',
        backgroundColor: '#2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 1000,
        borderBottom: '1px solid #333'
      }}>
        {/* Logo and Meeting Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>
            Let's go together HRDe
        </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              {meeting?.title || 'Demo Meeting'}
      </div>
            <div style={{ fontSize: '12px', color: '#ccc' }}>
              ID: {meeting?.inviteCode || 'DEMO123'}
            </div>
          </div>
        </div>

        {/* Live and Recording Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* 🔧 REFRESH INDICATOR */}
          {isRefreshing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              color: '#28a745',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                border: '2px solid #28a745',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Refreshing...
            </div>
          )}
          
          {isLive && (
            <button style={{
              backgroundColor: '#dc3545',
          color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              • Live
            </button>
          )}
          
          {isHost && (
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              style={{
                backgroundColor: isRecording ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
            borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer'
          }}
        >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
          )}
      </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        marginTop: '80px',
        marginRight: sidebarOpen ? '350px' : '0',
        transition: 'margin-right 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
      }}>
        {/* Teaching Content Area */}
    <div style={{
          flex: 1,
          backgroundColor: '#f5f5f5',
          margin: '20px',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
      position: 'relative'
    }}>
          {/* Screen Sharing Badge */}
          {screenSharing && (
        <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              backgroundColor: '#dc3545',
              color: 'white',
              padding: '4px 12px',
          borderRadius: '4px',
              fontSize: '12px'
            }}>
              • Screen Sharing
        </div>
          )}

          {/* Hand Raised Badge */}
          {raisedHandsCount > 0 && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: '#ffc107',
              color: '#000',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {raisedHandsCount} hand{raisedHandsCount > 1 ? 's' : ''} raised
      </div>
      )}

          {/* Teaching Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
      }}>
        <div style={{
          display: 'flex',
              gap: '10px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#4CAF50',
                borderRadius: '2px'
              }}></div>
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#dc3545',
                borderRadius: '2px'
              }}></div>
              <div style={{
                width: '20px',
                height: '20px',
                backgroundColor: '#2196F3',
                borderRadius: '2px'
              }}></div>
          </div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              Teaching Content
          </div>
                  <div style={{
            fontSize: '14px',
              color: '#666',
              textAlign: 'center'
            }}>
              Screen sharing, presentations, or whiteboard
                  </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div style={{
          height: '100px',
          backgroundColor: '#2a2a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderTop: '1px solid #333'
        }}>
          {/* Participant Thumbnails */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center'
          }}>
            {participants.slice(0, 3).map((participant, index) => (
              <div
                key={participant._id}
                style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: '#444',
                  borderRadius: '8px',
                  border: index === 0 ? '2px solid #2196F3' : '2px solid #666',
                  display: 'flex',
                    flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                {index === 0 && (
                      <div style={{
                    position: 'absolute',
                    bottom: '-5px',
                    left: '-5px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    fontSize: '8px',
                    padding: '2px 4px',
                    borderRadius: '2px'
                  }}>
                    HOST
                </div>
                    )}
                    <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#666',
                  borderRadius: '50%',
                  marginBottom: '4px'
                }}></div>
                <div style={{
                  fontSize: '8px',
                      textAlign: 'center'
                    }}>
                  {participant.role === 'HOST' ? 'Host' : 'Student'}
                      </div>
                {participant.hasHandRaised && (
                <div style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#ffc107',
                    borderRadius: '50%'
                  }}></div>
                )}
              </div>
            ))}
        </div>

          {/* Media Controls */}
        <div style={{
          display: 'flex',
            gap: '15px',
            alignItems: 'center'
          }}>
          <button
              onClick={handleMicToggle}
            style={{
                width: '40px',
                height: '40px',
              borderRadius: '50%',
              border: 'none',
                backgroundColor: micEnabled ? '#28a745' : '#dc3545',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'center'
            }}
          >
              🎤
          </button>
          <button
              onClick={handleCameraToggle}
            style={{
                width: '40px',
                height: '40px',
              borderRadius: '50%',
              border: 'none',
                backgroundColor: cameraEnabled ? '#28a745' : '#dc3545',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'center'
            }}
          >
              📹
          </button>
          <button
              onClick={handleScreenShareToggle}
            style={{
                width: '40px',
                height: '40px',
              borderRadius: '50%',
              border: 'none',
                backgroundColor: screenSharing ? '#28a745' : '#666',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'center'
            }}
          >
              📺
          </button>
          <button
              onClick={handleLeaveMeeting}
            style={{
                width: '50px',
                height: '50px',
              borderRadius: '50%',
              border: 'none',
                backgroundColor: '#dc3545',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
                fontSize: '18px'
            }}
          >
              📞
          </button>
          </div>

          {/* Participants Info and Panel Toggle */}
          <div style={{
                  display: 'flex',
                  alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{ fontSize: '14px' }}>
              Participants {raisedHandsCount > 0 && (
                <span style={{
                  backgroundColor: '#ffc107',
                  color: '#000',
                  padding: '2px 6px',
                      borderRadius: '4px',
                  marginLeft: '8px'
                }}>
                  {raisedHandsCount} raised
                </span>
              )}
                </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {sidebarOpen ? 'Close Panel' : 'Open Panel'}
          </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
      <div style={{
          position: 'fixed',
          right: 0,
          top: '80px',
          width: '350px',
          height: 'calc(100vh - 80px)',
        backgroundColor: '#2a2a2a',
        borderLeft: '1px solid #333',
        display: 'flex',
        flexDirection: 'column'
      }}>
          {/* Sidebar Header */}
        <div style={{
            padding: '20px',
            borderBottom: '1px solid #333',
          display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Participants & Waiting Room</h3>
          <button
              onClick={() => setSidebarOpen(false)}
            style={{
                background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
                fontSize: '18px'
            }}
          >
              ×
          </button>
        </div>

          {/* Tab Navigation */}
                      <div style={{
                        display: 'flex',
            borderBottom: '1px solid #333'
          }}>
          <button
              onClick={() => setActiveTab('participants')}
                  style={{
                flex: 1,
                padding: '12px',
              border: 'none',
                backgroundColor: activeTab === 'participants' ? '#007bff' : 'transparent',
                    color: 'white',
                    cursor: 'pointer',
                fontSize: '14px'
                  }}
                >
              Active Students ({participants.length})
                </button>
            <button
              onClick={() => setActiveTab('waiting')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: activeTab === 'waiting' ? '#007bff' : 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Waiting ({waitingParticipants.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: activeTab === 'chat' ? '#007bff' : 'transparent',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Chat (0)
            </button>
        </div>

          {/* Tab Content */}
        <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px'
          }}>
            {activeTab === 'participants' && (
              <ParticipantView
                participants={participants}
                waitingParticipants={waitingParticipants}
                onApproveParticipant={handleApproveParticipant}
                onRejectParticipant={handleRejectParticipant}
                onKickParticipant={handleKickParticipant}
                isHost={isHost}
              />
            )}

            {activeTab === 'waiting' && (
              <div>
                {waitingParticipants.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    color: '#ccc',
                    padding: '20px'
                  }}>
                    No participants waiting
                  </div>
                ) : (
                  <div>
                    <h4 style={{ color: '#fff', marginBottom: '15px' }}>
                      Waiting for Approval ({waitingParticipants.length})
                    </h4>
                    {waitingParticipants.map((participant) => (
                      <div
                        key={participant._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px',
                          backgroundColor: '#333',
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }}
                      >
                        <div>
                          <div style={{ color: '#fff', fontWeight: 'bold' }}>
                            {participant.displayName}
                          </div>
                          <div style={{ color: '#ccc', fontSize: '12px' }}>
                            {participant.user?.email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleApproveParticipant(participant._id)}
                            style={{
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectParticipant(participant._id)}
                            style={{
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chat' && (
              <WebSocketChatView
                meetingId={actualMeetingId}
                currentUser={currentUser}
                isHost={isHost}
                token={localStorage.getItem('jwt') || ''}
              />
            )}
              </div>
            </div>
          )}
        </div>
        {/* Debug Component - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <ChatDebug
            meetingId={actualMeetingId}
            token={localStorage.getItem('jwt') || ''}
          />
        )}
      </>
    );
  });

ProfessionalLiveStreamRoom.displayName = 'ProfessionalLiveStreamRoom';

export default ProfessionalLiveStreamRoom;
