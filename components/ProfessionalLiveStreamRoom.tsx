import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { isAuthenticated, getCurrentUser } from '../lib/simple-auth-handlers';
import { useWebSocketChat } from '../hooks/useWebSocketChat';
import { useHandRaise } from '../hooks/useHandRaise';
import { useWebSocketHandRaise } from '../hooks/useWebSocketHandRaise';
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
import MinimalistChat from './MinimalistChat';
import PictureInPicture from './PictureInPicture';
import { usePictureInPicture } from '../hooks/usePictureInPicture';
import ParticipantQueue from './ParticipantQueue';
import { useParticipantQueue, Participant } from '../hooks/useParticipantQueue';
import { useAudioLevelDetection } from '../hooks/useAudioLevelDetection';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('speaker');
  const [gridSize, setGridSize] = useState<'2x2' | '3x3' | '4x4'>('2x2');
  const [isMobile, setIsMobile] = useState(false);
  const [handRaiseQueue, setHandRaiseQueue] = useState<any[]>([]);
  const [currentHandRaiseMessage, setCurrentHandRaiseMessage] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [actualUserId, setActualUserId] = useState<string>('');
  const [currentParticipant, setCurrentParticipant] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
  const [meetingStatus, setMeetingStatus] = useState<string>('CREATED');

  // Participant Queue System
  const {
    queueState,
    addParticipant: addToQueue,
    removeParticipant: removeFromQueue,
    updateSpeakingStatus,
    updateHandRaiseStatus,
    startScreenShare: startQueueScreenShare,
    stopScreenShare: stopQueueScreenShare,
    updateParticipant: updateQueueParticipant,
    getMainStageParticipants,
    getThumbnailParticipants,
    analyzeAudioLevel,
    updateParticipantAudioLevel
  } = useParticipantQueue(participants.map(p => ({
    _id: p._id,
    displayName: p.displayName,
    email: p.email || '',
    isMuted: p.micState === 'OFF',
    isCameraOff: p.cameraState === 'OFF',
    joinedAt: p.joinedAt || new Date().toISOString(),
    isHost: p.role === 'HOST',
    role: p.role,
    hasHandRaised: p.hasHandRaised || false,
    handRaisedAt: p.handRaisedAt,
    isSpeaking: false,
    audioLevel: 0,
    lastActivity: new Date().toISOString()
  })));

  // Audio Level Detection
  const { detectSpeakingStatus, isSupported: audioSupported } = useAudioLevelDetection({
    threshold: 0.01,
    smoothingFactor: 0.8,
    updateInterval: 100
  });
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [thumbnailPanelOpen, setThumbnailPanelOpen] = useState(true);
  
  // Debug: Track recording state changes
  useEffect(() => {
    console.log('🎥 ============ RECORDING STATE CHANGED ============');
    console.log('🎥 isRecording:', isRecording);
    console.log('🎥 recordingPaused:', recordingPaused);
    console.log('🎥 Current user role:', currentParticipant?.role);
    console.log('🎥 Is host?:', isHost);
    console.log('🎥 ============================================');
  }, [isRecording, recordingPaused]);
  
  // GraphQL Queries
  const { data: meetingData, loading: meetingLoading, error: meetingError, refetch: refetchMeeting } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 2000,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all'
  });

  const { data: participantsData, loading: participantsLoading, error: participantsError, refetch: refetchParticipants } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 1500,
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  const { data: waitingData, loading: waitingLoading, error: waitingError } = useQuery(GET_WAITING_PARTICIPANTS, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 2000,
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: false
  });

  const { data: currentParticipantData, loading: currentParticipantLoading, error: currentParticipantError, refetch: refetchCurrentParticipant } = useQuery(GET_PARTICIPANT_BY_USER_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 1000,
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
  const webSocketToken = currentUser?.token || localStorage.getItem('jwt') || localStorage.getItem('token') || '';
  console.log('🔌 WebSocket token debug:', {
    currentUserToken: currentUser?.token ? 'present' : 'missing',
    jwtToken: localStorage.getItem('jwt') ? 'present' : 'missing',
    tokenToken: localStorage.getItem('token') ? 'present' : 'missing',
    finalToken: webSocketToken ? 'present' : 'missing',
    tokenLength: webSocketToken?.length || 0,
    tokenPreview: webSocketToken ? webSocketToken.substring(0, 20) + '...' : 'none'
  });
  
  const { socket, isConnected: wsConnected } = useWebSocketChat({
    meetingId: actualMeetingId,
    token: webSocketToken,
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
      console.error('🔌 WebSocket error:', error);
    },
    // Hand raise events are handled through participants data changes
  });

  // Note: Meeting room joining is now handled automatically by the new presence system
  // when the WebSocket connects via JOIN_MEETING and HEARTBEAT events

  // Debug WebSocket connection
  useEffect(() => {
    console.log('🔌 WebSocket Debug:', {
      socket: !!socket,
      isConnected: wsConnected,
      token: currentUser?.token ? 'present' : 'missing',
      tokenLength: currentUser?.token?.length || 0,
      currentUser: currentUser ? 'present' : 'missing',
      meetingId: actualMeetingId,
      actualMeetingIdType: typeof actualMeetingId
    });
  }, [socket, wsConnected, currentUser, actualMeetingId]);

  // WebSocket-based hand raise functionality (real-time, no DB)
  const { 
    raisedHands: wsRaisedHands, 
    myHandRaised: wsMyHandRaised, 
    raiseHand: wsRaiseHand, 
    lowerHand: wsLowerHand 
  } = useWebSocketHandRaise({
    meetingId: actualMeetingId || '',
    userId: currentParticipant?._id || '',
    displayName: currentParticipant?.displayName || '',
    socket: socket || undefined,
    isConnected: wsConnected,
    onHandRaised: (info) => {
      console.log('✋ Hand raised:', info);
      setHandRaiseQueue(prev => {
        // Remove any existing entry for this user
        const filtered = prev.filter((hand: any) => hand.participantId !== info.userId);
        // Add to the beginning (most recent first - DESC order)
        return [{
          participantId: info.userId,
          displayName: info.displayName,
          raisedAt: info.raisedAt
        }, ...filtered];
      });
      
      // Show notification for host
      if (isHost) {
        setCurrentHandRaiseMessage(`${info.displayName} raised their hand`);
        setTimeout(() => setCurrentHandRaiseMessage(null), 3000);
      }
    },
    onHandLowered: (info) => {
      console.log('✋ Hand lowered:', info);
      setHandRaiseQueue(prev => prev.filter((hand: any) => hand.participantId !== info.userId));
      
      // Clear current message if this was the last hand
      if (isHost && handRaiseQueue.length <= 1) {
        setCurrentHandRaiseMessage(null);
      }
    },
    onHandAutoLowered: (info) => {
      console.log('✋ Hand auto-lowered:', info);
      setHandRaiseQueue(prev => prev.filter((hand: any) => hand.participantId !== info.userId));
      
      // Show notification for auto-lower
      if (info.userId === currentParticipant?._id) {
        Swal.fire({
          icon: 'info',
          title: 'Hand Auto-Lowered',
          text: 'Your hand was automatically lowered after 1 minute',
          timer: 3000,
          showConfirmButton: false
        });
      }
      
      // Clear current message if this was the last hand
      if (isHost && handRaiseQueue.length <= 1) {
        setCurrentHandRaiseMessage(null);
      }
    },
    onError: (error) => {
      console.error('✋ Hand raise error:', error);
      // No alert - just log the error
    }
  });

  // WebSocket event listener for recording announcements
  useEffect(() => {
    console.log('🎧 ============ SETTING UP LISTENERS ============');
    console.log('🎧 Socket exists?:', !!socket);
    console.log('🎧 WebSocket connected?:', wsConnected);
    console.log('🎧 Meeting ID:', actualMeetingId);
    console.log('🎧 Current participant:', currentParticipant);
    console.log('🎧 Current user:', currentUser);
    console.log('🎧 Is Host?:', isHost);
    
    if (socket && wsConnected) {
      console.log('🎧 ✅ Socket is ready! Registering listeners...');
      
      const handleRecordingAnnouncement = (data: { message: string; type: string }) => {
        console.log('🎯 ============ RAW EVENT RECEIVED ============');
        console.log('🔊 ============ RECEIVED ANNOUNCEMENT ============');
        console.log('🔊 Data received:', data);
        console.log('🔊 Message:', data.message);
        console.log('🔊 Type:', data.type);
        console.log('🔊 Current user:', currentUser?.displayName || currentUser?.email || 'Unknown');
        console.log('🔊 Participant role:', currentParticipant?.role || 'Unknown');
        console.log('🔊 Meeting ID:', actualMeetingId);
        console.log('🔊 Is Host?:', isHost);
        
        // Update recording state for participants
        if (!isHost) {
          console.log('🔊 👥 I am a PARTICIPANT - updating recording state...');
          if (data.type === 'start') {
            console.log('🔊 Setting isRecording = true');
            setIsRecording(true);
            setRecordingPaused(false);
          } else if (data.type === 'stop') {
            console.log('🔊 Setting isRecording = false');
            setIsRecording(false);
            setRecordingPaused(false);
          } else if (data.type === 'pause') {
            console.log('🔊 Setting recordingPaused = true');
            setRecordingPaused(true);
          } else if (data.type === 'resume') {
            console.log('🔊 Setting recordingPaused = false');
            setRecordingPaused(false);
          }
        } else {
          console.log('🔊 👨‍🏫 I am the HOST - state already updated locally');
        }
        
        // Play the announcement on all participant devices
        console.log('🔊 🔉 Playing voice announcement...');
        announceRecordingStatus(data.message);
        
        // Show visual notification
        console.log('🔊 📢 Showing toast notification...');
        Swal.fire({
          icon: data.type === 'start' ? 'success' : 
                data.type === 'stop' ? 'info' : 
                data.type === 'pause' ? 'warning' : 'success',
          title: data.type === 'start' ? 'Recording Started' :
                 data.type === 'stop' ? 'Recording Stopped' :
                 data.type === 'pause' ? 'Recording Paused' : 'Recording Resumed',
          text: data.message,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        console.log('🔊 ============ ANNOUNCEMENT HANDLED ============');
      };

      const handleTestBroadcast = (data: any) => {
        console.log('🧪 ============ TEST BROADCAST RECEIVED ============');
        console.log('🧪 Data:', data);
        announceRecordingStatus('WebSocket test received! Broadcasting works!');
      };

      console.log('🎧 Registering RECORDING_ANNOUNCEMENT listener...');
      socket.on('RECORDING_ANNOUNCEMENT', handleRecordingAnnouncement);
      console.log('🎧 Registering TEST_BROADCAST listener...');
      socket.on('TEST_BROADCAST', handleTestBroadcast);
      
      console.log('🎧 ✅ All listeners registered!');

      return () => {
        console.log('🎧 Cleaning up recording announcement listeners...');
        socket.off('RECORDING_ANNOUNCEMENT', handleRecordingAnnouncement);
        socket.off('TEST_BROADCAST', handleTestBroadcast);
      };
    } else {
      console.log('🎧 ❌ Cannot register listeners!');
      console.log('🎧 Socket:', socket ? 'EXISTS' : 'NULL');
      console.log('🎧 Connected:', wsConnected);
    }
    console.log('🎧 ============ LISTENER SETUP COMPLETE ============');
  }, [socket, wsConnected]);

  // Initialize meeting ID and authentication
  useEffect(() => {
    const initializeMeeting = async () => {
      try {
        const meetingIdToUse = propMeetingId || 'DEMO123';
        setActualMeetingId(meetingIdToUse);

        const authStatus = await isAuthenticated();
        setIsAuth(authStatus);
        
        if (authStatus) {
          const user = await getCurrentUser();
          // Add token to user object for WebSocket authentication
          const token = localStorage.getItem('jwt') || localStorage.getItem('token') || '';
          console.log('🔐 Token debug:', { 
            jwt: localStorage.getItem('jwt'),
            token: localStorage.getItem('token'),
            authToken: localStorage.getItem('authToken'),
            allKeys: Object.keys(localStorage),
            tokenValue: token,
            tokenLength: token?.length || 0
          });
          
          const userWithToken = {
            ...user,
            token
          };
          console.log('🔐 User with token:', { user: userWithToken, token: token ? 'present' : 'missing' });
          setCurrentUser(userWithToken);
          setActualUserId(user?.id || userId);
          } else {
          const mockUser = {
            id: userId,
            displayName: role === 'HOST' ? 'Host User' : 'Participant User',
            email: role === 'HOST' ? 'host@demo.com' : 'participant@demo.com',
            role: role,
            token: 'mock-token'
          };
          setCurrentUser(mockUser);
          setActualUserId(userId);
        }
        
        setAuthComplete(true);
        setLoading(false);
    } catch (error) {
        console.error('Error initializing meeting:', error);
        setLoading(false);
      }
    };

    initializeMeeting();
  }, [propMeetingId, userId, role]);

  // Mobile detection and force speaker mode
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      const tablet = window.innerWidth <= 1024 && window.innerWidth > 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('speaker');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices if not already loaded
      if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
          console.log('🔊 Speech synthesis voices loaded:', speechSynthesis.getVoices().length);
        });
      }
    }
  }, []);

  // Fallback: Listen for localStorage changes (cross-tab communication)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'recording_announcement' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          console.log('🔄 Fallback: Received announcement via localStorage:', data);
          
          // Only play if this announcement is from a different tab/user
          const currentUserKey = `${currentUser?.id || currentUser?._id || 'unknown'}-${actualMeetingId}`;
          if (data.fromUser !== currentUserKey) {
            announceRecordingStatus(data.message);
            
            // Show visual notification
            Swal.fire({
              icon: 'info',
              title: 'Recording Status',
              text: data.message,
              timer: 2000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end'
            });
          }
        } catch (error) {
          console.error('🔄 Fallback: Error parsing localStorage announcement:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser, actualMeetingId]);

  // Close view controls when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (viewControlsOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-view-controls]')) {
          setViewControlsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [viewControlsOpen]);

  // Update meeting data
  useEffect(() => {
    if (meetingData && typeof meetingData === 'object' && 'getMeetingById' in meetingData && meetingData.getMeetingById) {
      const meeting = meetingData.getMeetingById as any;
      setMeetingStatus(meeting.status || 'CREATED');
      setIsLive(meeting.status === 'LIVE');
    }
  }, [meetingData]);

  // Auto-redirect when meeting ends
  useEffect(() => {
    if (meetingStatus === 'ENDED') {
      // Auto-redirect all participants to dashboard when meeting ends
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
  }, [meetingStatus]);

  // Handle GraphQL errors
  useEffect(() => {
    if (meetingError) {
      console.error('GraphQL Meeting Error:', meetingError);
      // If there's a GraphQL error, it might be because the meeting ended
      // Check if the error is related to null title field
      if (meetingError.message.includes('Cannot return null for non-nullable field MeetingWithHost.title')) {
        console.log('Meeting ended - title field is null, redirecting to dashboard');
        setMeetingStatus('ENDED');
        setIsLive(false);
        // Auto-redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
    }
  }, [meetingError]);

  // Update participants data
  useEffect(() => {
    console.log('🔍 PARTICIPANTS DATA UPDATE:', {
      participantsData,
      hasData: !!participantsData,
      dataType: typeof participantsData,
      hasGetParticipantsByMeeting: participantsData && 'getParticipantsByMeeting' in participantsData,
      getParticipantsByMeeting: participantsData?.getParticipantsByMeeting,
      participantsListLength: participantsData?.getParticipantsByMeeting?.length || 0
    });
    
    if (participantsData && typeof participantsData === 'object' && 'getParticipantsByMeeting' in participantsData && participantsData.getParticipantsByMeeting) {
      const participantsList = participantsData.getParticipantsByMeeting as any[];
      const previousParticipants = participants;
      
      console.log('🔍 SETTING PARTICIPANTS:', {
        participantsList,
        participantsListLength: participantsList.length,
        previousParticipantsLength: previousParticipants.length
      });
      
      setParticipants(participantsList);

      // Update queue with new participant data
      participantsList.forEach(participant => {
        updateQueueParticipant(participant._id, {
          _id: participant._id,
          displayName: participant.displayName,
          email: participant.email || '',
          isMuted: participant.micState === 'OFF',
          isCameraOff: participant.cameraState === 'OFF',
          joinedAt: participant.joinedAt || new Date().toISOString(),
          isHost: participant.role === 'HOST',
          role: participant.role,
          hasHandRaised: participant.hasHandRaised || false,
          handRaisedAt: participant.handRaisedAt
        });
      });

      // Check for new participants (joined)
      if (previousParticipants.length > 0) {
        const newParticipants = participantsList.filter((newP: any) => 
          !previousParticipants.find((oldP: any) => oldP._id === newP._id)
        );
        
        newParticipants.forEach((participant: any) => {
          console.log('🎉 New participant joined meeting:', participant);
          addToQueue({
            _id: participant._id,
            displayName: participant.displayName,
            email: participant.email || '',
            isMuted: participant.micState === 'OFF',
            isCameraOff: participant.cameraState === 'OFF',
            joinedAt: participant.joinedAt || new Date().toISOString(),
            isHost: participant.role === 'HOST',
            role: participant.role,
            hasHandRaised: participant.hasHandRaised || false,
            handRaisedAt: participant.handRaisedAt
          });
        });

        // Check for left participants
        const leftParticipants = previousParticipants.filter((oldP: any) => 
          !participantsList.find((newP: any) => newP._id === oldP._id)
        );
        
        leftParticipants.forEach((participant: any) => {
          console.log('👋 Participant left meeting:', participant);
          removeFromQueue(participant._id);
        });
      }
    }
  }, [participantsData, participants, addToQueue, removeFromQueue, updateQueueParticipant]);

  // Audio level detection and speaking status monitoring
  useEffect(() => {
    if (!audioSupported || queueState.participants.length === 0) return;

    const monitorAudioLevels = async () => {
      try {
        // Get participants with audio streams (mock for now)
        const participantsWithStreams = queueState.participants.map(p => ({
          _id: p._id,
          stream: undefined // In real implementation, this would be the actual MediaStream
        }));

        const speakingStatuses = await detectSpeakingStatus(participantsWithStreams);
        
        // Update speaking status for each participant
        speakingStatuses.forEach(({ _id, audioLevel, isSpeaking }) => {
          updateSpeakingStatus(_id, isSpeaking, audioLevel);
        });
      } catch (error) {
        console.warn('Audio level detection failed:', error);
      }
    };

    const interval = setInterval(monitorAudioLevels, 200); // Check every 200ms
    return () => clearInterval(interval);
  }, [audioSupported, queueState.participants, detectSpeakingStatus, updateSpeakingStatus]);

  // Update waiting participants data
  useEffect(() => {
    if (waitingData && typeof waitingData === 'object' && 'getWaitingParticipants' in waitingData && waitingData.getWaitingParticipants) {
      setWaitingParticipants(waitingData.getWaitingParticipants as any[]);
    }
  }, [waitingData]);

  // Update current participant data
  useEffect(() => {
    if (currentParticipantData && typeof currentParticipantData === 'object' && 'getParticipantByUserAndMeeting' in currentParticipantData && currentParticipantData.getParticipantByUserAndMeeting) {
      setCurrentParticipant(currentParticipantData.getParticipantByUserAndMeeting as any);
    }
  }, [currentParticipantData]);

  // Event handlers
  const handleStartMeeting = async () => {
    try {
        await startMeeting({
        variables: { meetingId: actualMeetingId }
        });
        setMeetingStatus('LIVE');
        setIsLive(true);
      Swal.fire({
        icon: 'success',
        title: 'Meeting Started',
        text: 'The meeting has been started successfully!',
        timer: 2000,
        showConfirmButton: false
      });
      } catch (error) {
      console.error('Error starting meeting:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to start the meeting. Please try again.'
      });
    }
  };

  const handleEndMeeting = async () => {
    try {
      await endMeeting({
        variables: { meetingId: actualMeetingId }
      });
      setMeetingStatus('ENDED');
      setIsLive(false);
      
      // Auto-redirect to dashboard immediately without showing success message
      // This ensures all participants are redirected automatically
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error) {
      console.error('Error ending meeting:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to end the meeting. Please try again.'
      });
    }
  };

  const handleLeaveMeeting = async () => {
    // Only show host options if user is actually a host based on participant data
    if (currentParticipant?.role === 'HOST') {
        await handleForceExit();
    } else {
      // All other users (participants) get simple leave dialog
      await handleParticipantLeave();
    }
  };

  const handleParticipantLeave = async () => {
    try {
      const result = await Swal.fire({
        title: 'Leave Meeting',
        text: 'Do you want to leave the meeting?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      });

            if (result.isConfirmed) {
        // Check if we have current participant data
        if (!currentParticipant?._id) {
          console.error('No current participant found');
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Unable to leave meeting. Please refresh and try again.'
          });
          return;
        }

      await leaveMeeting({
        variables: { 
          input: { 
              participantId: currentParticipant._id
          }
        }
      });
      
        // Auto-redirect immediately after leaving
      setTimeout(() => {
        window.location.href = '/';
        }, 500);
      }
              } catch (error) {
      console.error('Error leaving meeting:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to leave the meeting. Please try again.'
      });
    }
  };

  const handleTransferHost = async () => {
    try {
        const nonHostParticipants = participants.filter(p => p.role !== 'HOST');
      
      if (nonHostParticipants.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'No Participants',
          text: 'There are no other participants to transfer host role to.',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Create participant selection options
      const participantOptions = nonHostParticipants.map((participant, index) => ({
        value: participant._id,
        text: `${participant.displayName || participant.user?.displayName || 'Participant'} (${participant.user?.email || 'participant@demo.com'})`
      }));

      const { value: selectedParticipantId } = await Swal.fire({
          title: 'Transfer Host Role',
        text: 'Select the participant who will become the new host:',
        icon: 'question',
        input: 'select',
        inputOptions: participantOptions.reduce((acc, option) => {
          acc[option.value] = option.text;
          return acc;
        }, {} as Record<string, string>),
        inputPlaceholder: 'Choose a participant...',
          showCancelButton: true,
        confirmButtonText: 'Transfer Host',
          cancelButtonText: 'Cancel',
            confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        inputValidator: (value) => {
          if (!value) {
            return 'You need to select a participant!';
          }
          return null;
        }
      });

      if (selectedParticipantId) {
        const selectedParticipant = nonHostParticipants.find(p => p._id === selectedParticipantId);
        
        if (selectedParticipant) {
          // First transfer the host role
          await transferHost({
              variables: {
              input: {
                  meetingId: actualMeetingId,
                newHostParticipantId: selectedParticipantId,
                reason: 'Host transferring role'
              }
            }
          });

          // Refetch data to update host status
          await Promise.all([
            refetchCurrentParticipant(),
            refetchParticipants()
          ]);

          // Then leave the meeting
          await leaveMeeting({
            variables: { 
              input: { 
                participantId: currentParticipant._id
              }
              }
            });
            
            Swal.fire({
              icon: 'success',
              title: 'Host Transferred',
            text: `Host role has been transferred to ${selectedParticipant.displayName || selectedParticipant.user?.displayName || 'the selected participant'}.`,
              timer: 2000,
              showConfirmButton: false
            });
            
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          }
      }
    } catch (error) {
      console.error('Error during host transfer:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to transfer host role. Please try again.'
      });
    }
  };

  const handleForceExit = async () => {
    try {
      if (isHost && participants.length > 1) {
        // Show options for host
        const result = await Swal.fire({
          title: 'Exit Meeting',
          text: 'As the host, you can end the meeting for everyone or transfer host role:',
          icon: 'question',
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: 'End Meeting for All',
          denyButtonText: 'Transfer Host & Leave',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#dc3545',
          denyButtonColor: '#6c757d',
          cancelButtonColor: '#007bff'
        });

        if (result.isConfirmed) {
          await handleEndMeeting();
        } else if (result.isDenied) {
          await handleTransferHost();
        }
      } else if (isHost) {
        // Host with no other participants - just end meeting
        await handleEndMeeting();
      }
    } catch (error) {
      console.error('Error during force exit:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to leave the meeting. Please try again.'
      });
    }
  };

  const handleMicToggle = async () => {
    setMicEnabled(!micEnabled);
    console.log('Mic toggled:', !micEnabled);
  };

  const handleCameraToggle = async () => {
    setCameraEnabled(!cameraEnabled);
    console.log('Camera toggled:', !cameraEnabled);
  };

  const handleScreenShareToggle = async () => {
    setScreenSharing(!screenSharing);
    console.log('Screen share toggled:', !screenSharing);
  };

  // Speech synthesis function for recording announcements
  const announceRecordingStatus = (message: string) => {
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.volume = 0.8;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        
        // Try to use a female voice for better clarity
        const voices = speechSynthesis.getVoices();
        console.log('🔊 Available voices:', voices.map(v => v.name));
        
        const femaleVoice = voices.find(voice => 
          voice.name.includes('Female') || 
          voice.name.includes('Samantha') || 
          voice.name.includes('Karen') ||
          voice.name.includes('Susan') ||
          voice.name.includes('Victoria') ||
          voice.name.includes('Zira') ||
          voice.name.includes('Hazel')
        );
        
        if (femaleVoice) {
          utterance.voice = femaleVoice;
          console.log('🔊 Using female voice:', femaleVoice.name);
        } else {
          console.log('🔊 Using default voice');
        }
        
        // Add unique identifier and event listeners
        const utteranceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🔊 Creating utterance ${utteranceId}:`, message);
        
        utterance.onstart = () => {
          console.log(`🔊 Speech started [${utteranceId}]:`, message);
          setIsSpeaking(true);
        };
        utterance.onend = () => {
          console.log(`🔊 Speech ended [${utteranceId}]:`, message);
          setIsSpeaking(false);
        };
        utterance.onerror = (event) => {
          console.error(`🔊 Speech error [${utteranceId}]:`, event.error);
          setIsSpeaking(false);
        };
        
        // Add a small delay to prevent conflicts between multiple utterances
        setTimeout(() => {
          speechSynthesis.speak(utterance);
        }, Math.random() * 100); // Random delay 0-100ms
      } catch (error) {
        console.error('🔊 Speech synthesis error:', error);
        // Fallback: show a more prominent notification
        Swal.fire({
          icon: 'info',
          title: 'Recording Status',
          text: message,
          timer: 3000,
          showConfirmButton: false,
          position: 'center'
        });
      }
    } else {
      console.warn('🔊 Speech synthesis not supported');
      // Fallback notification
      Swal.fire({
        icon: 'info',
        title: 'Recording Status',
        text: message,
        timer: 3000,
        showConfirmButton: false,
        position: 'center'
      });
    }
  };

  // Broadcast recording announcement to all participants
  const broadcastRecordingAnnouncement = (message: string, type: string) => {
    console.log('📡 ============ BROADCAST START ============');
    const currentUserKey = `${currentUser?.id || currentUser?._id || 'unknown'}-${actualMeetingId}`;
    console.log('📡 Message:', message);
    console.log('📡 Type:', type);
    console.log('📡 Current user key:', currentUserKey);
    
    // Try WebSocket first
    if (socket && wsConnected) {
      console.log('📡 ✅ WebSocket available - emitting...');
      console.log('📡 From user:', currentUser?.displayName || currentUser?.email || 'Unknown');
      console.log('📡 User role:', currentParticipant?.role || 'Unknown');
      console.log('📡 Meeting ID:', actualMeetingId);
      console.log('📡 Socket connected:', wsConnected);
      console.log('📡 Socket ID:', socket?.id);
      
      const payload = {
        meetingId: actualMeetingId,
        message,
        type,
        timestamp: new Date().toISOString(),
        fromUser: currentUser?.displayName || currentUser?.email || 'Unknown'
      };
      console.log('📡 Payload:', JSON.stringify(payload, null, 2));
      
      socket.emit('RECORDING_ANNOUNCEMENT', payload);
      console.log('📡 ✅ Emit completed!');
    } else {
      console.warn('📡 ❌ WebSocket NOT available!');
      console.warn('📡 Socket exists:', !!socket);
      console.warn('📡 Connected:', wsConnected);
    }
    
    // Always use localStorage as fallback for cross-tab communication
    try {
      const announcementData = {
        message,
        type,
        timestamp: new Date().toISOString(),
        fromUser: currentUserKey,
        meetingId: actualMeetingId
      };
      
      console.log('🔄 localStorage fallback:', announcementData);
      localStorage.setItem('recording_announcement', JSON.stringify(announcementData));
      console.log('🔄 ✅ localStorage set!');
      
      // Clear after a short delay to allow other tabs to receive it
      setTimeout(() => {
        localStorage.removeItem('recording_announcement');
        console.log('🔄 localStorage cleared');
      }, 1000);
    } catch (error) {
      console.error('🔄 ❌ localStorage error:', error);
    }
    console.log('📡 ============ BROADCAST END ============');
  };

  const handleRecordingToggle = async () => {
    console.log('🎬 ============ RECORDING TOGGLE START ============');
    console.log('🎬 Current isRecording state:', isRecording);
    console.log('🎬 Current user role:', currentParticipant?.role);
    console.log('🎬 Is host?:', isHost);
    console.log('🎬 Socket exists?:', !!socket);
    console.log('🎬 WebSocket connected?:', wsConnected);
    console.log('🎬 Meeting ID:', actualMeetingId);
    
    if (!isRecording) {
      console.log('🎬 ➡️ STARTING RECORDING...');
      setIsRecording(true);
      setRecordingPaused(false);
      console.log('🎬 State updated: isRecording=true, recordingPaused=false');
      
      // Broadcast to all participants
      console.log('🎬 📡 Broadcasting START announcement...');
      broadcastRecordingAnnouncement('Recording in progress!', 'start');
      
      // Announce locally (for host)
      console.log('🎬 🔊 Playing local announcement...');
      announceRecordingStatus('Recording in progress!');
      
      // Show success notification
      Swal.fire({
        icon: 'success',
        title: 'Recording Started',
        text: 'Recording is now in progress!',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } else {
      console.log('🎬 ⏹️ STOPPING RECORDING...');
      setIsRecording(false);
      setRecordingPaused(false);
      console.log('🎬 State updated: isRecording=false, recordingPaused=false');
      
      // Broadcast to all participants
      console.log('🎬 📡 Broadcasting STOP announcement...');
      broadcastRecordingAnnouncement('Recording stopped!', 'stop');
      
      // Announce locally (for host)
      console.log('🎬 🔊 Playing local announcement...');
      announceRecordingStatus('Recording stopped!');
      
      // Show success notification
      Swal.fire({
        icon: 'info',
        title: 'Recording Stopped',
        text: 'Recording has been stopped and saved!',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
    console.log('🎬 ============ RECORDING TOGGLE END ============');
  };

  const handleRecordingPause = async () => {
    console.log('⏸️ ============ RECORDING PAUSE/RESUME START ============');
    console.log('⏸️ Current recordingPaused state:', recordingPaused);
    console.log('⏸️ Current isRecording state:', isRecording);
    console.log('⏸️ Current user role:', currentParticipant?.role);
    console.log('⏸️ Is host?:', isHost);
    
    const wasPaused = recordingPaused;
    setRecordingPaused(!recordingPaused);
    console.log('⏸️ State updated: recordingPaused=', !recordingPaused);
    
    if (wasPaused) {
      // Recording was paused, now resuming
      console.log('⏸️ ▶️ RESUMING RECORDING...');
      const message = 'Recording resumed!';
      const type = 'resume';
      
      // Broadcast to all participants
      console.log('⏸️ 📡 Broadcasting RESUME announcement...');
      broadcastRecordingAnnouncement(message, type);
      
      // Announce locally (for host)
      console.log('⏸️ 🔊 Playing local announcement...');
      announceRecordingStatus(message);
      
      Swal.fire({
        icon: 'success',
        title: 'Recording Resumed',
        text: 'Recording has been resumed!',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } else {
      // Recording was active, now pausing
      console.log('⏸️ ⏸️ PAUSING RECORDING...');
      const message = 'Recording paused!';
      const type = 'pause';
      
      // Broadcast to all participants
      console.log('⏸️ 📡 Broadcasting PAUSE announcement...');
      broadcastRecordingAnnouncement(message, type);
      
      // Announce locally (for host)
      console.log('⏸️ 🔊 Playing local announcement...');
      announceRecordingStatus(message);
      
      Swal.fire({
        icon: 'warning',
        title: 'Recording Paused',
        text: 'Recording has been paused!',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
    console.log('⏸️ ============ RECORDING PAUSE/RESUME END ============');
  };

  // Screen share handlers
  const handleStartScreenShare = useCallback(() => {
    if (currentParticipant?._id) {
      startQueueScreenShare(currentParticipant._id);
      console.log('📺 Started screen share for:', currentParticipant.displayName);
    }
  }, [currentParticipant, startQueueScreenShare]);

  const handleStopScreenShare = useCallback(() => {
    stopQueueScreenShare();
    console.log('📺 Stopped screen share');
  }, [stopQueueScreenShare]);

  const handleRaiseHand = async () => {
    try {
      if (!currentParticipant?._id) {
        console.error('❌ No current participant found');
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No participant found. Please refresh the page.'
        });
              return;
            }
          
      if (!socket || !wsConnected) {
        console.error('❌ WebSocket not connected');
        Swal.fire({
          icon: 'error',
          title: 'Connection Error',
          text: 'Not connected to server. Please check your connection.'
        });
        return;
      }
      
      console.log('✋ Hand raise toggle:', { 
        wsMyHandRaised,
              participantId: currentParticipant._id,
              meetingId: actualMeetingId,
        socket: !!socket,
        wsConnected
      });
      
      // Use WebSocket state as the source of truth
      if (wsMyHandRaised) {
        // Lower hand
        console.log('✋ Lowering hand...');
        wsLowerHand();
        updateHandRaiseStatus(currentParticipant._id, false);
      } else {
        // Raise hand
        console.log('✋ Raising hand...');
        wsRaiseHand();
        updateHandRaiseStatus(currentParticipant._id, true);
      }
    } catch (error) {
      console.error('❌ Error toggling hand raise:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to toggle hand raise: ${(error as Error).message || 'Unknown error'}`
      });
    }
  };

  // Reset hand raise state when there are permission errors
  const resetHandRaiseState = useCallback(() => {
    console.log('✋ Resetting hand raise state due to permission error');
    setHandRaised(false);
  }, []);

  const handleKickParticipant = async (participantId: string) => {
    try {
      console.log('=== KICK PARTICIPANT DEBUG ===');
      console.log('Attempting to kick participant:', participantId);
      console.log('Current user isHost:', isHost);
      console.log('Current participant:', currentParticipant);
      console.log('Current participant role:', currentParticipant?.role);
      console.log('Current participant ID:', currentParticipant?._id);
      console.log('Current user data:', currentUser);
      console.log('Current user ID:', currentUser?.id);
      console.log('Current user _id:', currentUser?._id);
      console.log('Meeting ID:', actualMeetingId);
      console.log('All participants:', participants);
      console.log('Participants with HOST role:', participants.filter(p => p.role === 'HOST'));
      console.log('Expected currentHostId from DB: 68d9e0cfc34987bba949048a');
      console.log('===============================');
      
      // Refresh current participant data to ensure we have the latest role
      console.log('🔄 Refreshing current participant data...');
      const refreshResult = await refetchCurrentParticipant();
      console.log('🔄 Refresh result:', refreshResult);
      
      // Get the updated participant data
      const updatedParticipant = (refreshResult.data as any)?.getParticipantByUserAndMeeting;
      console.log('🔄 Updated participant data:', updatedParticipant);
      
      // Double-check if user is actually a host after refresh
      const updatedIsHost = updatedParticipant?.role === 'HOST';
      console.log('🔄 Updated isHost status:', updatedIsHost);
      console.log('🔄 Updated participant role:', updatedParticipant?.role);
      
      if (!updatedIsHost) {
        console.log('❌ User is not recognized as host after refresh, cannot kick participant');
        Swal.fire({
          icon: 'error',
          title: 'Permission Denied',
          text: 'Only the meeting host can remove participants.'
        });
        return;
      }
      
      console.log('✅ User is recognized as host, proceeding with kick...');
      console.log('🔄 About to call removeParticipant with participantId:', participantId);
      
      // Check if current user ID matches the currentHostId from database
      const currentUserId = currentUser?.id || currentUser?._id;
      const expectedCurrentHostId = meeting?.currentHostId;
      console.log('🔍 Current user ID from frontend:', currentUserId);
      console.log('🔍 Expected currentHostId from DB:', expectedCurrentHostId);
      console.log('🔍 IDs match:', currentUserId === expectedCurrentHostId);
      console.log('🔍 Meeting data:', meeting);
      console.log('🔍 Meeting hostId (original):', meeting?.hostId);
      console.log('🔍 Meeting currentHostId (transferred):', meeting?.currentHostId);
      console.log('🔍 Is current user the original host?', currentUserId === meeting?.hostId);
      console.log('🔍 Is current user the current host?', currentUserId === meeting?.currentHostId);
      console.log('🔍 Expected original hostId from DB: 68d9e0ffc34987bba94904e2');
      console.log('🔍 Expected currentHostId from DB: 68d9e0cfc34987bba949048a');
      console.log('🔍 Frontend user ID matches original?', currentUserId === '68d9e0ffc34987bba94904e2');
      console.log('🔍 Frontend user ID matches current?', currentUserId === '68d9e0cfc34987bba949048a');
      
      // Check if user is either the original host or the current host
      const isOriginalHost = currentUserId === meeting?.hostId;
      const isCurrentHost = currentUserId === meeting?.currentHostId;
      
      if (!isOriginalHost && !isCurrentHost) {
        console.log('❌ User is neither original host nor current host!');
        console.log('❌ Frontend user ID:', currentUserId);
        console.log('❌ Original hostId:', meeting?.hostId);
        console.log('❌ Current hostId:', meeting?.currentHostId);
        Swal.fire({
          icon: 'error',
          title: 'Permission Error',
          text: 'Only the meeting host can remove participants.'
        });
        return;
      }
      
      if (isOriginalHost) {
        console.log('✅ User is the original host, can kick participants');
      }
      if (isCurrentHost) {
        console.log('✅ User is the current host (transferred), can kick participants');
        console.log('⚠️  WARNING: Backend may still reject this request');
        console.log('⚠️  Backend checks against hostId, not currentHostId');
        console.log('⚠️  This is a backend permission logic issue');
      }
      
      // Check if the participant we're trying to kick is actually in the participants list
      const targetParticipant = participants.find(p => p._id === participantId);
      console.log('🎯 Target participant to kick:', targetParticipant);
      
      if (!targetParticipant) {
        console.log('❌ Target participant not found in participants list');
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Participant not found in the meeting.'
        });
        return;
      }
      
      // Add a small delay to ensure backend has processed the host transfer
      console.log('⏳ Waiting 2 seconds for backend to process host transfer...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('🚀 Calling removeParticipant mutation...');
      console.log('🚀 Variables:', { 
        participantId: participantId
      });
      console.log('🚀 Current user context:', {
        id: currentUser?.id,
        _id: currentUser?._id,
        displayName: currentUser?.displayName,
        email: currentUser?.email
      });
      console.log('🚀 JWT Token context (if available):', {
        token: localStorage.getItem('token'),
        tokenPreview: localStorage.getItem('token')?.substring(0, 50) + '...'
      });
      console.log('🚀 Meeting context:', {
        meetingId: actualMeetingId,
        hostId: meeting?.hostId,
        currentHostId: meeting?.currentHostId
      });
      
      const result = await removeParticipant({
        variables: { 
          participantId: participantId
        }
      });
      
      console.log('🚀 Mutation result:', result);
      console.log('🚀 Mutation success:', (result.data as any)?.removeParticipant?.success);
      console.log('🚀 Mutation message:', (result.data as any)?.removeParticipant?.message);
      
      if ((result.data as any)?.removeParticipant?.success) {
        // Emit KICKED event to notify the removed participant
        const removedParticipant = (result.data as any)?.removeParticipant?.removedParticipant;
        if (removedParticipant?.userId && socket) {
          console.log('📤 Emitting KICKED event for removed participant:', removedParticipant);
          socket.emit('KICKED', {
            userId: removedParticipant.userId,
            meetingId: removedParticipant.meetingId,
            reason: 'Removed by host'
          });
        }
        
      Swal.fire({
        icon: 'success',
        title: 'Participant Removed',
        text: 'The participant has been removed from the meeting.',
        timer: 2000,
        showConfirmButton: false
      });
      } else {
        throw new Error((result.data as any)?.removeParticipant?.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Check if this is a permission error for transferred host
      const currentUserId = currentUser?.id || currentUser?._id;
      const isCurrentHost = currentUserId === meeting?.currentHostId;
      const isOriginalHost = currentUserId === meeting?.hostId;
      
      if (isCurrentHost && !isOriginalHost) {
        Swal.fire({
          icon: 'error',
          title: 'Backend Permission Issue',
          html: `
            <p>As a transferred host, you should be able to kick participants, but the backend is rejecting the request.</p>
            <p><strong>Issue:</strong> Backend checks against original hostId, not currentHostId</p>
            <p><strong>Your ID:</strong> ${currentUserId}</p>
            <p><strong>Original Host ID:</strong> ${meeting?.hostId}</p>
            <p><strong>Current Host ID:</strong> ${meeting?.currentHostId}</p>
            <p>This needs to be fixed in the backend permission logic.</p>
          `,
          confirmButtonText: 'Understood'
        });
      } else {
        // Show more specific error message
        const errorMessage = (error as any)?.message || 'Unknown error occurred';
      Swal.fire({
        icon: 'error',
        title: 'Error',
          text: `Failed to remove participant: ${errorMessage}`
      });
      }
    }
  };

  const handleHostLowerHand = async (participantId: string) => {
    try {
      if (!socket || !wsConnected) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Not connected to server'
        });
        return;
      }

      console.log('✋ Host lowering hand for participant:', participantId);
      
      socket.emit('HOST_LOWER_HAND', {
        meetingId: actualMeetingId,
        participantId,
        reason: 'Lowered by host'
      });

      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'Hand lowered successfully',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error lowering hand:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to lower hand'
      });
    }
  };

  // Get meeting data
  const meeting = meetingData && typeof meetingData === 'object' && 'getMeetingById' in meetingData ? meetingData.getMeetingById as any : null;
  const isHost = currentParticipant?.role === 'HOST';

  // Auto-start meeting for host
  useEffect(() => {
    if (isHost && meeting?.status === 'CREATED' && !isLive) {
      console.log('🚀 Auto-starting meeting for host...');
      handleStartMeeting();
    }
  }, [isHost, meeting?.status, isLive]);

  // Enhance participants with real-time hand raise status
  const participantsWithHandRaise = useMemo(() => {
    console.log('🔍 Updating participants with hand raise status:', {
      participants: participants.length,
      wsRaisedHands: wsRaisedHands.length,
      wsRaisedHandsData: wsRaisedHands
    });
    
    const enhancedParticipants = participants.map(participant => {
      const hasHandRaised = wsRaisedHands.some(hand => hand.userId === participant._id) || false;
      console.log(`🔍 Participant ${participant.displayName} (${participant._id}): hasHandRaised = ${hasHandRaised}`);
      return {
        ...participant,
        hasHandRaised
      };
    });
    
    // Sort to put HOST first
    return enhancedParticipants.sort((a, b) => {
      if (a.role === 'HOST') return -1;
      if (b.role === 'HOST') return 1;
      return 0;
    });
  }, [participants, wsRaisedHands]);

  // Loading state
  if (loading || !authComplete) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#333'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e9ecef',
            borderTop: '3px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p style={{ fontSize: '16px', margin: 0 }}>Loading meeting...</p>
        </div>
      </div>
    );
  }

  // Meeting ended state
  if (meetingStatus === 'ENDED') {
    return (
      <div style={{
          display: 'flex',
        flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#333',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.6 }}>📹</div>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', fontWeight: '600' }}>Meeting Ended</h2>
        <p style={{ fontSize: '16px', marginBottom: '30px', color: '#666' }}>
          This meeting has been ended by the host.
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Return to Home
        </button>
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
          
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
          
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }

          @keyframes speaking {
            0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
            100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
          }

          @keyframes recording {
            0% { opacity: 1; }
            50% { opacity: 0.3; }
            100% { opacity: 1; }
          }
        
        @media (max-width: 768px) {
          .mobile-hidden { display: none !important; }
          .mobile-full { width: 100% !important; }
          .mobile-stack { flex-direction: column !important; }
          .mobile-small { font-size: 14px !important; }
          .mobile-tiny { font-size: 12px !important; }
          }
        `}</style>
        
        <div style={{
          display: 'flex',
          height: '100vh',
          backgroundColor: '#ffffff',
          color: '#333333',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          position: 'relative',
          overflow: 'hidden'
        }}>
      {/* Header */}
          <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
          height: isMobile ? '56px' : '70px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
          padding: isMobile ? '0 12px' : '0 24px',
        zIndex: 1000,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          gap: isMobile ? '8px' : '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', flex: 1, minWidth: 0 }}>
            <div style={{
              width: isMobile ? '32px' : '44px',
              height: isMobile ? '32px' : '44px',
              borderRadius: '8px',
              backgroundColor: '#f3f4f6',
              border: '2px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              <img 
                src="/logoHRDe.png" 
                alt="HRDe Logo" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  padding: '2px'
                }}
              />
            </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ 
                fontSize: isMobile ? '14px' : '20px', 
                fontWeight: '600', 
                color: '#111827',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
              {isMobile ? (meeting?.title || 'Demo Meeting').substring(0, 15) : (meeting?.title || 'Demo Meeting')}
            </div>
              <div style={{ 
                fontSize: isMobile ? '11px' : '14px', 
                color: '#6b7280',
                whiteSpace: 'nowrap'
              }}>
                {isMobile ? (meeting?.inviteCode || actualMeetingId).substring(0, 8) : `Code: ${meeting?.inviteCode || actualMeetingId}`}
            </div>
          </div>
        </div>

          <div style={{ display: 'flex', gap: isMobile ? '4px' : '12px', alignItems: 'center' }}>
            {/* Live Status Badge - Desktop Only */}
            {!isMobile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: isLive ? '#dcfce7' : '#f3f4f6',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500',
                color: isLive ? '#166534' : '#374151',
                border: isLive ? '1px solid #bbf7d0' : 'none',
                transition: 'all 0.3s ease'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isLive ? '#22c55e' : '#6b7280',
                  animation: isLive ? 'pulse 2s infinite' : 'none',
                  transition: 'all 0.3s ease'
                }}></div>
                {isLive ? 'Live' : 'Offline'}
              </div>
            )}
          
            {/* Recording Status Indicator - Visible to ALL participants */}
            {isRecording && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: isMobile ? '4px 8px' : '6px 12px',
                backgroundColor: recordingPaused ? '#fbbf24' : '#ef4444',
                borderRadius: '20px',
                fontSize: isMobile ? '10px' : '12px',
                fontWeight: '600',
                color: 'white',
                animation: recordingPaused ? 'none' : 'recording 1.5s infinite'
              }}>
                <div style={{
                  width: isMobile ? '5px' : '8px',
                  height: isMobile ? '5px' : '8px',
                  borderRadius: '50%',
                  backgroundColor: 'white'
                }}></div>
                {isMobile ? (recordingPaused ? 'Pause' : 'REC') : (recordingPaused ? 'Paused' : 'Recording')}
              </div>
            )}

            {/* Recording Controls - ONLY for HOST */}
            {isHost && (
              <>
                {/* Desktop Controls */}
                {!isMobile && (
                  <>
                    {!isRecording ? (
                      <button
                        onClick={handleRecordingToggle}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 14px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                          <circle cx="7" cy="7" r="7"/>
                        </svg>
                        Record
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={handleRecordingPause}
                          style={{
                            backgroundColor: recordingPaused ? '#10b981' : '#fbbf24',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                          }}
                        >
                          {recordingPaused ? (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                              <path d="M4 2 L12 7 L4 12 Z"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                              <rect x="2" y="2" width="4" height="10" rx="1"/>
                              <rect x="8" y="2" width="4" height="10" rx="1"/>
                            </svg>
                          )}
                          {recordingPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={handleRecordingToggle}
                          style={{
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                            <rect x="2" y="2" width="10" height="10" rx="1"/>
                          </svg>
                          Stop
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Mobile Controls - Icon Only */}
                {isMobile && (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {!isRecording ? (
                      <button
                        onClick={handleRecordingToggle}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: '#ef4444',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                          <circle cx="7" cy="7" r="6"/>
                        </svg>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleRecordingPause}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: recordingPaused ? '#10b981' : '#fbbf24',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {recordingPaused ? (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                              <path d="M4 2 L11 7 L4 12 Z"/>
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
                              <rect x="2" y="2" width="3.5" height="10" rx="0.5"/>
                              <rect x="8.5" y="2" width="3.5" height="10" rx="0.5"/>
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={handleRecordingToggle}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#6b7280',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                            <rect x="2" y="2" width="8" height="8" rx="1"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
            
            {/* Toggle Thumbnail Panel Arrow - Mobile Only */}
            {isMobile && viewMode === 'speaker' && (
              <button
                onClick={() => setThumbnailPanelOpen(!thumbnailPanelOpen)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="#374151"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: thumbnailPanelOpen ? 'rotate(90deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            )}
        </div>
      </div>

        {/* Main Content */}
      <div style={{
        flex: 1,
          paddingTop: isMobile ? '70px' : '70px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff'
      }}>
          {/* Participant Thumbnails Row - Only show in Main view */}
          {viewMode === 'speaker' && (
            <div style={{
              height: thumbnailPanelOpen ? (isMobile ? '120px' : '120px') : (isMobile ? '0px' : '0px'),
              backgroundColor: '#ffffff',
              borderBottom: thumbnailPanelOpen ? '1px solid #e5e7eb' : 'none',
              display: 'flex',
              alignItems: 'center',
              padding: thumbnailPanelOpen ? (isMobile ? '0 12px' : '0 24px') : '0',
              gap: isMobile ? '10px' : '14px',
              overflowX: 'auto',
              overflowY: 'hidden',
              marginTop: '0',
              transition: 'all 0.3s ease-in-out',
              position: 'relative'
            }}>
              {thumbnailPanelOpen && participantsWithHandRaise.map((participant) => (
                <div
                  key={participant._id}
                  onClick={() => setSelectedParticipant(participant)}
                  style={{
                    minWidth: isMobile ? '95px' : '95px',
                    height: isMobile ? '95px' : '95px',
                    backgroundColor: '#f9fafb',
                    borderRadius: isMobile ? '12px' : '10px',
                    border: participant.role === 'HOST' ? '2px solid #10b981' : '1px solid #e5e7eb',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.3s ease'
                  }}
                >
                  
                  {participant.role === 'HOST' && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      fontSize: isMobile ? '8px' : '9px',
                      fontWeight: '600',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      zIndex: 5
                    }}>
                      HOST
                    </div>
                  )}
                  
                  {/* Hand Raise Indicator - Visible for ALL */}
                  {participant.hasHandRaised && (
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      fontSize: isMobile ? '20px' : '22px',
                      zIndex: 5,
                      animation: 'pulse 1.5s infinite'
                    }}>
                      ✋
                    </div>
                  )}
                  
                  <div style={{ fontSize: isMobile ? '32px' : '30px', marginBottom: '6px' }}>
                    {participant.role === 'HOST' ? '👨‍🏫' : '👨‍🎓'}
                  </div>
                  <div style={{ 
                    fontSize: isMobile ? '12px' : '12px', 
                    fontWeight: '500', 
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: '90%'
                  }}>
                    {isMobile ? 
                      (participant.displayName || (participant.role === 'HOST' ? 'Host' : 'Student')).substring(0, 10) :
                      (participant.displayName || (participant.role === 'HOST' ? 'Host' : 'Student'))
                    }
                  </div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '5px' }}>
                    <div style={{
                      width: isMobile ? '20px' : '20px',
                      height: isMobile ? '20px' : '20px',
                      borderRadius: '4px',
                      backgroundColor: participant.micState === 'ON' ? '#22c55e' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {participant.micState === 'ON' ? (
                        <svg width={isMobile ? "11" : "12"} height={isMobile ? "11" : "12"} viewBox="0 0 24 24" fill="white">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                      ) : (
                        <svg width={isMobile ? "11" : "12"} height={isMobile ? "11" : "12"} viewBox="0 0 24 24" fill="white">
                          <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                        </svg>
                      )}
                    </div>
                    <div style={{
                      width: isMobile ? '20px' : '20px',
                      height: isMobile ? '20px' : '20px',
                      borderRadius: '4px',
                      backgroundColor: participant.cameraState === 'ON' ? '#22c55e' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {participant.cameraState === 'ON' ? (
                        <svg width={isMobile ? "11" : "12"} height={isMobile ? "11" : "12"} viewBox="0 0 24 24" fill="white">
                          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                        </svg>
                      ) : (
                        <svg width={isMobile ? "11" : "12"} height={isMobile ? "11" : "12"} viewBox="0 0 24 24" fill="white">
                          <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Main Video Area */}
          <div style={{
            flex: 1,
            backgroundColor: '#f3f4f6',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: isMobile ? '20px' : '40px',
            paddingTop: isMobile ? '20px' : '40px',
            marginTop: '0'
          }}>
            {/* Toggle Thumbnail Panel Button - Desktop Only */}
            {!isMobile && viewMode === 'speaker' && (
              <button
                onClick={() => setThumbnailPanelOpen(!thumbnailPanelOpen)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 50,
                  transition: 'all 0.2s ease',
                  padding: 0
                }}
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="#374151"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: thumbnailPanelOpen ? 'rotate(90deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            )}
            
            {/* View Controls Toggle Button - Desktop Only */}
            {!isMobile && (
              <div 
                data-view-controls
                style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px'
              }}>
                {/* Toggle Button */}
                <button
                  onClick={() => setViewControlsOpen(!viewControlsOpen)}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: viewControlsOpen ? '#3b82f6' : 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(229, 231, 235, 0.8)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: viewControlsOpen ? 'white' : '#374151',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                  }}
                  title="Toggle view controls"
                >
                  {viewMode === 'speaker' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/>
                    </svg>
                  )}
                </button>

                {/* Collapsible View Controls Panel */}
                {viewControlsOpen && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    padding: '16px',
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(229, 231, 235, 0.8)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    minWidth: '200px',
                    animation: 'slideDown 0.3s ease'
                  }}>
                    {/* View Mode Toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ 
                        fontSize: '12px', 
                        fontWeight: '600', 
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        View Mode
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setViewMode('speaker');
                            setViewControlsOpen(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            backgroundColor: viewMode === 'speaker' ? '#3b82f6' : 'transparent',
                            color: viewMode === 'speaker' ? '#ffffff' : '#374151',
                            border: viewMode === 'speaker' ? 'none' : '1px solid #d1d5db',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: viewMode === 'speaker' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          Speaker
                        </button>
                        <button
                          onClick={() => {
                            setViewMode('grid');
                            setViewControlsOpen(false);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            backgroundColor: viewMode === 'grid' ? '#3b82f6' : 'transparent',
                            color: viewMode === 'grid' ? '#ffffff' : '#374151',
                            border: viewMode === 'grid' ? 'none' : '1px solid #d1d5db',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: viewMode === 'grid' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z"/>
                          </svg>
                          Grid
                        </button>
                      </div>
                    </div>

                    {/* Grid Size Controls - Only show when Grid is selected */}
                    {viewMode === 'grid' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          fontWeight: '600', 
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Grid Layout
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {['2x2', '3x3', '4x4'].map((size) => (
                            <button
                              key={size}
                              onClick={() => {
                                setGridSize(size as any);
                                setViewControlsOpen(false);
                              }}
                              style={{
                                flex: 1,
                                padding: '8px 12px',
                                backgroundColor: gridSize === size ? '#10b981' : 'transparent',
                                color: gridSize === size ? '#ffffff' : '#374151',
                                border: gridSize === size ? 'none' : '1px solid #d1d5db',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: gridSize === size ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
                              }}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Hand raise count - Host Only */}
            {isHost && wsRaisedHands.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                backgroundColor: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#92400e',
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                animation: 'pulse 2s infinite'
              }}>
                ✋ {wsRaisedHands.length} hand{wsRaisedHands.length > 1 ? 's' : ''} raised
              </div>
            )}

            {/* Participant Queue Display */}
            <ParticipantQueue
              participants={queueState.participants}
              activeSpeaker={queueState.activeSpeaker}
              screenShareMode={queueState.screenShareMode}
              screenShareParticipant={queueState.screenShareParticipant}
              onParticipantClick={(participant) => {
                setSelectedParticipant(participant);
                console.log('Selected participant:', participant);
              }}
              onHandRaiseClick={(participant) => {
                updateHandRaiseStatus(participant._id, false);
                console.log('Lowered hand for:', participant.displayName);
              }}
              onKickParticipant={(participant) => {
                handleKickParticipant(participant._id);
              }}
              isHost={isHost}
              viewMode={viewMode}
              maxThumbnails={6}
            />
          </div>

          {/* Bottom Control Bar */}
        <div style={{
            height: isMobile ? '70px' : '80px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e5e7eb',
          display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '0 12px' : '0 24px',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px' }}>
              {/* Participant Count */}
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '16px'
              }}>
                {participants.length}
              </div>
              
              {/* Mic Control */}
              <button
                onClick={handleMicToggle}
                style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: micEnabled ? '#22c55e' : '#ef4444',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {micEnabled ? (
                  <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="white">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                ) : (
                  <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="white">
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                  </svg>
                )}
              </button>

              {/* Camera Control */}
              <button
                onClick={handleCameraToggle}
                style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: cameraEnabled ? '#22c55e' : '#ef4444',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {cameraEnabled ? (
                  <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="white">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                ) : (
                  <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="white">
                    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                  </svg>
                )}
              </button>

              {/* Screen Share Control */}
              <button
                onClick={handleScreenShareToggle}
                style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: screenSharing ? '#3b82f6' : '#f3f4f6',
                  border: 'none',
                  cursor: 'pointer',
                  color: screenSharing ? 'white' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                title={screenSharing ? 'Stop sharing' : 'Share screen'}
              >
                <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78 0-4.61.85-6 2.72.56-2.67 2.11-5.33 6-5.87V7l4 3.73-4 3.74z"/>
                </svg>
              </button>

              {/* Chat Control */}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: sidebarOpen ? '#3b82f6' : '#f3f4f6',
                  border: 'none',
                  cursor: 'pointer',
                  color: sidebarOpen ? 'white' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                title="Open/Close chat panel"
              >
                <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
                {unreadMessageCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '10px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #ffffff'
                  }}>
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </span>
                )}
              </button>

              {/* Hand Raise Control */}
              <button
                onClick={handleRaiseHand}
                style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: wsMyHandRaised ? '#f59e0b' : '#f3f4f6',
                  border: 'none',
                  cursor: 'pointer',
                  color: wsMyHandRaised ? 'white' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  animation: wsMyHandRaised ? 'pulse 1.5s infinite' : 'none'
                }}
                title={`Hand ${wsMyHandRaised ? 'raised' : 'lowered'} - Click to toggle`}
              >
                <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/>
                </svg>
              </button>

              {/* Leave Button */}
              <button
                onClick={handleLeaveMeeting}
                style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                title="Leave meeting"
              >
                <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="white">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </button>
            </div>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
      <div style={{
          position: 'fixed',
          right: 0,
            top: isMobile ? '56px' : '70px',
            width: isMobile ? '100%' : '400px',
            height: isMobile ? 'calc(100vh - 136px)' : 'calc(100vh - 150px)',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e5e7eb',
            zIndex: 999,
        display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{
            padding: '20px',
              borderBottom: '1px solid #e5e7eb',
          display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                Participants & Chat
              </h3>
          <button
              onClick={() => setSidebarOpen(false)}
            style={{
                  backgroundColor: 'transparent',
                  color: '#6b7280',
              border: 'none',
                  fontSize: '20px',
              cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
            }}
          >
              ×
          </button>
        </div>

                      <div style={{
                        display: 'flex',
              borderBottom: '1px solid #e5e7eb'
          }}>
          <button
              onClick={() => setActiveTab('participants')}
                  style={{
                flex: 1,
                  padding: '16px',
              border: 'none',
                backgroundColor: activeTab === 'participants' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'participants' ? 'white' : '#6b7280',
                    cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderBottom: activeTab === 'participants' ? '2px solid #3b82f6' : '2px solid transparent',
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
                  backgroundColor: activeTab === 'chat' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'chat' ? 'white' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderBottom: activeTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent',
                  position: 'relative',
                  transition: 'all 0.2s ease'
                }}
              >
                Chat
                {unreadMessageCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    fontSize: '10px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                )}
              </button>
        </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
            {activeTab === 'participants' && (
                <div style={{ padding: '16px' }}>
                  {participantsWithHandRaise.map((participant) => (
                    <div key={participant._id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      backgroundColor: 'transparent',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      border: 'none',
                      borderBottom: '1px solid #e5e7eb',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: participant.role === 'HOST' ? '#3b82f6' : '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        color: 'white',
                        fontWeight: 'bold',
                        position: 'relative'
                      }}>
                        {participant.role === 'HOST' ? 'H' : participant.displayName?.charAt(0)?.toUpperCase() || 'S'}
                        
                        {/* Speaking indicator */}
                        {participant.micState === 'ON' && (
                          <div style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: '#22c55e',
                            borderRadius: '50%',
                            border: '2px solid #ffffff',
                            animation: 'pulse 1s infinite'
                          }}></div>
                        )}
                          </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '500', 
                          marginBottom: '2px', 
                          color: '#111827',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {participant.user?.companyName || participant.displayName || (participant.role === 'HOST' ? 'Host' : 'Student')}
                          {participant.role === 'HOST' && (
                            <span style={{ 
                              fontSize: '10px', 
                              color: '#3b82f6',
                              fontWeight: '600',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              HOST
                            </span>
                          )}
                          </div>
                        {participant.user?.companyName && (
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {participant.displayName || participant.user?.displayName}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Mic Status */}
                        <div style={{ 
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: participant.micState === 'ON' ? '#22c55e' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isHost && participant.role !== 'HOST' ? 'pointer' : 'default',
                          transition: 'all 0.2s ease'
                        }}
                        title={isHost && participant.role !== 'HOST' ? 'Force mute' : (participant.micState === 'ON' ? 'Mic On' : 'Mic Off')}
                        >
                          {participant.micState === 'ON' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                            </svg>
                          )}
                        </div>

                        {/* Camera Status */}
                        <div style={{ 
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          backgroundColor: participant.cameraState === 'ON' ? '#22c55e' : '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isHost && participant.role !== 'HOST' ? 'pointer' : 'default',
                          transition: 'all 0.2s ease'
                        }}
                        title={isHost && participant.role !== 'HOST' ? 'Force camera off' : (participant.cameraState === 'ON' ? 'Camera On' : 'Camera Off')}
                        >
                          {participant.cameraState === 'ON' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                              <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                            </svg>
                          )}
                        </div>

                        {isHost && participant.role !== 'HOST' && (
                          <>
                            {participant.hasHandRaised && (
                              <button
                                onClick={() => handleHostLowerHand(participant._id)}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  backgroundColor: '#f59e0b',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'white',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                title="Lower hand"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                  <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/>
                                  <path d="M12 24L12 16" stroke="white" stroke-width="2"/>
                                  <path d="M8 20L12 24L16 20" stroke="white" stroke-width="2" fill="none"/>
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleKickParticipant(participant._id)}
                              style={{
                                width: '32px',
                                height: '32px',
                                backgroundColor: '#ef4444',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'white',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              title="Remove participant"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                              </svg>
                            </button>
                          </>
                        )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            {activeTab === 'chat' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}>
                  <MinimalistChat
                    meetingId={actualMeetingId}
                    currentUser={currentUser}
                    isHost={isHost}
                    token={localStorage.getItem('jwt') || ''}
                    participants={participants}
                    onUnreadCountChange={setUnreadMessageCount}
                  />
                </div>
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