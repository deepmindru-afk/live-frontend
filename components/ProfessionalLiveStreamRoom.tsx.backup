import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { isAuthenticated, getCurrentUser } from '../lib/simple-auth-handlers';
import { useWebSocketChat } from '../hooks/useWebSocketChat';
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
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  
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

  // WebSocket connection for real-time features
  const { socket, isConnected: wsConnected } = useWebSocketChat({
    meetingId: actualMeetingId,
    token: currentUser?.token || '',
    onMessage: (message) => {
      console.log('📨 Chat message received:', message);
    },
    onParticipantJoined: (participant) => {
      console.log('👋 Participant joined:', participant);
    },
    onParticipantLeft: (participant) => {
      console.log('👋 Participant left:', participant);
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
    }
  });

  // Hand raise event listeners
  useEffect(() => {
    if (!socket) return;

    const handleHandRaised = (data: any) => {
      console.log('✋ Hand raised by:', data);
      // Update participants list to show raised hand
      setParticipants(prev => prev.map(p => 
        p._id === data.participantId 
          ? { ...p, hasHandRaised: true, handRaisedAt: data.raisedAt }
          : p
      ));
    };

    const handleHandLowered = (data: any) => {
      console.log('✋ Hand lowered by:', data);
      // Update participants list to hide raised hand
      setParticipants(prev => prev.map(p => 
        p._id === data.participantId 
          ? { ...p, hasHandRaised: false, handLoweredAt: data.loweredAt }
          : p
      ));
    };

    const handleHandRaiseSuccess = (data: any) => {
      console.log('✅ Hand raise success:', data);
      if (data.success) {
        setHandRaised(data.hasHandRaised || false);
      }
    };

    const handleHandRaiseError = (data: any) => {
      console.error('❌ Hand raise error:', data);
      // Only show error for actual errors, not for "already raised" which is handled by toggle
      if (data.message && !data.message.includes('already raised')) {
        Swal.fire('Error', data.message || 'Failed to raise hand', 'error');
      } else {
        // If hand is already raised, just toggle the state
        setHandRaised(false);
        console.log('🔄 Hand was already raised, toggling to lowered');
      }
    };

    // Add event listeners
    socket.on('HAND_RAISED', handleHandRaised);
    socket.on('HAND_LOWERED', handleHandLowered);
    socket.on('HAND_RAISE_SUCCESS', handleHandRaiseSuccess);
    socket.on('HAND_RAISE_ERROR', handleHandRaiseError);
    socket.on('HAND_LOWER_SUCCESS', handleHandRaiseSuccess);
    socket.on('HAND_LOWER_ERROR', handleHandRaiseError);

    return () => {
      socket.off('HAND_RAISED', handleHandRaised);
      socket.off('HAND_LOWERED', handleHandLowered);
      socket.off('HAND_RAISE_SUCCESS', handleHandRaiseSuccess);
      socket.off('HAND_RAISE_ERROR', handleHandRaiseError);
      socket.off('HAND_LOWER_SUCCESS', handleHandRaiseSuccess);
      socket.off('HAND_LOWER_ERROR', handleHandRaiseError);
    };
  }, [socket]);

  // Authentication and initialization
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = isAuthenticated();
        setIsAuth(authStatus);
        
        if (authStatus) {
          const user = await getCurrentUser();
          console.log('🔍 USER AUTH DEBUG:', { user, userId: user?._id || user?.id });
          if (user && typeof user === 'object') {
            setCurrentUser(user);
            setActualUserId(user._id || user.id || '');
            console.log('✅ User ID set:', user._id || user.id);
          } else {
            console.error('❌ No user data found');
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
              // Update hand raise state from participant data
              setHandRaised(participant.hasHandRaised || false);
              console.log('✋ Hand raise state updated from participant data:', participant.hasHandRaised);
              return participant;
            }
            return prevParticipant;
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
      console.log('🔍 HAND RAISE DEBUGGING:', {
        meetingId: actualMeetingId,
        actualUserId,
        participantsCount: participants.length,
        participants: participants.map(p => ({
          _id: p._id,
          userId: p.user?._id,
          displayName: p.displayName,
          hasHandRaised: p.hasHandRaised
        })),
        currentParticipant: currentParticipant ? {
          _id: currentParticipant._id,
          userId: currentParticipant.user?._id,
          displayName: currentParticipant.displayName,
          hasHandRaised: currentParticipant.hasHandRaised
        } : null
      });

      // Check if we have participants data
      if (!participants || participants.length === 0) {
        console.error('❌ No participants data available');
        console.log('🔍 Participants loading state:', { participantsLoading, participantsError });
        await Swal.fire('Error', 'Unable to raise hand: No participants found. Please wait for the meeting to load and try again.', 'error');
        return;
      }

      // Check if we have a valid user ID
      if (!actualUserId) {
        console.error('❌ No user ID available');
        console.log('🔍 User auth state:', { isAuth, authComplete, currentUser });
        await Swal.fire('Error', 'Unable to raise hand: User not authenticated. Please refresh the page and try again.', 'error');
        return;
      }

      // Find the participant that belongs to the current user
      let participantId = null;
      let userParticipant = null;

      // Strategy 1: Use currentParticipant if it belongs to the current user
      if (currentParticipant && currentParticipant.user?._id === actualUserId) {
        participantId = currentParticipant._id;
        userParticipant = currentParticipant;
        console.log('✅ Using currentParticipant:', participantId);
      } else {
        // Strategy 2: Find participant by user ID in participants list (exact match)
        userParticipant = participants.find(p => p.user?._id === actualUserId);
        if (userParticipant) {
          participantId = userParticipant._id;
          console.log('✅ Found participant in participants list (exact match):', participantId);
        } else {
          // Strategy 3: Try string comparison
          userParticipant = participants.find(p => p.user?._id?.toString() === actualUserId?.toString());
          if (userParticipant) {
            participantId = userParticipant._id;
            console.log('✅ Found participant with string comparison:', participantId);
          } else {
            // Strategy 4: Try to find by user ID field (in case of different structure)
            userParticipant = participants.find(p => p.userId === actualUserId);
            if (userParticipant) {
              participantId = userParticipant._id;
              console.log('✅ Found participant by userId field:', participantId);
            }
          }
        }
      }

      if (!participantId || !userParticipant) {
        console.error('❌ No participant found for current user:', {
          actualUserId,
          participants: participants.map(p => ({
            _id: p._id,
            userId: p.user?._id,
            displayName: p.displayName,
            isCurrentUser: p.user?._id === actualUserId
          })),
          currentParticipant: currentParticipant ? {
            _id: currentParticipant._id,
            userId: currentParticipant.user?._id,
            displayName: currentParticipant.displayName
          } : null
        });
        
        // Check if user needs to join the meeting first
        if (participants.length > 0 && !currentParticipant) {
          await Swal.fire('Error', 'Unable to raise hand: You are not a participant in this meeting. Please join the meeting first.', 'error');
        } else {
          await Swal.fire('Error', 'Unable to raise hand: Could not find your participant record. Please refresh the page and try again.', 'error');
        }
        return;
      }

      console.log('✅ Using participant:', {
        participantId,
        displayName: userParticipant.displayName,
        userId: userParticipant.user?._id,
        currentHandState: userParticipant.hasHandRaised
      });

      // Check the actual hand state from the participant data
      const isHandCurrentlyRaised = userParticipant.hasHandRaised || handRaised;
      console.log('🔍 Current hand state:', { 
        fromParticipant: userParticipant.hasHandRaised, 
        fromState: handRaised, 
        finalState: isHandCurrentlyRaised 
      });

      // Execute the hand raise/lower action via WebSocket
      if (!isHandCurrentlyRaised) {
        // Use WebSocket for hand raise
        if (socket) {
          socket.emit('RAISE_HAND', {
            meetingId: actualMeetingId,
            participantId: participantId,
            reason: 'Raised hand in meeting'
          });
          console.log('✅ Hand raise request sent via WebSocket');
        } else {
          // Fallback to GraphQL if WebSocket not available
          await raiseHand({
            variables: {
              input: {
                participantId: participantId,
                reason: 'Raised hand in meeting'
              }
            }
          });
          console.log('✅ Hand raised via GraphQL fallback');
        }
        setHandRaised(true);
        console.log('✅ Hand raised successfully!');
      } else {
        // Use WebSocket for hand lower
        if (socket) {
          socket.emit('LOWER_HAND', {
            meetingId: actualMeetingId,
            participantId: participantId,
            reason: 'Lowered hand in meeting'
          });
          console.log('✅ Hand lower request sent via WebSocket');
        } else {
          // Fallback to GraphQL if WebSocket not available
          await lowerHand({
            variables: {
              input: {
                participantId: participantId
              }
            }
          });
          console.log('✅ Hand lowered via GraphQL fallback');
        }
        setHandRaised(false);
        console.log('✅ Hand lowered successfully!');
      }
    } catch (error) {
      console.error('❌ Error toggling hand raise:', error);
      
      // Handle "already raised" error by toggling state
      if ((error as Error).message && (error as Error).message.includes('already raised')) {
        console.log('🔄 Hand was already raised, toggling to lowered');
        setHandRaised(false);
        return;
      }
      
      // Only show error for actual errors
      const errorMessage = (error as Error).message || 'Failed to toggle hand raise. Please try again.';
      await Swal.fire('Error', errorMessage, 'error');
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

  const handleStartMeeting = async () => {
    try {
      await startMeeting({
        variables: {
          input: {
            meetingId: actualMeetingId
          }
        }
      });
      setMeetingStatus('LIVE');
    } catch (error) {
      console.error('❌ Error starting meeting:', error);
    }
  };

  const handleEndMeeting = async () => {
    try {
      await endMeeting({
        variables: {
          input: {
            meetingId: actualMeetingId
          }
        }
      });
      setMeetingStatus('ENDED');
    } catch (error) {
      console.error('❌ Error ending meeting:', error);
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
        {/* Debug Component - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <ChatDebug
            meetingId={actualMeetingId}
            token={localStorage.getItem('jwt') || ''}
          />
        )}
        
        {/* 🔧 CSS ANIMATION FOR REFRESH SPINNER */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @media (max-width: 768px) {
            .mobile-hidden {
              display: none !important;
            }
            
            .mobile-full {
              width: 100% !important;
              margin-right: 0 !important;
            }
            
            .mobile-stack {
              flex-direction: column !important;
            }
            
            .mobile-small {
              font-size: 12px !important;
              padding: 4px 8px !important;
            }
            
            .mobile-center {
              justify-content: center !important;
            }
          }
          
          @media (max-width: 480px) {
            .mobile-tiny {
              font-size: 10px !important;
              padding: 2px 4px !important;
            }
          }
        `}</style>
        
        <div style={{
          display: 'flex',
          height: '100vh',
          backgroundColor: '#f8f9fa',
          color: '#1a1a1a',
          fontFamily: 'Arial, sans-serif',
          position: 'relative',
          overflow: 'hidden'
        }}>
      {/* Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '80px',
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 1000,
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Logo and Meeting Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#1a1a1a',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            N
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a' }}>
              {meeting?.title || 'Demo Meeting'}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              ID: {meeting?.inviteCode || 'DEMO123'}
            </div>
          </div>
        </div>

        {/* Status and Control Buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Status Button */}
          <button style={{
            backgroundColor: meetingStatus === 'LIVE' ? '#dc3545' : '#6c757d',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: 'white',
              borderRadius: '50%'
            }}></div>
            {meetingStatus === 'LIVE' ? 'Live' : meetingStatus === 'PAUSED' ? 'Paused' : 'Stopped'}
          </button>
          
          {/* Start/Stop/Pause Button */}
          {isHost && (
            <button
              onClick={() => {
                if (meetingStatus === 'CREATED' || meetingStatus === 'PAUSED') {
                  handleStartMeeting();
                } else if (meetingStatus === 'LIVE') {
                  handleEndMeeting();
                }
              }}
              style={{
                backgroundColor: meetingStatus === 'LIVE' ? '#dc3545' : 
                               meetingStatus === 'PAUSED' ? '#ffc107' : '#28a745',
                color: meetingStatus === 'PAUSED' ? '#000' : 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {meetingStatus === 'LIVE' ? 'Stop' : 
               meetingStatus === 'PAUSED' ? 'Resume' : 'Start'}
            </button>
          )}
          
          {/* Participants & Waiting Room Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            👥 Participants & Waiting Room
          </button>
          
          {/* Close Sidebar Button */}
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                backgroundColor: 'transparent',
                color: '#666',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Participant Thumbnails Row */}
      <div style={{
        position: 'fixed',
        top: '80px',
        left: '20px',
        right: sidebarOpen ? '370px' : '20px',
        height: '100px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        overflowX: 'auto',
        padding: '10px 0',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e0e0e0',
        zIndex: 999
      }}>
        {participants.map((participant, index) => (
          <div
            key={participant._id}
            onClick={() => {
              // Pin this participant to main stage
              setSelectedParticipant(participant);
            }}
            style={{
              minWidth: '80px',
              height: '80px',
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              border: participant.role === 'HOST' ? '3px solid #28a745' : 
                     participant.hasHandRaised ? '3px solid #ffc107' : '3px solid #e0e0e0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {/* Host Badge */}
            {participant.role === 'HOST' && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#28a745',
                color: 'white',
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 'bold'
              }}>
                HOST
              </div>
            )}
            
            {/* Hand Raise Indicator */}
            {participant.hasHandRaised && (
              <div style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                width: '20px',
                height: '20px',
                backgroundColor: '#ffc107',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#000'
              }}>
                ✋
              </div>
            )}
            
            {/* Avatar */}
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: participant.role === 'HOST' ? '#28a745' : '#6c757d',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: 'white',
              marginBottom: '4px'
            }}>
              {participant.role === 'HOST' ? '👨‍🏫' : '👨‍🎓'}
            </div>
            
            {/* Name */}
            <div style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#333',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              {participant.role === 'HOST' ? 'Host' : 'Student'}
            </div>
            
            {/* Media Status Icons */}
            <div style={{
              position: 'absolute',
              bottom: '4px',
              display: 'flex',
              gap: '2px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: participant.micState === 'ON' ? '#28a745' : '#dc3545'
              }} title={`Mic ${participant.micState === 'ON' ? 'On' : 'Off'}`}></div>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: participant.cameraState === 'ON' ? '#28a745' : '#dc3545'
              }} title={`Camera ${participant.cameraState === 'ON' ? 'On' : 'Off'}`}></div>
            </div>
          </div>
        ))}
        
        {/* Show more indicator if there are more participants */}
        {participants.length > 5 && (
          <div style={{
            minWidth: '60px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '12px'
          }}>
            +{participants.length - 5}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className={`mobile-full ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} style={{
        flex: 1,
        marginTop: '180px', // Increased to account for thumbnails row
        marginRight: sidebarOpen ? '350px' : '0',
        transition: 'margin-right 0.3s ease',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Main Stage Area */}
        <div style={{
          flex: 1,
          backgroundColor: '#f8f9fa',
          margin: '20px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          minHeight: '400px'
        }}>
          {/* Main Stage Label */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            backgroundColor: '#1a1a1a',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#28a745',
              borderRadius: '50%'
            }}></div>
            {selectedParticipant ? `${selectedParticipant.displayName || 'Selected'} Video` : 'Host Video'}
          </div>

          {/* Hand Raised Badge */}
          {raisedHandsCount > 0 && (
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: '#ffc107',
              color: '#000',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ✋ {raisedHandsCount} hand{raisedHandsCount > 1 ? 's' : ''} raised
            </div>
          )}

          {/* Main Video/Avatar Display */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            width: '100%',
            height: '100%'
          }}>
            {/* Video Container */}
            <div style={{
              width: '200px',
              height: '200px',
              backgroundColor: '#1a1a1a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '4px solid #e0e0e0'
            }}>
              {/* Avatar/Video Content */}
              <div style={{
                fontSize: '80px',
                color: '#666'
              }}>
                {selectedParticipant ? 
                  (selectedParticipant.role === 'HOST' ? '👨‍🏫' : '👨‍🎓') :
                  '👨‍🏫'
                }
              </div>
              
              {/* Video indicator */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                width: '20px',
                height: '20px',
                backgroundColor: '#28a745',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'white'
              }}>
                📹
              </div>
            </div>

            {/* Participant Info */}
            <div style={{
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#1a1a1a',
                marginBottom: '8px'
              }}>
                {selectedParticipant ? 
                  (selectedParticipant.displayName || 'Selected Participant') :
                  'Host'
                }
              </div>
              <div style={{
                fontSize: '16px',
                color: '#666',
                marginBottom: '20px'
              }}>
                {selectedParticipant ? 
                  (selectedParticipant.user?.email || selectedParticipant.email || 'participant@demo.com') :
                  'host@demo.com'
                }
              </div>
              
              {/* Media Controls */}
              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'center'
              }}>
                <button style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#dc3545',
                  border: 'none',
                  borderRadius: '50%',
                  color: 'white',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} title="Screen Share">
                  📺
                </button>
                <button style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#6c757d',
                  border: 'none',
                  borderRadius: '50%',
                  color: 'white',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }} title="Remove">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '100px',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderTop: '1px solid #e0e0e0',
          boxShadow: '0 -2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          {/* Left Side - Logo */}
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            N
          </div>

          {/* Center - Media Controls */}
          <div style={{
            display: 'flex',
            gap: '15px',
            alignItems: 'center'
          }}>
            {/* Participant Count */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#28a745',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: 'white',
                borderRadius: '50%'
              }}></div>
              {participants.length}
            </div>
            
            {/* Mic Toggle */}
            <button
              onClick={handleMicToggle}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: micEnabled ? '#28a745' : '#dc3545',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.2s ease'
              }}
            >
              {micEnabled ? '🎤' : '🔇'}
            </button>
            
            {/* Camera Toggle */}
            <button
              onClick={handleCameraToggle}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: cameraEnabled ? '#28a745' : '#dc3545',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.2s ease'
              }}
            >
              {cameraEnabled ? '📹' : '📷'}
            </button>
            
            {/* Screen Share */}
            <button
              onClick={handleScreenShareToggle}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: screenSharing ? '#28a745' : '#6c757d',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.2s ease'
              }}
            >
              📺
            </button>
            
            {/* Chat */}
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.2s ease'
              }}
            >
              💬
            </button>
            
            {/* Participants */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#6c757d',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.2s ease'
              }}
            >
              👥
            </button>
          </div>

          {/* Right Side - Leave Button */}
          <button
            onClick={handleLeaveMeeting}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#dc3545',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              transition: 'all 0.2s ease'
            }}
          >
            📞
          </button>
        </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: '180px', // Adjusted for thumbnails row
          width: '350px',
          height: 'calc(100vh - 280px)', // Adjusted for header, thumbnails, and bottom bar
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-2px 0 4px rgba(0,0,0,0.1)'
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1a1a1a', fontWeight: 'bold' }}>
              Participants & Waiting Room
            </h3>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '24px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
            >
              ×
            </button>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <button
              onClick={() => setActiveTab('participants')}
              style={{
                flex: 1,
                padding: '16px',
                border: 'none',
                backgroundColor: activeTab === 'participants' ? '#007bff' : 'transparent',
                color: activeTab === 'participants' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                borderBottom: activeTab === 'participants' ? '3px solid #007bff' : '3px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              Active Students ({participants.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                flex: 1,
                padding: '16px',
                border: 'none',
                backgroundColor: activeTab === 'chat' ? '#007bff' : 'transparent',
                color: activeTab === 'chat' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                borderBottom: activeTab === 'chat' ? '3px solid #007bff' : '3px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              Chat (3)
            </button>
          </div>

          {/* Tab Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px'
          }}>
            {activeTab === 'participants' && (
              <div>
                <h4 style={{ 
                  color: '#1a1a1a', 
                  marginBottom: '20px', 
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}>
                  Active Participants ({participants.length})
                </h4>
                
                {participants.map((participant) => (
                  <div
                    key={participant._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '12px',
                      marginBottom: '12px',
                      border: '1px solid #e0e0e0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: participant.role === 'HOST' ? '#28a745' : '#6c757d',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        color: 'white'
                      }}>
                        {participant.role === 'HOST' ? '👨‍🏫' : '👨‍🎓'}
                      </div>
                      <div>
                        <div style={{ 
                          color: '#1a1a1a', 
                          fontWeight: 'bold',
                          fontSize: '14px'
                        }}>
                          {participant.displayName || participant.user?.displayName || 'Student'}
                        </div>
                        <div style={{ 
                          color: '#666', 
                          fontSize: '12px' 
                        }}>
                          {participant.user?.email || 'student@demo.com'}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Mic Status */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: participant.micState === 'ON' ? '#dc3545' : '#28a745',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }} title={`Mic ${participant.micState === 'ON' ? 'On' : 'Off'}`}>
                        {participant.micState === 'ON' ? '🎤' : '🔇'}
                      </div>
                      
                      {/* Camera Status */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: participant.cameraState === 'ON' ? '#28a745' : '#dc3545',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }} title={`Camera ${participant.cameraState === 'ON' ? 'On' : 'Off'}`}>
                        {participant.cameraState === 'ON' ? '📹' : '📷'}
                      </div>
                      
                      {/* Remove Button */}
                      <button
                        onClick={() => handleKickParticipant(participant._id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: '#dc3545',
                          border: 'none',
                          color: 'white',
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Remove Participant"
                      >
                        🗑️
                      </button>
                      
                      {/* Hand Raise */}
                      {participant.hasHandRaised && (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: '#ffc107',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }} title="Hand Raised">
                          ✋
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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
      </>
    );
  });

ProfessionalLiveStreamRoom.displayName = 'ProfessionalLiveStreamRoom';

export default ProfessionalLiveStreamRoom;
