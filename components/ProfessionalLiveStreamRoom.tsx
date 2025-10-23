import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';

// TODO: Removed thumbnailVideoRefs - now handled by ParticipantThumbnail components
// declare global {
//   interface Window {
//     thumbnailVideoRefs?: { [key: string]: HTMLVideoElement };
//   }
// }
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
import {
  START_RECORDING,
  STOP_RECORDING,
  PAUSE_RECORDING,
  RESUME_RECORDING,
} from '../graphql/live-room-mutations';
import ParticipantView from './ParticipantView';
import ChatView from './ChatView';
import WebSocketChatView from './WebSocketChatView';
import MinimalistChat from './MinimalistChat';
import PictureInPicture from './PictureInPicture';
import { usePictureInPicture } from '../hooks/usePictureInPicture';
import ParticipantQueue from './ParticipantQueue';
// import LiveKitParticipantQueue from './LiveKitParticipantQueue'; // TODO: Re-implement this component
import { ParticipantThumbnail, MainStageView, HandRaiseIndicator, useParticipantsWithHandRaise } from './livekit';
import { useParticipantQueue, Participant } from '../hooks/useParticipantQueue';
import { useAudioLevelDetection } from '../hooks/useAudioLevelDetection';
import { useLiveKit } from '../hooks/useLiveKit';

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
  // AGGRESSIVE DEBUGGING: Track parent component renders
  const parentRenderCountRef = useRef(0);
  parentRenderCountRef.current += 1;
  
  // Track what's causing re-renders
  const prevStateRef = useRef({
    actualMeetingId: '',
    participants: [],
    liveKitParticipants: new Map(),
    isLiveKitConnected: false
  });
  
  // Track what's causing re-renders (props vs internal state)
  const prevPropsRef = useRef({ propMeetingId, role, userId });
  useEffect(() => {
    if (prevPropsRef.current.propMeetingId !== propMeetingId || 
        prevPropsRef.current.role !== role || 
        prevPropsRef.current.userId !== userId) {
      prevPropsRef.current = { propMeetingId, role, userId };
    }
  }, [propMeetingId, role, userId]);
  
  // State management
  const [actualMeetingId, setActualMeetingId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [isLive, setIsLive] = useState(false);
  // Read audio/video preferences from prejoin page (stored in sessionStorage)
  const getPrejoinPreference = (key: string, defaultValue: boolean): boolean => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        const value = stored === 'true';
        // Clear after reading so it doesn't persist across sessions
        sessionStorage.removeItem(key);
        return value;
      }
    } catch (error) {
    }
    return defaultValue;
  };

  const [micEnabled, setMicEnabled] = useState(() => getPrejoinPreference('prejoin_audio_enabled', true));
  const [cameraEnabled, setCameraEnabled] = useState(() => getPrejoinPreference('prejoin_video_enabled', true));
  const [screenSharing, setScreenSharing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('speaker');
  const [gridSize, setGridSize] = useState<'2x2' | '3x3' | '4x4'>('2x2');
  const [isMobile, setIsMobile] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [authComplete, setAuthComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [actualUserId, setActualUserId] = useState<string>('');
  const [currentParticipant, setCurrentParticipant] = useState<any>(null);
  // ✅ CRITICAL FIX: Store only participant ID to prevent reference issues
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
  const [meetingStatus, setMeetingStatus] = useState<string>('CREATED');
  
  // Video player mode states
  const [isVideoPlayerMode, setIsVideoPlayerMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Next.js router for navigation prevention
  const router = useRouter();
  
  // Track participants state changes
  const prevParticipantsRef = useRef(participants);
  
  useEffect(() => {
    if (prevParticipantsRef.current !== participants) {
      prevParticipantsRef.current = participants;
    }
  }, [participants]);
  
  // Circuit breaker to prevent infinite loops
  const processingRef = useRef<Set<string>>(new Set());
  const renderCountRef = useRef(0);
  
  // Track render count (for monitoring only, won't block)
  renderCountRef.current += 1;


  // Participant Queue System - Memoize participants to prevent infinite loop
  // Use a ref to store the previous memoized value for deep comparison
  const prevMemoizedRef = useRef<any[]>([]);
  
  const memoizedParticipants = useMemo(() => {
    // ✅ CLEAN FIX: Use ONE consistent ID + deduplication
    const participantMap = new Map();
    
    participants.forEach(p => {
      const userIdentity = p.user?._id;
      if (userIdentity && !participantMap.has(userIdentity)) {
        participantMap.set(userIdentity, {
          _id: userIdentity, // Use user ID as React key and primary identifier
        displayName: p.displayName,
          email: p.user?.email || '',
        isMuted: p.micState === 'OFF',
        isCameraOff: p.cameraState === 'OFF',
          joinedAt: p.createdAt || '2024-01-01T00:00:00.000Z',
        isHost: p.role === 'HOST',
        role: p.role,
        hasHandRaised: p.hasHandRaised || false,
        handRaisedAt: p.handRaisedAt,
        isSpeaking: false,
        audioLevel: 0,
        lastActivity: '2024-01-01T00:00:00.000Z',
          identity: userIdentity, // ✅ SINGLE ID: user._id matches LiveKit identity
        // Preserve original fields for compatibility
        user: p.user,
          backendId: p._id // Keep participant document ID for backend operations
        });
      }
    });
    
    const newMemoized = Array.from(participantMap.values());
    
                // Participant deduplication completed
    
    // Deep equality check - only return new array if data actually changed
    if (prevMemoizedRef.current.length === newMemoized.length) {
      let hasChanged = false;
      for (let i = 0; i < newMemoized.length; i++) {
        const prev = prevMemoizedRef.current[i];
        const curr = newMemoized[i];
        if (prev?._id !== curr._id || 
            prev?.isMuted !== curr.isMuted || 
            prev?.isCameraOff !== curr.isCameraOff ||
            prev?.hasHandRaised !== curr.hasHandRaised) {
          hasChanged = true;
          break;
        }
      }
      if (!hasChanged) {
        return prevMemoizedRef.current; // Return same reference if data unchanged
      }
    }
    
    prevMemoizedRef.current = newMemoized;
    return newMemoized;
  }, [participants]);

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
  } = useParticipantQueue(memoizedParticipants);
  
  // ✅ CRITICAL FIX: Derive selectedParticipant from ID to prevent reference issues
  // Use a ref to store the previous selected participant to maintain reference stability
  const selectedParticipantRef = useRef<any>(null);
  
  const selectedParticipant = useMemo(() => {
    if (!selectedParticipantId) {
      selectedParticipantRef.current = null;
      return null;
    }
    
    const found = queueState.participants.find(p => p._id === selectedParticipantId);
    
    // Only update the ref if the participant ID changed or the participant object is different
    if (!found) {
      selectedParticipantRef.current = null;
      return null;
    }
    
    // Check if we need to update the ref (ID changed or first time)
    if (!selectedParticipantRef.current || selectedParticipantRef.current._id !== found._id) {
      selectedParticipantRef.current = found;
    }
    
    // Always return the cached reference to prevent prop changes
    return selectedParticipantRef.current;
  }, [selectedParticipantId, queueState.participants]);
  
  // Track if useParticipantQueue functions are changing
  const prevQueueFunctionsRef = useRef({ addToQueue, removeFromQueue, updateQueueParticipant });
  useEffect(() => {
    if (prevQueueFunctionsRef.current.addToQueue !== addToQueue || 
        prevQueueFunctionsRef.current.removeFromQueue !== removeFromQueue ||
        prevQueueFunctionsRef.current.updateQueueParticipant !== updateQueueParticipant) {
      prevQueueFunctionsRef.current = { addToQueue, removeFromQueue, updateQueueParticipant };
    }
  }, [addToQueue, removeFromQueue, updateQueueParticipant]);
  
  // Memoize queueState properties to prevent unnecessary re-renders
  const memoizedActiveSpeaker = useMemo(() => {
    return queueState.activeSpeaker;
  }, [queueState.activeSpeaker?._id]);
  
  const memoizedScreenShareMode = useMemo(() => {
    return queueState.screenShareMode;
  }, [queueState.screenShareMode]);
  
  const memoizedScreenShareParticipant = useMemo(() => {
    return queueState.screenShareParticipant;
  }, [queueState.screenShareParticipant?._id]);
  
  // Memoize callback functions to prevent new function references on every render
  const handleParticipantClick = useCallback((participant: any) => {
    setSelectedParticipantId(participant._id);
  }, []);
  
  // Hand raise status update callback
  const handleHandRaiseStatusChange = useCallback((participantId: string, isRaised: boolean) => {
    updateHandRaiseStatus(participantId, isRaised);
  }, [updateHandRaiseStatus]);

  // Hand raise list update callback
  const handleRaisedHandsChange = useCallback((raisedHands: any[]) => {
    setWsRaisedHands(raisedHands);
  }, []);

  // Audio Level Detection
  const { detectSpeakingStatus, isSupported: audioSupported } = useAudioLevelDetection({
    threshold: 0.01,
    smoothingFactor: 0.8,
    updateInterval: 100
  });
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [viewControlsOpen, setViewControlsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [thumbnailPanelOpen, setThumbnailPanelOpen] = useState(true);
  
  // Auto-open thumbnail panel when screen sharing starts
  useEffect(() => {
    if (queueState.screenShareMode) {
      setThumbnailPanelOpen(true);
    }
  }, [queueState.screenShareMode]);
  const [isPiPVisible, setIsPiPVisible] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  
  // LiveKit integration
  const {
    isConnected: isLiveKitConnected,
    connectionState: liveKitConnectionState,
    isConnecting: isLiveKitConnecting,
    error: liveKitError,
    participants: liveKitParticipants,
    localParticipant: liveKitLocalParticipant,
    isMuted: liveKitIsMuted,
    isCameraEnabled: liveKitIsCameraEnabled,
    isScreenSharing: liveKitIsScreenSharing,
    connect: liveKitConnect,
    disconnect: liveKitDisconnect,
    toggleMicrophone: liveKitToggleMicrophone,
    toggleCamera: liveKitToggleCamera,
    toggleScreenShare: liveKitToggleScreenShare,
    liveKitService
  } = useLiveKit({
    roomName: '', // Will be set when connecting
    participantName: '',
    meetingRole: 'PARTICIPANT' as const,
    autoConnect: false,
    onConnected: (roomState) => {
      setMicEnabled(!roomState.isMuted);
      // ✅ FIX: Don't override cameraEnabled with roomState - keep the user's preference
      // setCameraEnabled(roomState.isCameraEnabled); // This was causing the camera to be disabled
      setScreenSharing(roomState.isScreenSharing);
      
      // IMPORTANT: Camera enable should happen here, after connection is fully established
      // The delayed camera enable in useEffect won't work because isLiveKitConnected updates asynchronously
    },
    onParticipantConnected: (participant) => {
    },
    onParticipantDisconnected: (participantId) => {
    },
    onTrackSubscribed: (track, publication, participant) => {
    },
    onError: (error) => {
    }
  });
  
  // Track LiveKit state changes
  const prevLiveKitRef = useRef({
    isLiveKitConnected: false,
    liveKitParticipants: new Map(),
    liveKitService: null as any
  });
  
  useEffect(() => {
    if (prevLiveKitRef.current.isLiveKitConnected !== isLiveKitConnected) {
      prevLiveKitRef.current.isLiveKitConnected = isLiveKitConnected;
    }
    
    if (prevLiveKitRef.current.liveKitParticipants !== liveKitParticipants) {
      prevLiveKitRef.current.liveKitParticipants = liveKitParticipants;
    }
    
    if (prevLiveKitRef.current.liveKitService !== liveKitService) {
      prevLiveKitRef.current.liveKitService = liveKitService;
    }
  }, [isLiveKitConnected, liveKitParticipants, liveKitService]);
  
  // Debug: Track recording state changes
  useEffect(() => {
  }, [isRecording, recordingPaused]);
  
  // GraphQL Queries
  const { data: meetingData, loading: meetingLoading, error: meetingError, refetch: refetchMeeting } = useQuery(GET_MEETING_BY_ID, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 30000, // PERFORMANCE FIX: Reduced from 2s to 30s - WebSocket handles real-time updates
    fetchPolicy: 'cache-first', // PERFORMANCE FIX: Changed to cache-first to reduce redundant requests
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all'
  });

  const { data: participantsData, loading: participantsLoading, error: participantsError, refetch: refetchParticipants } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId,
    pollInterval: 15000, // PERFORMANCE FIX: Reduced from 1.5s to 15s - WebSocket provides real-time updates
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-first', // PERFORMANCE FIX: Changed to cache-first, WebSocket ensures fresh data
    notifyOnNetworkStatusChange: false
  });

  const { data: waitingData, loading: waitingLoading, error: waitingError } = useQuery(GET_WAITING_PARTICIPANTS, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 20000, // PERFORMANCE FIX: Reduced from 2s to 20s - WebSocket handles waiting room updates
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-first', // PERFORMANCE FIX: Changed to reduce redundant requests
    notifyOnNetworkStatusChange: false
  });

  const { data: currentParticipantData, loading: currentParticipantLoading, error: currentParticipantError, refetch: refetchCurrentParticipant } = useQuery(GET_PARTICIPANT_BY_USER_MEETING, {
    variables: { meetingId: actualMeetingId },
    skip: !actualMeetingId || !isAuth,
    pollInterval: 20000, // CRITICAL PERFORMANCE FIX: Reduced from 1s to 20s (was causing 60 requests/min!)
    errorPolicy: 'ignore',
    fetchPolicy: 'cache-first', // PERFORMANCE FIX: Changed to reduce redundant requests
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
  
  // Recording mutations
  const [startRecordingMutation] = useMutation(START_RECORDING);
  const [stopRecordingMutation] = useMutation(STOP_RECORDING);
  const [pauseRecordingMutation] = useMutation(PAUSE_RECORDING);
  const [resumeRecordingMutation] = useMutation(RESUME_RECORDING);

  // WebSocket connection for real-time features
  const webSocketToken = currentUser?.token || localStorage.getItem('jwt') || localStorage.getItem('token') || '';
  
  const { socket, isConnected: wsConnected } = useWebSocketChat({
    meetingId: actualMeetingId,
    token: webSocketToken,
    onMessage: (message) => {
    },
    onParticipantJoined: (participant) => {
      const participantKey = `${participant._id}-${participant.userId}`;
      
      // Circuit breaker: prevent processing the same participant multiple times
      if (processingRef.current.has(participantKey)) {
        return;
      }
      
      processingRef.current.add(participantKey);
      
      // Helper function to get normalized participant identity key
      const getParticipantKey = (p: any) =>
        p?.user?._id || p?.userId || p?._id || p?.email || '';
      
      // CRITICAL FIX: Directly update local participants state for immediate UI update
      setParticipants(prev => {
        const newParticipantKey = getParticipantKey(participant);
        const exists = prev.find(p => getParticipantKey(p) === newParticipantKey && newParticipantKey !== '');
        if (exists) {
          processingRef.current.delete(participantKey);
          return prev;
        }
        const newParticipants = [...prev, participant];
        processingRef.current.delete(participantKey);
        return newParticipants;
      });
      
      // Also trigger a refresh of participant data for consistency
      if (refetchParticipants) {
        refetchParticipants();
      }
    },
    onParticipantLeft: (participant) => {
      const participantKey = `${participant._id}-${participant.userId}`;
      
      // Circuit breaker: prevent processing the same participant multiple times
      if (processingRef.current.has(participantKey)) {
        return;
      }
      
      processingRef.current.add(participantKey);
      
      // Helper function to get normalized participant identity key
      const getParticipantKey = (p: any) =>
        p?.user?._id || p?.userId || p?._id || p?.email || '';
      
      // CRITICAL FIX: Directly update local participants state for immediate UI update
      setParticipants(prev => {
        const leftParticipantKey = getParticipantKey(participant);
        const filtered = prev.filter(p => getParticipantKey(p) !== leftParticipantKey || leftParticipantKey === '');
        processingRef.current.delete(participantKey);
        return filtered;
      });
      
      // Also trigger a refresh of participant data for consistency
      if (refetchParticipants) {
        refetchParticipants();
      }
    },
    onError: (error) => {
      // WebSocket error
    },
    // Hand raise events are handled through participants data changes
  });

  // Note: Meeting room joining is now handled automatically by the new presence system
  // when the WebSocket connects via JOIN_MEETING and HEARTBEAT events

  // Debug WebSocket connection
  useEffect(() => {
  }, [socket, wsConnected, currentUser, actualMeetingId]);

  // Add WebSocket listeners for real-time participant updates
  useEffect(() => {
    if (socket && actualMeetingId) {

      // Listen for participant admission events
      socket.on('PARTICIPANT_ADMITTED', (data) => {
        if (refetchParticipants) {
          refetchParticipants();
        }
      });

      // Listen for meeting status changes
      socket.on('MEETING_STATUS_CHANGED', (data) => {
        if (refetchParticipants) {
          refetchParticipants();
        }
      });

      // Listen for participant left waiting room
      socket.on('PARTICIPANT_LEFT_WAITING', (data) => {
        if (refetchParticipants) {
          refetchParticipants();
        }
      });

      return () => {
        socket.off('PARTICIPANT_ADMITTED');
        socket.off('MEETING_STATUS_CHANGED');
        socket.off('PARTICIPANT_LEFT_WAITING');
      };
    }
  }, [socket, actualMeetingId, refetchParticipants]);

  // WebSocket event listener for recording announcements
  useEffect(() => {
    
    if (socket && wsConnected) {
      
      const handleRecordingAnnouncement = (data: { message: string; type: string }) => {
        
        // Update recording state for participants
        if (!isHost) {
          if (data.type === 'start') {
            setIsRecording(true);
          } else if (data.type === 'stop') {
            setIsRecording(false);
          }
        }
        
        // Play the announcement on all participant devices
        announceRecordingStatus(data.message);
        
        // Show visual notification
        Swal.fire({
          icon: data.type === 'start' ? 'success' : 'info',
          title: data.type === 'start' ? 'Recording Started' : 'Recording Stopped',
          text: data.message,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      };

      const handleTestBroadcast = (data: any) => {
        announceRecordingStatus('WebSocket test received! Broadcasting works!');
      };

      socket.on('RECORDING_ANNOUNCEMENT', handleRecordingAnnouncement);
      socket.on('TEST_BROADCAST', handleTestBroadcast);
      

      return () => {
        socket.off('RECORDING_ANNOUNCEMENT', handleRecordingAnnouncement);
        socket.off('TEST_BROADCAST', handleTestBroadcast);
      };
    } else {
    }
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
          
          const userWithToken = {
            ...user,
            token
          };
          setCurrentUser(userWithToken);
          setActualUserId(user?.id || userId);
          
          // CRITICAL FIX: Call GraphQL joinMeeting mutation to create participant record
          try {
            const joinResult = await joinMeeting({
              variables: {
                input: {
                  meetingId: meetingIdToUse,
                  displayName: user.displayName || 'Participant',
                  role: user.systemRole === 'TUTOR' || user.systemRole === 'ADMIN' ? 'HOST' : 'PARTICIPANT'
                }
              }
            });
            
            if ((joinResult.data as any)?.joinMeeting) {
              setCurrentParticipant((joinResult.data as any).joinMeeting);
            } else {
            }
          } catch (joinError) {
            // Don't fail the entire initialization, just log the error
          }
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
        setLoading(false);
      }
    };

    initializeMeeting();
  }, [propMeetingId, userId, role]);

  // Connect to LiveKit when authentication is complete
  useEffect(() => {

    if (authComplete && actualMeetingId && currentUser && !isLiveKitConnected && !isLiveKitConnecting) {

      // Connect to LiveKit with camera/mic settings from state
      // Camera will be enabled during connection if cameraEnabled=true

      // LiveKit connection with camera and mic state

      liveKitConnect({
        roomName: actualMeetingId,
        participantName: currentUser.displayName || currentUser.name || 'User',
        meetingRole: role as 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER',
        enableCamera: cameraEnabled, // Enable camera based on state - connection handles it properly now
        enableMicrophone: micEnabled,
        enableScreenShare: true
      }).catch(error => {
        // Connection error handled
      });
    }
  }, [authComplete, actualMeetingId, currentUser, role, cameraEnabled, micEnabled, liveKitConnect, isLiveKitConnected, isLiveKitConnecting]);

  // Debug: Log when dependencies change
  useEffect(() => {
  }, [authComplete, actualMeetingId, currentUser, role, cameraEnabled, micEnabled, liveKitConnect, isLiveKitConnected, isLiveKitConnecting]);

  // NOTE: Video elements ready event listener removed - no longer needed

  // NOTE: Old video attachment code removed - video tracks now handled by ParticipantThumbnail and MainStageView components

  // Simple mobile detection for responsive layout
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('speaker');
        // Auto-enable video player mode on mobile
        setIsVideoPlayerMode(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-enable video player mode after connection
  useEffect(() => {
    if (isLiveKitConnected && !isMobile) {
      // Desktop: Enable video player mode after 2 seconds
      const timer = setTimeout(() => {
        setIsVideoPlayerMode(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLiveKitConnected, isMobile]);

  // Production environment checks
  useEffect(() => {
    // Check if we're in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      // Disable console logs in production
      console.log = () => {};
      console.warn = () => {};
      console.info = () => {};
      
      // Only keep console.error for debugging
      console.error = console.error;
    }
  }, []);

  // Mobile fullscreen and immersive mode
  useEffect(() => {
    if (!isMobile) return;

    // Set viewport meta for mobile optimization
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalContent = viewportMeta?.getAttribute('content');
    
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    }

    const enterFullscreen = async () => {
      try {
        // Force video player mode for mobile
        setIsVideoPlayerMode(true);
        setIsFullscreen(true);
        // Hide controls initially for immersive experience
        setShowControls(false);
        
        // Request fullscreen for the document
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen().catch(() => {});
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen().catch(() => {});
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen().catch(() => {});
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen().catch(() => {});
        }

        // Try to hide address bar on mobile browsers
        window.scrollTo(0, 1);
        
        // Lock screen orientation to landscape (optional)
        if (screen.orientation && (screen.orientation as any).lock) {
          try {
            (screen.orientation as any).lock?.('landscape').catch(() => {});
          } catch (e) {
          }
        }
      } catch (error) {
        console.log('Fullscreen error:', error);
      }
    };

    // Prevent pull-to-refresh on mobile
    const preventPullToRefresh = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      
      const touch = e.touches[0];
      if (touch.clientY > 50) return;
      
      e.preventDefault();
    };

    document.addEventListener('touchstart', preventPullToRefresh, { passive: false });
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });

    // Enter fullscreen immediately for mobile
    const timer = setTimeout(() => {
      enterFullscreen();
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', preventPullToRefresh);
      document.removeEventListener('touchmove', preventPullToRefresh);
      
      // Restore original viewport settings
      if (viewportMeta && originalContent) {
        viewportMeta.setAttribute('content', originalContent);
      }
      
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [isMobile]);

  // Mobile error handling
  useEffect(() => {
    if (!isMobile) return;

    const handleError = (event: ErrorEvent) => {
      // Prevent default error handling for mobile
      event.preventDefault();
      
      // Only show error alerts in development
      if (process.env.NODE_ENV === 'development') {
        Swal.fire({
          icon: 'error',
          title: 'Mobile Error',
          text: 'Please refresh the page and try again. If the problem persists, try using Chrome or Safari browser.',
          confirmButtonText: 'Refresh',
          confirmButtonColor: '#4A6CF7'
        }).then(() => {
          window.location.reload();
        });
      } else {
        // In production, just log the error
        console.error('Mobile error:', event.error);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Prevent default error handling for mobile
      event.preventDefault();
      
      // Only show error alerts in development
      if (process.env.NODE_ENV === 'development') {
        Swal.fire({
          icon: 'error',
          title: 'Connection Error',
          text: 'Please check your internet connection and try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#4A6CF7'
        });
      } else {
        // In production, just log the error
        console.error('Unhandled promise rejection:', event.reason);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isMobile]);

  // Video player mode controls (auto-hide like video player)
  useEffect(() => {
    if (!isVideoPlayerMode) return;

    let hideTimer: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(hideTimer);
      setShowControls(true);
      hideTimer = setTimeout(() => {
        setShowControls(false);
      }, 3000); // Hide after 3 seconds of inactivity
    };

    // Show controls on mouse movement or touch
    const handleUserActivity = () => {
      resetTimer();
    };

    document.addEventListener('mousemove', handleUserActivity);
    document.addEventListener('touchstart', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);

    // Initial timer
    resetTimer();

    return () => {
      clearTimeout(hideTimer);
      document.removeEventListener('mousemove', handleUserActivity);
      document.removeEventListener('touchstart', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
    };
  }, [isVideoPlayerMode]);

  // Fullscreen toggle functionality
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen();
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (error) {
      // Fullscreen failed, continue anyway
    }
  }, []);

  // Picture-in-Picture mode for mobile (when app goes to background)
  useEffect(() => {
    if (!isMobile) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPageHidden(true);
        setIsPiPVisible(true);
      } else {
        setIsPageHidden(false);
        setIsPiPVisible(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isMobile]);

  // Prevent accidental page navigation (back button, refresh, close tab)
  useEffect(() => {
    // Flag to track if user is intentionally leaving
    let isLeavingIntentionally = false;
    
    // Handle browser back button and close tab
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLeavingIntentionally) {
        return;
      }
      
      // Show browser confirmation dialog
      e.preventDefault();
      e.returnValue = 'Do you want to leave the meeting?';
      return e.returnValue;
    };
    
    // Handle page hide/unload - attempt to send leave/end meeting request
    // This fires when user actually closes/navigates away (after confirmation)
    const handlePageHide = () => {
      if (!currentParticipant?._id) return;
      
      // Use sendBeacon for reliable delivery even as page unloads
      // This is a "fire and forget" API that works even during page unload
      const endpoint = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = currentUser?.token || localStorage.getItem('jwt') || localStorage.getItem('token') || '';
      
      try {
        // Check if user is host - if yes, end meeting instead of just leaving
        const isHost = currentParticipant?.role === 'HOST';
        
        if (isHost) {
          // Host leaving - end the meeting for everyone
          fetch(`${endpoint}/graphql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({
              query: `
                mutation EndMeeting($meetingId: ID!) {
                  endMeeting(meetingId: $meetingId) {
                    _id
                    status
                  }
                }
              `,
              variables: {
                meetingId: actualMeetingId
              }
            }),
            keepalive: true
          }).catch(() => {});
        } else {
          // Regular participant - just leave meeting
          fetch(`${endpoint}/graphql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({
              query: `
                mutation LeaveMeeting($input: LeaveMeetingInput!) {
                  leaveMeeting(input: $input)
                }
              `,
              variables: {
                input: {
                  participantId: currentParticipant._id
                }
              }
            }),
            keepalive: true
          }).catch(() => {});
        }
      } catch (error) {
        // Silently fail
      }
      
      // Also try to disconnect from LiveKit
      if (liveKitDisconnect) {
        liveKitDisconnect().catch(() => {});
      }
    };
    
    // Handle Next.js route changes (back button, navigation)
    const handleRouteChangeStart = (url: string) => {
      if (isLeavingIntentionally) {
        return;
      }
      
      // Show custom confirmation dialog
      const confirmed = window.confirm('Do you want to leave the meeting?');
      
      if (!confirmed) {
        // Prevent navigation
        router.events.emit('routeChangeError');
        throw 'Route change aborted by user';
      } else {
        // User confirmed, mark as intentional leave
        isLeavingIntentionally = true;
        
        // Check if user is host
        const isHost = currentParticipant?.role === 'HOST';
        
        if (isHost) {
          // Host leaving - end the meeting for everyone
          endMeeting({
            variables: {
              meetingId: actualMeetingId
            }
          }).catch(() => {});
        } else {
          // Regular participant - just leave meeting
          if (currentParticipant?._id) {
            leaveMeeting({
              variables: {
                input: {
                  participantId: currentParticipant._id
                }
              }
            }).catch(() => {});
          }
        }
        
        // Disconnect from LiveKit
        if (liveKitDisconnect) {
          liveKitDisconnect().catch(() => {});
        }
      }
    };
    
    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    router.events.on('routeChangeStart', handleRouteChangeStart);
    
    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [router, currentParticipant, currentUser, actualMeetingId, leaveMeeting, endMeeting, liveKitDisconnect]);

  // Monitor host connection - end meeting if host loses connection
  useEffect(() => {
    // Only monitor if user is host and connected
    if (currentParticipant?.role !== 'HOST' || !isLiveKitConnected) {
      return;
    }

    // Track disconnection timer
    let disconnectionTimer: NodeJS.Timeout | null = null;
    const DISCONNECTION_TIMEOUT = 30000; // 30 seconds grace period
    
    // Check connection state
    if (liveKitConnectionState === 'disconnected' || liveKitConnectionState === 'reconnecting') {
      // Start timer - if still disconnected after timeout, end meeting
      disconnectionTimer = setTimeout(async () => {
        // Double check still disconnected
        if (liveKitConnectionState === 'disconnected') {
          console.log('🔴 HOST DISCONNECTED - Ending meeting for all participants');
          
          try {
            // End the meeting
            await endMeeting({
              variables: {
                meetingId: actualMeetingId
              }
            });
            
            // Show notification to host
            if (typeof window !== 'undefined') {
              Swal.fire({
                icon: 'warning',
                title: 'Connection Lost',
                text: 'You lost connection to the meeting. The meeting has been ended.',
                timer: 3000,
                showConfirmButton: false
              });
              
              // Redirect after notification
              setTimeout(() => {
                window.location.href = '/';
              }, 3500);
            }
          } catch (error) {
            console.error('Failed to end meeting on host disconnect:', error);
          }
        }
      }, DISCONNECTION_TIMEOUT);
    }
    
    // Cleanup timer
    return () => {
      if (disconnectionTimer) {
        clearTimeout(disconnectionTimer);
      }
    };
  }, [currentParticipant, isLiveKitConnected, liveKitConnectionState, actualMeetingId, endMeeting]);

  // Handle leaving meeting from PiP
  const handleLeaveMeetingFromPiP = useCallback(async () => {
    setIsPiPVisible(false);
    
    // Disconnect from LiveKit
    if (liveKitDisconnect) {
      await liveKitDisconnect();
    }
    
    // Leave meeting
    if (currentParticipant?._id) {
      try {
        await leaveMeeting({
          variables: {
            participantId: currentParticipant._id
          }
        });
      } catch (error) {
      }
    }
    
    // Redirect to dashboard or home
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  }, [currentParticipant, liveKitDisconnect]);

  // Close PiP and return to room
  const handleClosePiP = useCallback(() => {
    setIsPiPVisible(false);
  }, []);

  // Initialize speech synthesis voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices if not already loaded
      if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
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
      // If there's a GraphQL error, it might be because the meeting ended
      // Check if the error is related to null title field
      if (meetingError.message.includes('Cannot return null for non-nullable field MeetingWithHost.title')) {
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
  // ✅ CRITICAL FIX: Use a ref to track the actual participant IDs to prevent infinite loops
  const prevParticipantIdsRef = useRef<string>('');
  
  useEffect(() => {
    if (participantsData && typeof participantsData === 'object' && 'getParticipantsByMeeting' in participantsData && participantsData.getParticipantsByMeeting) {
      const participantsList = participantsData.getParticipantsByMeeting as any[];
      
      // 🧠 Step 1 — Detect mismatch in raw participant data
      // Raw participant data processed
      
      // Create a stable string representation of participant IDs
      const currentParticipantIds = participantsList.map((p: any) => p._id).sort().join(',');
      
      // Only process if the actual participant list changed (not just the object reference)
      if (currentParticipantIds !== prevParticipantIdsRef.current) {
        prevParticipantIdsRef.current = currentParticipantIds;
        
        const previousParticipants = participants;
        
        // ✅ CLEAN FIX: No need to normalize - just use the participants as they come from backend
        // The memoizedParticipants will handle the ID mapping cleanly
        setParticipants(participantsList);

        // Check for new participants (joined)
        if (previousParticipants.length > 0) {
          const newParticipants = participantsList.filter((newP: any) => 
            !previousParticipants.find((oldP: any) => oldP._id === newP._id)
          );
          
          newParticipants.forEach((participant: any) => {
            addToQueue({
              _id: participant._id,
              displayName: participant.displayName,
              email: participant.email || '',
              isMuted: participant.micState === 'OFF',
              isCameraOff: participant.cameraState === 'OFF',
              joinedAt: participant.joinedAt || '2024-01-01T00:00:00.000Z',
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
            removeFromQueue(participant._id);
          });
        } else if (participantsList.length > 0) {
          // Initial load - add all participants
          participantsList.forEach((participant: any) => {
            addToQueue({
              _id: participant._id,
              displayName: participant.displayName,
              email: participant.email || '',
              isMuted: participant.micState === 'OFF',
              isCameraOff: participant.cameraState === 'OFF',
              joinedAt: participant.joinedAt || '2024-01-01T00:00:00.000Z',
              isHost: participant.role === 'HOST',
              role: participant.role,
              hasHandRaised: participant.hasHandRaised || false,
              handRaisedAt: participant.handRaisedAt
            });
          });
        }
      }
    }
  }, [participantsData, addToQueue, removeFromQueue]);
  
  // ✅ FIXED: Removed participants from dependency array to prevent infinite loop

  // Audio level detection and speaking status monitoring
  // ✅ CRITICAL FIX: Use a ref to track previous audio levels to prevent unnecessary updates
  const previousAudioLevelsRef = useRef<Map<string, { audioLevel: number, isSpeaking: boolean }>>(new Map());
  
  useEffect(() => {
    if (!audioSupported) return;

    const monitorAudioLevels = async () => {
      // Get current participants from queueState (read from ref, not dependency)
      const currentParticipants = queueState.participants;
      
      if (currentParticipants.length === 0) return;
      
      try {
        // Get participants with audio streams (mock for now)
        const participantsWithStreams = currentParticipants.map(p => ({
          _id: p._id,
          stream: undefined // In real implementation, this would be the actual MediaStream
        }));

        const speakingStatuses = await detectSpeakingStatus(participantsWithStreams);
        
        // Update speaking status ONLY if it actually changed
        speakingStatuses.forEach(({ _id, audioLevel, isSpeaking }) => {
          const previous = previousAudioLevelsRef.current.get(_id);
          
          // Only update if audio level or speaking status actually changed
          if (!previous || previous.audioLevel !== audioLevel || previous.isSpeaking !== isSpeaking) {
            previousAudioLevelsRef.current.set(_id, { audioLevel, isSpeaking });
            updateSpeakingStatus(_id, isSpeaking, audioLevel);
          }
        });
      } catch (error) {
      }
    };

    const interval = setInterval(monitorAudioLevels, 200); // Check every 200ms
    return () => clearInterval(interval);
  }, [audioSupported, detectSpeakingStatus, updateSpeakingStatus]); // ✅ REMOVED queueState.participants from deps

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
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to leave the meeting. Please try again.'
      });
    }
  };

  const handleMicToggle = async () => {
    if (isLiveKitConnected) {
      try {
        await liveKitToggleMicrophone();
        setMicEnabled(!micEnabled);
      } catch (error: any) {
        
        // Show user-friendly error message
        Swal.fire({
          icon: 'error',
          title: 'Microphone Error',
          text: error?.message || 'Failed to toggle microphone. Please check microphone permissions.',
          timer: 3000
        });
        
      }
    } else {
      setMicEnabled(!micEnabled);
    }
  };

  const handleCameraToggle = async () => {
    if (isLiveKitConnected) {
      try {
        await liveKitToggleCamera();
        setCameraEnabled(!cameraEnabled);
      } catch (error: any) {
        
        // Show user-friendly error message
        Swal.fire({
          icon: 'error',
          title: 'Camera Error',
          text: error?.message || 'Failed to toggle camera. Please check camera permissions and try again.',
          timer: 3000
        });
        
        // Don't update state if operation failed
      }
    } else {
      setCameraEnabled(!cameraEnabled);
    }
  };

  const handleScreenShareToggle = async () => {
    if (isLiveKitConnected) {
      try {
        await liveKitToggleScreenShare();
        setScreenSharing(!screenSharing);
      } catch (error: any) {
        
        // Show user-friendly error message
        Swal.fire({
          icon: 'error',
          title: 'Screen Share Error',
          text: error?.message || 'Failed to toggle screen share. User may have cancelled or browser blocked it.',
          timer: 3000
        });
        
      }
    } else {
      setScreenSharing(!screenSharing);
    }
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
        } else {
        }
        
        // Add unique identifier and event listeners
        const utteranceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        utterance.onstart = () => {
          setIsSpeaking(true);
        };
        utterance.onend = () => {
          setIsSpeaking(false);
        };
        utterance.onerror = (event) => {
          setIsSpeaking(false);
        };
        
        // Add a small delay to prevent conflicts between multiple utterances
        setTimeout(() => {
          speechSynthesis.speak(utterance);
        }, Math.random() * 100); // Random delay 0-100ms
      } catch (error) {
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
    const currentUserKey = `${currentUser?.id || currentUser?._id || 'unknown'}-${actualMeetingId}`;
    
    // Try WebSocket first
    if (socket && wsConnected) {
      
      const payload = {
        meetingId: actualMeetingId,
        message,
        type,
        timestamp: new Date().toISOString(),
        fromUser: currentUser?.displayName || currentUser?.email || 'Unknown'
      };
      
      socket.emit('RECORDING_ANNOUNCEMENT', payload);
    } else {
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
      
      localStorage.setItem('recording_announcement', JSON.stringify(announcementData));
      
      // Clear after a short delay to allow other tabs to receive it
      setTimeout(() => {
        localStorage.removeItem('recording_announcement');
      }, 1000);
    } catch (error) {
    }
  };

  const handleRecordingToggle = async () => {
    // Prevent multiple rapid clicks
    if (isRecordingInProgress) {
      console.log('Recording operation already in progress, please wait...');
      return;
    }
    
    setIsRecordingInProgress(true);
    
    try {
      if (!isRecording) {
        try {
          // Call GraphQL mutation to start recording
          const result = await startRecordingMutation({
            variables: {
              input: {
                meetingId: actualMeetingId,
                quality: '720p',
                format: 'mp4'
              }
            }
          });
          
          if (result.data && (result.data as any).startMeetingRecording?.success) {
            setIsRecording(true);
            
            // Broadcast to all participants
            broadcastRecordingAnnouncement('Recording in progress!', 'start');
            
            // Announce locally (for host)
            announceRecordingStatus('Recording in progress!');
            
            // Show success notification
            Swal.fire({
              icon: 'success',
              title: 'Recording Started',
              text: 'Recording is now in progress and will be saved to VOD!',
              timer: 3000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end'
            });
          }
        } catch (error) {
          console.error('Failed to start recording:', error);
          Swal.fire({
            icon: 'error',
            title: 'Recording Failed',
            text: 'Failed to start recording. Please try again.',
            timer: 3000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        }
      } else {
        try {
          // Call GraphQL mutation to stop recording
          const result = await stopRecordingMutation({
            variables: {
              input: {
                meetingId: actualMeetingId
              }
            }
          });
          
          if (result.data && (result.data as any).stopMeetingRecording?.success) {
            setIsRecording(false);
            
            // Broadcast to all participants
            broadcastRecordingAnnouncement('Recording stopped!', 'stop');
            
            // Announce locally (for host)
            announceRecordingStatus('Recording stopped!');
          
          // Show success notification
          Swal.fire({
            icon: 'success',
            title: 'Recording Stopped',
            text: 'Recording has been stopped and saved to VOD server!',
            timer: 3000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        }
      } catch (error) {
        console.error('Failed to stop recording:', error);
        Swal.fire({
          icon: 'error',
          title: 'Stop Recording Failed',
          text: 'Failed to stop recording. Please try again.',
          timer: 3000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      }
    }
    } finally {
      // Always reset the progress state
      setIsRecordingInProgress(false);
    }
  };

  const handleRecordingPause = async () => {
    
    const wasPaused = recordingPaused;
    
    if (wasPaused) {
      // Recording was paused, now resuming
      try {
        const result = await resumeRecordingMutation({
          variables: {
            input: {
              meetingId: actualMeetingId
            }
          }
        });
        
        if (result.data && (result.data as any).resumeMeetingRecording?.success) {
          setRecordingPaused(false);
          const message = 'Recording resumed!';
          const type = 'resume';
          
          // Broadcast to all participants
          broadcastRecordingAnnouncement(message, type);
          
          // Announce locally (for host)
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
        }
      } catch (error) {
        console.error('Failed to resume recording:', error);
        Swal.fire({
          icon: 'error',
          title: 'Resume Failed',
          text: 'Failed to resume recording.',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      }
    } else {
      // Recording was active, now pausing
      try {
        const result = await pauseRecordingMutation({
          variables: {
            input: {
              meetingId: actualMeetingId
            }
          }
        });
        
        if (result.data && (result.data as any).pauseMeetingRecording?.success) {
          setRecordingPaused(true);
          const message = 'Recording paused!';
          const type = 'pause';
          
          // Broadcast to all participants
          broadcastRecordingAnnouncement(message, type);
          
          // Announce locally (for host)
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
      } catch (error) {
        console.error('Failed to pause recording:', error);
        Swal.fire({
          icon: 'error',
          title: 'Pause Failed',
          text: 'Failed to pause recording.',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      }
    }
  };

  // Screen share handlers
  const handleStartScreenShare = useCallback(() => {
    if (currentParticipant?._id) {
      startQueueScreenShare(currentParticipant._id);
    }
  }, [currentParticipant, startQueueScreenShare]);

  const handleStopScreenShare = useCallback(() => {
    stopQueueScreenShare();
  }, [stopQueueScreenShare]);

  const handleKickParticipant = useCallback(async (participantId: string) => {
    try {
      
      // Refresh current participant data to ensure we have the latest role
      const refreshResult = await refetchCurrentParticipant();
      
      // Get the updated participant data
      const updatedParticipant = (refreshResult.data as any)?.getParticipantByUserAndMeeting;
      
      // Double-check if user is actually a host after refresh
      const updatedIsHost = updatedParticipant?.role === 'HOST';
      
      if (!updatedIsHost) {
        Swal.fire({
          icon: 'error',
          title: 'Permission Denied',
          text: 'Only the meeting host can remove participants.'
        });
        return;
      }
      
      
      // Check if current user ID matches the currentHostId from database
      const currentUserId = currentUser?.id || currentUser?._id;
      const expectedCurrentHostId = meeting?.currentHostId;
      
      // Check if user is either the original host or the current host
      const isOriginalHost = currentUserId === meeting?.hostId;
      const isCurrentHost = currentUserId === meeting?.currentHostId;
      
      if (!isOriginalHost && !isCurrentHost) {
        Swal.fire({
          icon: 'error',
          title: 'Permission Error',
          text: 'Only the meeting host can remove participants.'
        });
        return;
      }
      
      if (isOriginalHost) {
      }
      if (isCurrentHost) {
      }
      
      // Check if the participant we're trying to kick is actually in the participants list
      const targetParticipant = participants.find(p => p._id === participantId);
      
      if (!targetParticipant) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Participant not found in the meeting.'
        });
        return;
      }
      
      // Add a small delay to ensure backend has processed the host transfer
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      
      const result = await removeParticipant({
        variables: { 
          participantId: participantId
        }
      });
      
      
      if ((result.data as any)?.removeParticipant?.success) {
        // Emit KICKED event to notify the removed participant
        const removedParticipant = (result.data as any)?.removeParticipant?.removedParticipant;
        if (removedParticipant?.userId && socket) {
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
  }, [refetchCurrentParticipant, participants, removeParticipant, socket, currentUser]);
  
  // Wrapper for onKickParticipant callback that takes Participant object
  const handleKickParticipantClick = useCallback((participant: any) => {
    handleKickParticipant(participant._id);
  }, [handleKickParticipant]);

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
      handleStartMeeting();
    }
  }, [isHost, meeting?.status, isLive]);

  // Get wsRaisedHands from HandRaiseIndicator via state
  const [wsRaisedHands, setWsRaisedHands] = React.useState<any[]>([]);
  
  // Enhance participants with real-time hand raise status using the helper hook
  const participantsWithHandRaise = useParticipantsWithHandRaise(participants, wsRaisedHands);
  
  // Debug: Check for duplicate participants
  useEffect(() => {
    console.log('🔍 PARTICIPANTS DEBUG:', {
      participantsCount: participants.length,
      participantsWithHandRaiseCount: participantsWithHandRaise.length,
      participants: participants.map(p => ({ id: p._id, name: p.displayName })),
      participantsWithHandRaise: participantsWithHandRaise.map(p => ({ id: p._id, name: p.displayName }))
    });
  }, [participants, participantsWithHandRaise]);

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

  // Participant data processed

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

          /* Video Player Mode - All Devices */
          .video-player-mode {
            background: #000000 !important;
            color: #ffffff !important;
          }

          .video-player-mode body {
            overflow: hidden;
            position: fixed;
            width: 100vw;
            height: 100vh;
            -webkit-overflow-scrolling: touch;
            background: #000000;
            margin: 0;
            padding: 0;
          }

          /* Hide browser chrome and scrollbars */
          .video-player-mode html {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
            height: 100%;
            overflow: hidden;
          }

          /* Hide scrollbars globally */
          .video-player-mode ::-webkit-scrollbar {
            display: none;
          }

          /* Fullscreen video player container */
          .video-player-mode #__next {
            height: 100vh;
            width: 100vw;
            position: fixed;
            top: 0;
            left: 0;
            background: #000000;
            z-index: 9999;
          }

          /* Video player controls animation */
          .video-player-controls {
            transition: all 0.3s ease;
          }

          .video-player-controls.hidden {
            transform: translateY(100%);
            opacity: 0;
          }

          .video-player-controls.visible {
            transform: translateY(0);
            opacity: 1;
          }
        
          /* Custom scrollbar for participant thumbnails */
          .participant-thumbnails::-webkit-scrollbar {
            height: 4px;
          }
          
          .participant-thumbnails::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .participant-thumbnails::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 2px;
          }
          
          .participant-thumbnails::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          
          /* Smooth scrolling */
          .participant-thumbnails {
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
          }
        
        @media (max-width: 1024px) and (min-width: 481px) {
          .tablet-hidden { display: none !important; }
          .tablet-small { font-size: 16px !important; }
        }
        
        @media (max-width: 480px) {
          .mobile-hidden { display: none !important; }
          .mobile-full { width: 100% !important; }
          .mobile-stack { flex-direction: column !important; }
          .mobile-small { font-size: 14px !important; }
          .mobile-tiny { font-size: 12px !important; }
          
          /* Mobile immersive mode */
          body {
            overflow: hidden;
            position: fixed;
            width: 100%;
            height: 100%;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Hide browser chrome */
          html {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          
          /* Prevent zoom on input focus */
          input, textarea, select {
            font-size: 16px !important;
          }
          
          /* iOS Safari specific */
          @supports (-webkit-touch-callout: none) {
            body {
              height: -webkit-fill-available;
            }
          }
          }
        `}</style>
        
        <div 
          className={isVideoPlayerMode ? 'video-player-mode' : ''}
          style={{
            display: 'flex',
            flexDirection: 'column', // Ensure column layout for proper structure
            height: '100vh',
            width: '100vw', // Use full viewport width
            backgroundColor: isVideoPlayerMode ? '#000000' : '#ffffff',
            color: isVideoPlayerMode ? '#ffffff' : '#333333',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            position: 'relative',
            overflow: 'hidden',
            // Video player mode styling
            ...(isVideoPlayerMode && {
              background: 'linear-gradient(135deg, #000000 0%, #1a1a2e 100%)'
            })
          }}>
          
          {/* Main Content Area - Takes remaining space */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            // Reserve space for fixed header and bottom bar
            paddingTop: isMobile ? '56px' : '70px',
            paddingBottom: isMobile ? '70px' : '80px'
          }}>
            {/* Mobile Picture-in-Picture Mode */}
            {isPiPVisible && isMobile && (
              <PictureInPicture
                videoRef={mainVideoRef as React.RefObject<HTMLVideoElement>}
                meetingId={actualMeetingId}
                meetingTitle={meeting?.title || 'Live Stream'}
                participantCount={participants.length}
                onLeaveMeeting={handleLeaveMeetingFromPiP}
                onBackToRoom={handleClosePiP}
                isVisible={isPiPVisible}
                onClose={handleClosePiP}
              />
            )}
      
            {/* Video Player Header - Auto-hide like video player */}
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: isMobile ? '56px' : '70px',
              backgroundColor: isVideoPlayerMode 
                ? (showControls ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0)')
                : '#ffffff',
              borderBottom: isVideoPlayerMode 
                ? (showControls ? '1px solid rgba(255, 255, 255, 0.1)' : 'none')
                : '1px solid #e5e7eb',
              display: (isMobile && (isPiPVisible || isFullscreen)) ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '0 12px' : '0 24px',
              zIndex: 1000,
              boxShadow: isVideoPlayerMode 
                ? (showControls ? '0 2px 10px rgba(0,0,0,0.3)' : 'none')
                : '0 1px 3px rgba(0,0,0,0.1)',
              gap: isMobile ? '8px' : '16px',
              transition: 'all 0.3s ease',
              backdropFilter: isVideoPlayerMode && showControls ? 'blur(10px)' : 'none'
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
                color: isVideoPlayerMode ? '#ffffff' : '#111827',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
              {isMobile ? (meeting?.title || 'Demo Meeting').substring(0, 15) : (meeting?.title || 'Demo Meeting')}
            </div>
              <div style={{ 
                fontSize: isMobile ? '11px' : '14px', 
                color: isVideoPlayerMode ? 'rgba(255, 255, 255, 0.7)' : '#6b7280',
                whiteSpace: 'nowrap'
              }}>
                {isMobile ? (meeting?.inviteCode || actualMeetingId).substring(0, 8) : `Code: ${meeting?.inviteCode || actualMeetingId}`}
            </div>
          </div>
            </div>

            <div style={{ display: 'flex', gap: isMobile ? '4px' : '12px', alignItems: 'center' }}>
            {/* Video Player Mode Toggle */}
            <button
              onClick={() => setIsVideoPlayerMode(!isVideoPlayerMode)}
              style={{
                width: isMobile ? '36px' : '44px',
                height: isMobile ? '36px' : '44px',
                borderRadius: '8px',
                backgroundColor: isVideoPlayerMode 
                  ? 'rgba(74, 108, 247, 0.9)' 
                  : 'rgba(255, 255, 255, 0.1)',
                border: isVideoPlayerMode 
                  ? '1px solid rgba(74, 108, 247, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(10px)'
              }}
              title={isVideoPlayerMode ? 'Exit Video Mode' : 'Enter Video Mode'}
            >
              <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="white">
                {isVideoPlayerMode ? (
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                ) : (
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7v6l5-3-5-3z"/>
                )}
              </svg>
            </button>

            {/* Fullscreen Toggle Button - Video Player Mode */}
            {isVideoPlayerMode && (
              <button
                onClick={toggleFullscreen}
                style={{
                  width: isMobile ? '36px' : '44px',
                  height: isMobile ? '36px' : '44px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)'
                }}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="white">
                  {isFullscreen ? (
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                  ) : (
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                  )}
                </svg>
              </button>
            )}

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
                backgroundColor: '#ef4444',
                borderRadius: '20px',
                fontSize: isMobile ? '10px' : '12px',
                fontWeight: '600',
                color: 'white',
                animation: 'recording 1.5s infinite'
              }}>
                <div style={{
                  width: isMobile ? '5px' : '8px',
                  height: isMobile ? '5px' : '8px',
                  borderRadius: '50%',
                  backgroundColor: 'white'
                }}></div>
                {isMobile ? 'REC' : 'Recording'}
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
                    )}
                  </div>
                )}
              </>
            )}
            
            {/* Toggle Thumbnail Panel Arrow */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setThumbnailPanelOpen(!thumbnailPanelOpen);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setThumbnailPanelOpen(!thumbnailPanelOpen);
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: '8px',
                minWidth: isMobile ? '44px' : 'auto',
                minHeight: isMobile ? '44px' : 'auto',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                zIndex: 1001
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none"
                stroke="#374151"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: thumbnailPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
        </div>
      </div>

        {/* Main Content - Hidden when PiP is active on mobile */}
      <div style={{
        height: '100vh',
          paddingTop: isMobile ? '10px' : '10px',
          display: (isMobile && (isPiPVisible || isFullscreen)) ? 'none' : 'flex',
          flexDirection: 'column', // Always column layout for better organization
          backgroundColor: '#ffffff',
          overflow: 'hidden'
      }}>
          {/* Participant Thumbnails Row - Show when toggled open */}
          {thumbnailPanelOpen && (
            <div 
              className="participant-thumbnails"
              onMouseEnter={() => {
                const leftArrow = document.querySelector('.scroll-arrow-left') as HTMLElement;
                const rightArrow = document.querySelector('.scroll-arrow-right') as HTMLElement;
                if (leftArrow) leftArrow.style.opacity = '1';
                if (rightArrow) rightArrow.style.opacity = '1';
              }}
              onMouseLeave={() => {
                const leftArrow = document.querySelector('.scroll-arrow-left') as HTMLElement;
                const rightArrow = document.querySelector('.scroll-arrow-right') as HTMLElement;
                if (leftArrow) leftArrow.style.opacity = '0';
                if (rightArrow) rightArrow.style.opacity = '0';
              }}
              style={{
                height: isMobile ? '120px' : '140px',
                width: '100%',
              backgroundColor: '#ffffff',
                borderTop: !isMobile ? '1px solid #e5e7eb' : 'none',
                borderBottom: isMobile ? '1px solid #e5e7eb' : 'none',
              display: 'flex',
              alignItems: 'center',
                padding: isMobile ? '0 12px' : '0 24px',
                gap: isMobile ? '12px' : '14px',
                overflowX: isMobile ? 'auto' : 'hidden',
              overflowY: 'hidden',
              marginTop: '0',
              transition: 'all 0.3s ease-in-out',
                position: 'relative',
                scrollbarWidth: isMobile ? 'none' : 'thin',
                scrollbarColor: '#cbd5e1 transparent',
                WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                flexDirection: 'row', // Always horizontal for better desktop layout
                minWidth: 'auto',
                maxWidth: '100%'
              }}>
              {/* Desktop Hover Arrows */}
              {!isMobile && (
                <>
                  {/* Left Arrow */}
                  <div 
                    key="scroll-arrow-left"
                    className="scroll-arrow scroll-arrow-left"
                    style={{
                      position: 'absolute',
                      left: '0',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '40px',
                      height: '40px',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                      zIndex: 10,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0';
                    }}
                    onClick={() => {
                      const container = document.querySelector('.participant-thumbnails');
                      if (container) {
                        container.scrollBy({ left: -200, behavior: 'smooth' });
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </div>

                  {/* Right Arrow */}
                  <div 
                    key="scroll-arrow-right"
                    className="scroll-arrow scroll-arrow-right"
                    style={{
                      position: 'absolute',
                      right: '0',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '40px',
                      height: '40px',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                      zIndex: 10,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0';
                    }}
                    onClick={() => {
                      const container = document.querySelector('.participant-thumbnails');
                      if (container) {
                        container.scrollBy({ left: 200, behavior: 'smooth' });
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </>
              )}

              {(isMobile ? participantsWithHandRaise.slice(0, 2) : participantsWithHandRaise).map((participant, index) => {
                // Check if participant is speaking (from audio level detection)
                const isSpeaking = participant.audioLevel > 0.1 || false;
                
                // Get video and audio tracks from LiveKit room
                let videoTrack = null;
                let audioTrack = null;
                let hasScreenShare = false;
                
                // ✅ FIX: Use user._id as the identity since that's what LiveKit uses
                const participantIdentity = participant.user?._id || participant.identity;
                
                // ✅ CRITICAL FIX: Check if this is the local participant FIRST
                // Compare with multiple possible identity formats
                const isLocalParticipant = liveKitService?.room ? (
                  participantIdentity === liveKitService.room.localParticipant?.identity ||
                  participantIdentity === liveKitService.room.localParticipant?.sid ||
                  participant._id === currentParticipant?._id ||
                  participant.user?._id === currentParticipant?.user?._id ||
                  participant.userId === currentParticipant?.user?._id ||
                  participant.identity === currentParticipant?._id
                ) : false;
                
                if (liveKitService?.room) {
                  
                  if (isLocalParticipant) {
                    // ✅ LOCAL PARTICIPANT: Get camera video track for thumbnail (NOT screen share)
                    // Try multiple ways to find camera track
                    const cameraTrackPub = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                      .find(pub => {
                        const track = pub.track;
                        const source = pub.source || track?.source;
                        return source === 'camera' || (!source && !track?.source?.includes('screen'));
                      });
                    videoTrack = cameraTrackPub?.track;
                    
                    // Check if local participant has screen share active
                    const screenSharePub = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                      .find(pub => pub.track?.source === 'screen_share' || pub.source === 'screen_share');
                    hasScreenShare = !!screenSharePub?.track;
                    
                    const audioTrackPub = Array.from(liveKitService.room.localParticipant.audioTrackPublications.values())[0];
                    audioTrack = audioTrackPub?.track;
                    
                    // Debug logging for local participant (reduced)
                    console.log('🔍 LOCAL PARTICIPANT THUMBNAIL:', {
                      participantName: participant.displayName,
                      cameraTrack: !!videoTrack,
                      screenShare: hasScreenShare,
                      trackCount: liveKitService.room.localParticipant.videoTrackPublications.size
                    });
                    
                    // Local participant tracks retrieved
                  } else {
                    // ✅ REMOTE PARTICIPANT: Get tracks from remoteParticipants
                    const liveKitRoomParticipant = liveKitService.room.remoteParticipants.get(participantIdentity);
                    
                    if (liveKitRoomParticipant) {
                      // ✅ IMPORTANT: Get ONLY camera video track for thumbnail (NOT screen share)
                      const cameraTrackPub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => pub.track?.source === 'camera' || pub.source === 'camera');
                      videoTrack = cameraTrackPub?.track;
                      
                      // Check if this participant has screen share active
                      const screenSharePub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => pub.track?.source === 'screen_share' || pub.source === 'screen_share');
                      hasScreenShare = !!screenSharePub?.track;
                      
                      // Get first audio track publication  
                      const audioTrackPub = Array.from(liveKitRoomParticipant.audioTrackPublications.values())[0];
                      audioTrack = audioTrackPub?.track;
                      
                      // Track publications retrieved
                    }
                  }
                }
                
                // Debug: Check for duplicate participants
                console.log(`🔍 RENDERING PARTICIPANT THUMBNAIL ${index}:`, {
                  participantId: participant._id,
                  name: participant.displayName,
                  index: index
                });

                // Debug: Log thumbnail video track status
                console.log('🔍 THUMBNAIL VIDEO DEBUG:', {
                  participantId: participant._id,
                  name: participant.displayName,
                  hasVideoTrack: !!videoTrack,
                  videoTrackSource: videoTrack?.source,
                  isVideoOff: !videoTrack,
                  isScreenSharing: hasScreenShare
                });

                return (
                  <ParticipantThumbnail
                    key={`${participant._id}-${index}`}
                    participantId={participant._id}
                    name={participant.displayName || 'Unknown'}
                    videoTrack={videoTrack}
                    audioTrack={audioTrack}
                    isSpeaking={isSpeaking}
                    isHandRaised={participant.hasHandRaised}
                    isMuted={participant.micState === 'OFF'}
                    isVideoOff={!videoTrack || !cameraEnabled} // Show video only if track exists AND camera is enabled
                    isHost={participant.role === 'HOST'}
                    isScreenSharing={hasScreenShare}
                    isLocalParticipant={isLocalParticipant}
                    onClick={() => {
                      console.log('🔍 THUMBNAIL CLICKED:', { 
                        participantId: participant._id, 
                        name: participant.displayName,
                        user: participant.user?._id 
                      });
                      setSelectedParticipantId(participant._id);
                    }}
                  />
                );
              })}
              
            </div>
          )}
          
          {/* Main Video Area */}
          <div style={{
            flex: 1, // Take up remaining space
            backgroundColor: queueState.screenShareMode ? '#000000' : '#f3f4f6',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0, // Allow flex shrinking
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: queueState.screenShareMode ? '0' : (isMobile ? '20px' : '40px'),
            paddingTop: queueState.screenShareMode ? '0' : (isMobile ? '20px' : '40px'),
            marginTop: '0',
            overflow: 'hidden'
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
            
            {/* View Controls Toggle Button - Desktop Only, Hidden during screen share */}
            {!isMobile && !queueState.screenShareMode && (
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

            {/* Selected Participant Indicator */}
            {selectedParticipant && (
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
                backgroundColor: '#3b82f6',
                border: '2px solid #2563eb',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
                color: 'white',
              zIndex: 1000,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
                👤 {selectedParticipant.displayName || 'Selected Participant'}
            </div>
            )}
            

            {/* LiveKit Connection Status */}
            <div style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: isLiveKitConnected ? '#d1fae5' : '#fef2f2',
              border: `2px solid ${isLiveKitConnected ? '#10b981' : '#ef4444'}`,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: isLiveKitConnected ? '#065f46' : '#991b1b',
              zIndex: 1000,
              boxShadow: `0 4px 12px rgba(${isLiveKitConnected ? '16, 185, 129' : '239, 68, 68'}, 0.3)`
            }}>
              {isLiveKitConnected ? '🎥 LiveKit Connected' : '❌ LiveKit Disconnected'}
              {isLiveKitConnecting && ' (Connecting...)'}
              {isLiveKitConnected && liveKitParticipants.size === 0 && ' (No Participants)'}
            </div>
            
            {/* Debug Info */}

            {/* Hand Raise Indicator - Host Notifications (handled by component) */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }}>
              <HandRaiseIndicator
                socket={socket}
                isConnected={wsConnected}
                meetingId={actualMeetingId}
                currentParticipant={currentParticipant}
                isHost={isHost}
                mode="indicator"
                onHandRaiseStatusChange={handleHandRaiseStatusChange}
                onRaisedHandsChange={handleRaisedHandsChange}
              />
            </div>

            {/* Main Video Content Area */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              height: '100%'
            }}>
              {/* Participant Queue Display with LiveKit */}
              {(() => {
                
                return null;
              })()}
              {(() => {
                // Always render main stage if we have participants (either from LiveKit or memoized)
                const hasParticipants = (isLiveKitConnected && liveKitParticipants.size > 0) || memoizedParticipants.length > 0;
                
                if (!hasParticipants) {
                  return null;
                }
              
              // Get the participant for main stage (selected or active speaker or first available)
              const mainParticipant = selectedParticipant || memoizedActiveSpeaker || memoizedParticipants[0];
              if (!mainParticipant) {
                return null;
              }
              
              // Debug logging for main stage participant selection
              console.log('🔍 MAIN STAGE PARTICIPANT:', {
                selectedParticipantId: selectedParticipantId,
                selectedParticipant: selectedParticipant ? { id: selectedParticipant._id, name: selectedParticipant.displayName } : null,
                activeSpeaker: memoizedActiveSpeaker ? { id: memoizedActiveSpeaker._id, name: memoizedActiveSpeaker.displayName } : null,
                mainParticipant: { id: mainParticipant._id, name: mainParticipant.displayName, user: mainParticipant.user?._id }
              });

                // Get video and audio tracks for main stage
                let mainVideoTrack = null;
                let mainAudioTrack = null;
                let mainScreenShareTrack = null;
                let isParticipantScreenSharing = false;

                // ✅ FIX: Use user._id as the identity since that's what LiveKit uses (same as thumbnails)
                const participantIdentity = mainParticipant.user?._id || mainParticipant.identity;
                
                if (liveKitService?.room && mainParticipant._id) {
                  
                  // ✅ CRITICAL FIX: Check if this is the local participant FIRST
                  // Compare with multiple possible identity formats (same as thumbnails)
                  const isLocalParticipant = (
                    participantIdentity === liveKitService.room.localParticipant?.identity ||
                    participantIdentity === liveKitService.room.localParticipant?.sid ||
                    mainParticipant._id === currentParticipant?._id ||
                    mainParticipant.user?._id === currentParticipant?.user?._id ||
                    mainParticipant.userId === currentParticipant?.user?._id ||
                    mainParticipant.identity === currentParticipant?._id
                  );
                  
                  if (isLocalParticipant) {
                    // Local participant - get tracks from localParticipant
                    
                    // Get CAMERA video track (not screen share)
                    const cameraTrackPub = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                      .find(pub => pub.track?.source === 'camera' || pub.source === 'camera');
                    mainVideoTrack = cameraTrackPub?.track;
                    
                    const audioTrackPub = Array.from(liveKitService.room.localParticipant.audioTrackPublications.values())[0];
                    mainAudioTrack = audioTrackPub?.track;
                    
                    // Check for screen share
                    const screenShareTrackPub = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                      .find(pub => pub.track?.source === 'screen_share' || pub.source === 'screen_share');
                    mainScreenShareTrack = screenShareTrackPub?.track;
                    isParticipantScreenSharing = !!mainScreenShareTrack;
                  } else {
                    // Remote participant - get tracks from remoteParticipants
                    const liveKitRoomParticipant = liveKitService.room.remoteParticipants.get(participantIdentity);
                    
                    if (liveKitRoomParticipant) {
                      // Get CAMERA video track (not screen share)
                      const cameraTrackPub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => pub.track?.source === 'camera' || pub.source === 'camera');
                      mainVideoTrack = cameraTrackPub?.track;
                      
                      const audioTrackPub = Array.from(liveKitRoomParticipant.audioTrackPublications.values())[0];
                      mainAudioTrack = audioTrackPub?.track;
                      
                      // Check for screen share
                      const screenShareTrackPub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => pub.track?.source === 'screen_share' || pub.source === 'screen_share');
                      mainScreenShareTrack = screenShareTrackPub?.track;
                      isParticipantScreenSharing = !!mainScreenShareTrack;
                    }
                  }
                } else {
                  // Fallback: Set video tracks to null for memoized participants
                  mainVideoTrack = null;
                  mainAudioTrack = null;
                  mainScreenShareTrack = null;
                  isParticipantScreenSharing = false;
                }

                // Check if main participant is local participant
                const isMainParticipantLocal = liveKitService?.room ? (
                  participantIdentity === liveKitService.room.localParticipant?.identity ||
                  participantIdentity === liveKitService.room.localParticipant?.sid ||
                  mainParticipant._id === currentParticipant?._id ||
                  mainParticipant.user?._id === currentParticipant?.user?._id ||
                  mainParticipant.userId === currentParticipant?.user?._id ||
                  mainParticipant.identity === currentParticipant?._id
                ) : false;

                // Debug: Log video track status
                console.log('🔍 MAIN STAGE VIDEO DEBUG:', {
                  participantId: mainParticipant._id,
                  name: mainParticipant.displayName,
                  hasVideoTrack: !!mainVideoTrack,
                  videoTrackSource: mainVideoTrack?.source,
                  isVideoOff: !mainVideoTrack,
                  isScreenSharing: isParticipantScreenSharing
                });

                return (
                  <MainStageView
                    participantId={mainParticipant._id}
                    name={mainParticipant.displayName || 'Main Stage'}
                    videoTrack={mainVideoTrack}
                    audioTrack={mainAudioTrack}
                    isSpeaking={(mainParticipant.audioLevel || 0) > 0.1}
                    isHandRaised={mainParticipant.hasHandRaised || false}
                    isMuted={mainParticipant.micState === 'OFF' || false}
                    isVideoOff={!mainVideoTrack || !cameraEnabled} // Show video only if track exists AND camera is enabled
                    isHost={mainParticipant.role === 'HOST' || false}
                    isScreenSharing={isParticipantScreenSharing}
                    screenShareTrack={mainScreenShareTrack}
                    connectionQuality={5} // TODO: Get actual connection quality
                    isLocalParticipant={isMainParticipantLocal}
                    onParticipantClick={(participantId) => {
                      const participant = memoizedParticipants.find(p => p._id === participantId);
                      if (participant) {
                        setSelectedParticipantId(participantId);
                        // Main stage participant selected
                      }
                    }}
                  />
                );
              })()}
            {!isLiveKitConnected || liveKitParticipants.size === 0 ? (
              <ParticipantQueue
                participants={queueState.participants}
                activeSpeaker={queueState.activeSpeaker}
                screenShareMode={queueState.screenShareMode}
                screenShareParticipant={queueState.screenShareParticipant}
                selectedParticipant={selectedParticipant}
                onParticipantClick={(participant) => {
                  setSelectedParticipantId(participant._id);
                }}
                onHandRaiseClick={(participant) => {
                  updateHandRaiseStatus(participant._id, false);
                }}
                onKickParticipant={(participant) => {
                  handleKickParticipant(participant._id);
                }}
                isHost={isHost}
                viewMode={viewMode}
                maxThumbnails={6}
              />
            ) : null}
            </div>
          </div>

          {/* Video Player Control Bar - Auto-hide */}
          <div style={{
            height: isMobile ? '70px' : '80px',
            backgroundColor: isVideoPlayerMode 
              ? (showControls ? 'rgba(0, 0, 0, 0.9)' : 'transparent')
              : '#ffffff',
            borderTop: isVideoPlayerMode 
              ? (showControls ? '1px solid rgba(255, 255, 255, 0.1)' : 'none')
              : '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '0 12px' : '0 24px',
            boxShadow: isVideoPlayerMode 
              ? (showControls ? '0 -2px 10px rgba(0,0,0,0.3)' : 'none')
              : '0 -2px 8px rgba(0,0,0,0.1)',
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            flexShrink: 0,
            transition: 'all 0.3s ease',
            transform: isVideoPlayerMode 
              ? (showControls ? 'translateY(0)' : 'translateY(100%)')
              : 'translateY(0)',
            backdropFilter: isVideoPlayerMode && showControls ? 'blur(10px)' : 'none'
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
                {(() => {
                  return participants.length;
                })()}
              </div>
              
                {/* Mic Control - Video Player Style */}
                <button
                  onClick={handleMicToggle}
                  style={{
                    width: isMobile ? '44px' : '52px',
                    height: isMobile ? '44px' : '52px',
                    borderRadius: '50%',
                    backgroundColor: isVideoPlayerMode 
                      ? (micEnabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)')
                      : (micEnabled ? '#22c55e' : '#ef4444'),
                    border: isVideoPlayerMode ? '2px solid rgba(255, 255, 255, 0.2)' : 'none',
                    cursor: 'pointer',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: isVideoPlayerMode 
                      ? '0 4px 12px rgba(0,0,0,0.3)'
                      : '0 2px 8px rgba(0,0,0,0.15)',
                    backdropFilter: isVideoPlayerMode ? 'blur(10px)' : 'none'
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

              {/* Hand Raise Control - Now handled by HandRaiseIndicator */}
              <HandRaiseIndicator
                socket={socket}
                isConnected={wsConnected}
                meetingId={actualMeetingId}
                currentParticipant={currentParticipant}
                isHost={isHost}
                isMobile={isMobile}
                mode="button"
                onHandRaiseStatusChange={handleHandRaiseStatusChange}
                onRaisedHandsChange={handleRaisedHandsChange}
              />

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

      {/* Sidebar - Hidden when PiP is active on mobile */}
      {sidebarOpen && !(isMobile && isPiPVisible) && (
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
                <div key="participants-tab" style={{ padding: '16px' }}>
                  {participantsWithHandRaise.map((participant, index) => (
                    <div key={`${participant._id}-${index}`} style={{
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
                <div key="chat-tab" style={{
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
        </div>
      </>
    );
  });

ProfessionalLiveStreamRoom.displayName = 'ProfessionalLiveStreamRoom';

export default ProfessionalLiveStreamRoom;