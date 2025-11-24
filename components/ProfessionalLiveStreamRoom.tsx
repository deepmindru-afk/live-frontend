import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import ClientSideRecording from './ClientSideRecording';

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
  HOST_LOWER_HAND,
} from '../apollo/livestream/mutations';
import {
  START_RECORDING,
  STOP_RECORDING,
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
import { Track } from 'livekit-client';
import { useParticipantQueue, Participant } from '../hooks/useParticipantQueue';
import { useAudioLevelDetection } from '../hooks/useAudioLevelDetection';
import { useLiveKit } from '../hooks/useLiveKit';
import { WhiteboardComponent } from './whiteboard';
import { useWhiteboard } from '../hooks/whiteboard';
import { apolloClient } from '../apollo/client';

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

const REDIRECT_URL = 'https://hrdeedu.co.kr';

const ProfessionalLiveStreamRoom: React.FC<ProfessionalLiveStreamRoomProps> = memo(({
  meetingId: propMeetingId,
  role = 'HOST',
  userId = 'p1'
}) => {
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
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false);
  const [isRecordingUploading, setIsRecordingUploading] = useState(false); // ✅ Track upload status
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [isHostState, setIsHostState] = useState(false);
  // Clear audio/video preferences from prejoin page (stored in sessionStorage)
  const clearPrejoinPreference = (key: string): void => {
    try {
      if (sessionStorage.getItem(key) !== null) {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
    }
  };

  useEffect(() => {
    clearPrejoinPreference('prejoin_audio_enabled');
    clearPrejoinPreference('prejoin_video_enabled');
  }, []);

  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('speaker');
  const [gridSize, setGridSize] = useState<'2x2' | '3x3' | '4x4'>('2x2');
  const [isMobile, setIsMobile] = useState(false);
  const [isIOSPlatform, setIsIOSPlatform] = useState(false);
  const viewportHeightValue = 'var(--ios-viewport-height, 100vh)';
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
  const [pendingHostTransferExit, setPendingHostTransferExit] = useState(false);
  const [pendingHostTransferUserId, setPendingHostTransferUserId] = useState<string | null>(null);
  
  // --- HAND RAISE: host notifications + state ---
  const [raisedHandNotices, setRaisedHandNotices] = useState<Array<{id:string;name:string;at:number}>>([]);
  
  // Throttling for participant list updates
  const lastUpdateRef = useRef(0);
  
  // ✅ ID NORMALIZATION HELPER: Handle different ID field patterns
  const getParticipantIdentity = (participant: any): string | null => {
    return participant?.user?._id || participant?.userId || participant?.identity || participant?._id || null;
  };
  
  const matchesParticipantId = (participant: any, targetId: string): boolean => {
    const identity = getParticipantIdentity(participant);
    const participantId = participant?._id;
    const userId = participant?.userId;
    
    return identity === targetId || participantId === targetId || userId === targetId || participant?.user?._id === targetId;
  };
  
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nav = window.navigator;
    const detectIOS = () => {
      const platform = nav?.platform || '';
      const userAgent = nav?.userAgent || '';
      return /iP(ad|hone|od)/i.test(userAgent) || (platform === 'MacIntel' && (nav?.maxTouchPoints || 0) > 1);
    };

    const iosDetected = detectIOS();
    setIsIOSPlatform(iosDetected);

    const root = document.documentElement;
    const updateViewportHeight = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty('--ios-viewport-height', `${height}px`);
    };

    updateViewportHeight();

    if (!iosDetected) {
      return () => {
        root.style.removeProperty('--ios-viewport-height');
      };
    }

    const viewport = window.visualViewport;

    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    viewport?.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      viewport?.removeEventListener('resize', updateViewportHeight);
      root.style.removeProperty('--ios-viewport-height');
    };
  }, []);

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
          joinedAt: p.sessions?.[0]?.joinedAt || p.createdAt || '2024-01-01T00:00:00.000Z',
        isHost: p.role === 'HOST',
        role: p.role,
        isHandRaised: Boolean(p.isHandRaised || p.hasHandRaised),
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
            prev?.isHandRaised !== curr.isHandRaised) {
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
  
  // ✅ CRITICAL FIX: Reset screen share mode immediately on component mount
  // This prevents black screen after page refresh
  const hasResetOnMount = useRef(false);
  useEffect(() => {
    // Reset screen share mode on mount - this runs before LiveKit connects
    if (!hasResetOnMount.current && queueState.screenShareMode) {
      hasResetOnMount.current = true;
      stopQueueScreenShare();
    }
  }, [queueState.screenShareMode, stopQueueScreenShare]);
  
  // ✅ CRITICAL FIX: Derive selectedParticipant from ID to prevent reference issues
  // Use a ref to store the previous selected participant to maintain reference stability
  const selectedParticipantRef = useRef<any>(null);
  
  const selectedParticipant = useMemo(() => {
    
    if (!selectedParticipantId) {
      // ✅ MOBILE FIX: If no participant selected and on mobile, use first participant
      if (isMobile && memoizedParticipants.length > 0) {
        const firstParticipant = memoizedParticipants[0];
        selectedParticipantRef.current = firstParticipant;
        return firstParticipant;
      }
      selectedParticipantRef.current = null;
      return null;
    }
    
    // ✅ FIX: Look in memoizedParticipants instead of queueState.participants
    // because memoizedParticipants has the correct _id structure that matches what we set from thumbnails
    const found = memoizedParticipants.find(p => p._id === selectedParticipantId);
    
    // Only update the ref if the participant ID changed or the participant object is different
    if (!found) {
      // ✅ MOBILE FALLBACK: If selected participant not found and on mobile, use first participant
      if (isMobile && memoizedParticipants.length > 0) {
        const firstParticipant = memoizedParticipants[0];
        selectedParticipantRef.current = firstParticipant;
        return firstParticipant;
      }
      selectedParticipantRef.current = null;
      return null;
    }
    
    // Check if we need to update the ref (ID changed or first time)
    if (!selectedParticipantRef.current || selectedParticipantRef.current._id !== found._id) {
      selectedParticipantRef.current = found;
    }
    
    // Always return the cached reference to prevent prop changes
    return selectedParticipantRef.current;
  }, [selectedParticipantId, memoizedParticipants, isMobile]);
  
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
    // Participant selection only updates the main video display - no navigation needed
  }, []);
  
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

  // Auto-close thumbnail panel when grid mode is active
  useEffect(() => {
    if (viewMode === 'grid') {
      setThumbnailPanelOpen(false);
    }
  }, [viewMode]);

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
    serverNumber: liveKitServerNumber,
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
      // 중요 수정: 트랙이 구독되면 즉시 화면 공유 모드 강제
      // 상태를 즉시 업데이트하여 10초 지연 감소
      const source = publication.source || track?.source;
      const isScreenShare = source === Track.Source.ScreenShare;
      
      if (isScreenShare) {
        const participantIdentity = participant?.identity || participant?.name;
        const sharingParticipant = memoizedParticipants.find(p => 
          p.identity === participantIdentity ||
          p._id === participantIdentity ||
          p.user?._id === participantIdentity
        );
        
        if (sharingParticipant && !queueState.screenShareMode) {
          const whiteboardHostId = sharingParticipant.identity || sharingParticipant._id || sharingParticipant.user?._id;
          if (whiteboardHostId) {
            startQueueScreenShare(whiteboardHostId);
          }
        }
      }
    },
    onError: (error: Error) => {
      // Handle banned user errors or authentication errors - redirect to hrdeedu.co.kr
      if (error.message && (
        error.message.includes('removed from this meeting') ||
        error.message.includes('UNAUTHENTICATED') ||
        error.message.includes('No authentication token') ||
        error.message.includes('Invalid authentication token') ||
        error.message.includes('User not found')
      )) {
        window.location.href = REDIRECT_URL;
      }
    }
  });
  
  // ✅ FIX: Check for actual screen share track, not just queue state
  // This prevents black screen when screen share state is true but no track exists
  const isActuallyScreenSharing = useMemo(() => {
    if (!queueState.screenShareMode) return false;
    
    // Check if there's actually a screen share track active
    const hasActualScreenShareTrack = liveKitService?.room && (
      Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
        .some(pub => {
          const source = pub.source || pub.track?.source;
          return source === Track.Source.ScreenShare && pub.track;
        }) ||
      Array.from(liveKitService.room.remoteParticipants.values())
        .some(participant => 
          Array.from(participant.videoTrackPublications.values())
            .some(pub => {
              const source = pub.source || pub.track?.source;
              return source === Track.Source.ScreenShare && pub.track;
            })
        )
    );
    
    // Only use screen share mode if both queue state AND actual track exist
    return queueState.screenShareMode && !!hasActualScreenShareTrack;
  }, [queueState.screenShareMode, liveKitService?.room]);

  // ✅ CRITICAL FIX: Sync LiveKit screen sharing state with queue state
  // ✅ FIX: Reset screen share mode on mount/refresh if no actual screen share track exists
  useEffect(() => {
    // ✅ FIX: Always reset screen share mode when not connected (e.g., after page refresh)
    if (!isLiveKitConnected) {
      if (queueState.screenShareMode) {
        stopQueueScreenShare();
      }
      return;
    }
    
    // ✅ FIX: Wait a bit for LiveKit to fully initialize before checking tracks
    // This prevents race conditions where tracks haven't loaded yet
    const checkScreenShare = setTimeout(() => {
      if (!liveKitService?.room) {
        if (queueState.screenShareMode) {
          stopQueueScreenShare();
        }
        return;
      }
      
      // ✅ FIX: Check for actual screen share tracks, not just the state
      const hasActualScreenShare = liveKitService?.room && (
        // Check local participant
        Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
          .some(pub => {
            const source = pub.source || pub.track?.source;
            return source === Track.Source.ScreenShare && pub.track;
          }) ||
        // Check remote participants
        Array.from(liveKitService.room.remoteParticipants.values())
          .some(participant => 
            Array.from(participant.videoTrackPublications.values())
              .some(pub => {
                const source = pub.source || pub.track?.source;
                return source === Track.Source.ScreenShare && pub.track;
              })
          )
      );
      
      if (!hasActualScreenShare && queueState.screenShareMode) {
        // No actual screen share track exists, but queue state says screen sharing is active
        // This happens after page refresh - reset the state immediately
        stopQueueScreenShare();
        return;
      }
      
      if (hasActualScreenShare && !queueState.screenShareMode && currentParticipant?._id) {
        // LiveKit has screen sharing active, update queue state
        // Find the participant who is sharing
        let sharingParticipantId = currentParticipant._id;
        
        // Check if it's a remote participant sharing
          for (const [identity, participant] of liveKitService.room.remoteParticipants.entries()) {
            const hasScreenShare = Array.from(participant.videoTrackPublications.values())
              .some(pub => {
                const source = pub.source || pub.track?.source;
                return source === Track.Source.ScreenShare && pub.track;
              });
          
          if (hasScreenShare) {
            // Find matching participant in our list
            const matchingParticipant = memoizedParticipants.find(p => 
              p.identity === identity || p._id === identity || p.user?._id === identity
            );
            if (matchingParticipant) {
              sharingParticipantId = matchingParticipant._id;
              break;
            }
          }
        }
        
        startQueueScreenShare(sharingParticipantId);
      }
    }, 500); // Wait 500ms for LiveKit to initialize
    
    return () => clearTimeout(checkScreenShare);
  }, [liveKitIsScreenSharing, isLiveKitConnected, currentParticipant?._id, queueState.screenShareMode, startQueueScreenShare, stopQueueScreenShare, liveKitService, memoizedParticipants]);
  
  // Update isHostState when currentParticipant changes
  useEffect(() => {
    setIsHostState(currentParticipant?.role === 'HOST');
  }, [currentParticipant?.role]);
  
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
  
  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording && recordingStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - recordingStartTime.getTime()) / 1000);
        setRecordingDuration(duration);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, recordingStartTime]);
  
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

const meeting = meetingData && typeof meetingData === 'object' && 'getMeetingById' in meetingData ? meetingData.getMeetingById as any : null;

const normalizeId = useCallback((value: any): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value === 'object') {
    if ('toString' in value && typeof (value as any).toString === 'function') {
      const converted = (value as any).toString();
      if (typeof converted === 'string') {
        const trimmed = converted.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
    }
    if ('_id' in value && typeof (value as any)._id === 'string') {
      const trimmed = (value as any)._id.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
}, []);

const userIdentifierValues = useMemo(() => {
  const ids = new Set<string>();
  const add = (value: any) => {
    const normalized = normalizeId(value);
    if (normalized) {
      ids.add(normalized);
    }
  };

  add(currentParticipant?._id);
  add((currentParticipant as any)?.backendId);
  add(currentParticipant?.identity);
  add(currentParticipant?.participantId);
  add(currentParticipant?.user?._id);
  add(currentParticipant?.userId);
  add(currentParticipant?.user?.id);
  add(currentParticipant?.id);
  add(currentUser?._id);
  add(currentUser?.id);
  add(actualUserId);

  return Array.from(ids);
}, [
  normalizeId,
  currentParticipant?._id,
  (currentParticipant as any)?.backendId,
  currentParticipant?.identity,
  currentParticipant?.participantId,
  currentParticipant?.user?._id,
  currentParticipant?.userId,
  currentParticipant?.user?.id,
  currentParticipant?.id,
  currentUser?._id,
  currentUser?.id,
  actualUserId
]);

const userIdentifierSet = useMemo(() => {
  return new Set<string>(userIdentifierValues.filter(id => typeof id === 'string' && id.trim().length > 0));
}, [userIdentifierValues]);

const enhanceParticipantMediaState = useCallback((participant: any) => {
  const identifiers = new Set<string>();
  const add = (value: any) => {
    const normalized = normalizeId(value);
    if (normalized) {
      identifiers.add(normalized);
    }
  };

  add(participant?._id);
  add((participant as any)?.backendId);
  add(participant?.identity);
  add(participant?.participantId);
  add(participant?.user?._id);
  add(participant?.userId);
  add(participant?.user?.id);

  const isCurrentUserParticipant = Array.from(identifiers).some(id => userIdentifierSet.has(id));

  if (isCurrentUserParticipant) {
    return {
      ...participant,
      micState: micEnabled ? 'ON' : 'OFF',
      isMuted: !micEnabled,
      cameraState: cameraEnabled ? 'ON' : 'OFF',
      isCameraOff: !cameraEnabled
    };
  }

  return participant;
}, [normalizeId, userIdentifierSet, micEnabled, cameraEnabled]);

const meetingCurrentHostId = normalizeId(meeting?.currentHostId) || normalizeId(meeting?.hostId);
const isCurrentHostById = meetingCurrentHostId ? userIdentifierValues.includes(meetingCurrentHostId) : false;
// Strict host check - must be actual meeting host, not just system admin/tutor
// Only show Active Students to actual meeting hosts
const isHost = currentParticipant?.role === 'HOST' || role === 'HOST' || isCurrentHostById;

// For recording, ONLY allow the actual meeting host (not system admins)
const isMeetingHost = currentParticipant?.role === 'HOST' || isCurrentHostById;

const canShareScreen = useMemo(() => {
  const isSystemAdmin = currentUser?.systemRole === 'TUTOR' || currentUser?.systemRole === 'ADMIN';

  if (isSystemAdmin) {
    return true;
  }

  if (isCurrentHostById) {
    return true;
  }

  if (!currentParticipant) {
    return false;
  }

  if (currentParticipant.role === 'HOST') {
    return true;
  }

  const currentId =
    normalizeId(currentParticipant._id) ||
    normalizeId((currentParticipant as any)?.backendId) ||
    normalizeId(currentParticipant.user?._id) ||
    normalizeId(currentParticipant.userId) ||
    normalizeId(currentParticipant.id);

  if (!currentId) {
    return false;
  }

  return memoizedParticipants.some(p => {
    const participantId =
      normalizeId(p._id) ||
      normalizeId((p as any)?.backendId) ||
      normalizeId(p.user?._id) ||
      normalizeId(p.userId) ||
      normalizeId((p as any)?.id);
    if (!participantId) {
      return false;
    }
    return participantId === currentId && p.role === 'HOST';
  });
}, [currentParticipant, currentUser?.systemRole, memoizedParticipants, isCurrentHostById, normalizeId]);

// Whiteboard state and hook
const [isWhiteboardMode, setIsWhiteboardMode] = useState(false);
const {
  isWhiteboardActive,
  isStreaming: isWhiteboardStreaming,
  startWhiteboard,
  stopWhiteboard,
  error: whiteboardError,
} = useWhiteboard({
  meetingId: actualMeetingId,
  isHost: isHost || currentParticipant?.role === 'HOST' || currentUser?.systemRole === 'TUTOR' || currentUser?.systemRole === 'ADMIN',
  liveKitService,
  onStreamReady: (stream) => {
    // 화이트보드 스트림이 준비되면 큐 화면 공유 모드 시작
    // 중요 수정: participant._id 대신 currentUser._id (LiveKit identity) 사용
    const whiteboardHostId = currentUser?._id || currentParticipant?.user?._id || currentParticipant?._id;
    if (whiteboardHostId) {
      startQueueScreenShare(whiteboardHostId);
      setIsWhiteboardMode(true);
    } else {
      console.error('[Whiteboard] 유효한 참가자 ID를 찾을 수 없어 화면 공유를 시작할 수 없음');
    }
  },
  onStreamStopped: () => {
    stopQueueScreenShare();
    setIsWhiteboardMode(false);
  },
  onWhiteboardStateChange: (active) => {
    setIsWhiteboardMode(active);
  },
});

// 재초기화 루프 방지를 위해 화이트보드 콜백 메모이제이션
const handleWhiteboardStreamReady = useCallback((stream: MediaStream) => {
  startWhiteboard(stream);
}, [startWhiteboard]);

const handleWhiteboardStreamStopped = useCallback(() => {
  stopWhiteboard();
}, [stopWhiteboard]);

// 화이트보드 토글 핸들러 - 즉각적인 응답을 위해 최적화
const handleWhiteboardToggle = useCallback(() => {
  if (isWhiteboardActive) {
    // 화이트보드 중지 - await하지 않고 백그라운드에서 비동기로 실행
    stopWhiteboard().then(() => {
      setIsWhiteboardMode(false);
    }).catch(err => {
      console.error('[WhiteboardToggle] 화이트보드 중지 오류:', err);
      setIsWhiteboardMode(false); // 중지가 실패해도 UI 업데이트
    });
  } else {
    const isScreenShareRunning = liveKitIsScreenSharing || queueState.screenShareMode;
    if (isScreenShareRunning) {
      Swal.fire({
        icon: 'warning',
        title: '펜 도구를 열 수 없습니다',
        text: '현재 화면 공유가 진행 중입니다. 화면 공유를 종료한 뒤 펜 도구를 사용해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }
    // 화이트보드 시작 - 즉시 UI 업데이트
    setIsWhiteboardMode(true);
    // WhiteboardComponent가 스트림 생성을 처리하고 onStreamReady를 호출함
    // 그러면 startWhiteboard(stream)이 호출됨
  }
}, [isWhiteboardActive, stopWhiteboard, liveKitIsScreenSharing, queueState.screenShareMode]);

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
  const [hostLowerHand] = useMutation(HOST_LOWER_HAND);
  const [transferHost] = useMutation(TRANSFER_HOST);
  const [removeParticipant] = useMutation(REMOVE_PARTICIPANT);
  
  // Hand raise status update callback - WebSocket handles backend updates
  const handleHandRaiseStatusChange = useCallback(async (participantId: string, isRaised: boolean) => {
    // Update local state for immediate UI feedback
    // Backend updates are handled by WebSocket events in HandRaiseIndicator
    updateHandRaiseStatus(participantId, isRaised);
  }, [updateHandRaiseStatus]);

  
  // Recording mutations - Disabled for client-side recording
  // const [startRecordingMutation] = useMutation(START_RECORDING);
  // const [stopRecordingMutation] = useMutation(STOP_RECORDING);

  // WebSocket connection for real-time features
  const webSocketToken = currentUser?.token || localStorage.getItem('jwt') || localStorage.getItem('token') || '';
  
  const { socket, isConnected: wsConnected } = useWebSocketChat({
    meetingId: actualMeetingId,
    token: webSocketToken,
    onMessage: (message: any) => {
      if ((message as any).type === 'PARTICIPANT_STATE_UPDATE') {
        setParticipants(prev => prev.map(p => matchesParticipantId(p, (message as any).userId) ? { ...p, micState: (message as any).micState || p.micState, cameraState: (message as any).cameraState || p.cameraState } : p));
      }
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
      // WebSocket error - check for authentication errors
      if (error && (
        (error as any).message?.includes('UNAUTHENTICATED') ||
        (error as any).message?.includes('No authentication token') ||
        (error as any).message?.includes('Invalid authentication token') ||
        (error as any).message?.includes('Connection failed')
      )) {
        window.location.href = REDIRECT_URL;
      }
    },
    // Hand raise events are handled through participants data changes
  });

  // Note: Meeting room joining is now handled automatically by the new presence system
  // when the WebSocket connects via JOIN_MEETING and HEARTBEAT events

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

      // Listen for meeting ended event
      socket.on('MEETING_ENDED', async (data) => {
        await Swal.fire({
          icon: 'info',
          title: '회의 종료',
          text: '호스트가 회의를 종료했습니다.',
          confirmButtonText: '확인'
        });
        router.push('/dashboard');
      });

      return () => {
        socket.off('PARTICIPANT_ADMITTED');
        socket.off('MEETING_STATUS_CHANGED');
        socket.off('PARTICIPANT_LEFT_WAITING');
        socket.off('MEETING_ENDED');
      };
    }
  }, [socket, actualMeetingId, refetchParticipants, router]);

  // 🎯 Live mic/camera state updates from backend or other participants
  useEffect(() => {
    if (!socket) return () => {};

    const handleParticipantStateUpdate = (update: any) => {
      setParticipants((prev) =>
        prev.map((p) =>
          matchesParticipantId(p, update.userId)
            ? {
                ...p,
                micState: update.micState ?? p.micState,
                cameraState: update.cameraState ?? p.cameraState,
              }
            : p
        )
      );
    };

    socket.on('PARTICIPANT_STATE_UPDATE', handleParticipantStateUpdate);

    return () => socket.off('PARTICIPANT_STATE_UPDATE', handleParticipantStateUpdate);
  }, [socket]);

  // --- HAND RAISE: host notifications + state ---
  useEffect(() => {
    if (!socket) return;

    const handleHandRaised = (data: {userId:string; displayName:string; raisedAt:Date}) => {
      // toast - centered at top of screen
      try {
        const toast = document.createElement('div');
        toast.textContent = `${data.displayName}님이 손을 들었습니다 ✋`;
        Object.assign(toast.style, {
          position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)', 
          background:'#3b82f6', color:'#fff',
          padding:'12px 20px', borderRadius:'12px', fontSize:'16px', fontWeight:'600',
          boxShadow:'0 4px 12px rgba(0,0,0,0.3)',
          zIndex:'9999', whiteSpace:'nowrap'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } catch {}

      // reflect in participants state so thumbnails/MainStage get isHandRaised=true
      setParticipants(prev =>
        prev.map(p => matchesParticipantId(p, data.userId) ? { ...p, isHandRaised: true, hasHandRaised: true, handRaisedAt: data.raisedAt || new Date().toISOString() } : p)
      );

      // ✅ CRITICAL FIX: Immediately update queue with hand raise status for proper sorting
      // Find participant in queue by matching userId - check ALL possible ID fields
      
      const queueParticipant = queueState.participants.find(p => {
        const matches = 
          p._id === data.userId || 
          p.userId === data.userId || 
          p.user?._id === data.userId ||
          (p as any).backendId === data.userId ||
          p.identity === data.userId ||
          // Also check memoizedParticipants for additional ID matching
          memoizedParticipants.some(mp => 
            (mp._id === data.userId || (mp as any).backendId === data.userId) &&
            (mp._id === p._id || mp.user?._id === p._id || (mp as any).backendId === p._id)
          );
        return matches;
      });
      
      if (queueParticipant) {
        updateHandRaiseStatus(queueParticipant._id, true);
      } else {
        // Fallback: Try to find by displayName and update all matching participants
        const foundByName = queueState.participants.find(p => p.displayName === data.displayName);
        if (foundByName) {
          updateHandRaiseStatus(foundByName._id, true);
        }
      }

      // tiny notice list if you want to render somewhere
      setRaisedHandNotices(prev => [{id:data.userId, name:data.displayName, at:Date.now()}, ...prev].slice(0,5));
    };

    // 🔔 Play chime sound for host
    const chimeData = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
    const playChime = () => {
      try {
        const audio = new Audio(chimeData);
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch (err) {
      }
    };

    const handleHandLowered = (data: {userId:string; displayName:string}) => {
      // Update participant state so thumbnails/MainStage get isHandRaised=false
      setParticipants(prev =>
        prev.map(p => matchesParticipantId(p, data.userId) ? { ...p, isHandRaised: false, hasHandRaised: false } : p)
      );

      // ✅ CRITICAL FIX: Immediately update queue with hand lower status for proper sorting
      const queueParticipant = queueState.participants.find(p => 
        p._id === data.userId || 
        p.userId === data.userId || 
        p.user?._id === data.userId ||
        (p as any).backendId === data.userId ||
        p.identity === data.userId ||
        // Also check memoizedParticipants for additional ID matching
        memoizedParticipants.some(mp => 
          (mp._id === data.userId || (mp as any).backendId === data.userId) &&
          (mp._id === p._id || mp.user?._id === p._id || (mp as any).backendId === p._id)
        )
      );
      if (queueParticipant) {
        updateHandRaiseStatus(queueParticipant._id, false);
      } else {
        // Fallback: Try to find by displayName
        const foundByName = queueState.participants.find(p => p.displayName === data.displayName);
        if (foundByName) {
          updateHandRaiseStatus(foundByName._id, false);
        }
      }

      // Remove from notices
      setRaisedHandNotices(prev => prev.filter(n => n.id !== data.userId));
    };

    const handleHandLoweredByHost = (data: {userId:string; displayName:string; hostId?:string}) => {
      // Update participant state so thumbnails/MainStage get isHandRaised=false
      setParticipants(prev =>
        prev.map(p => matchesParticipantId(p, data.userId) ? { ...p, isHandRaised: false, hasHandRaised: false } : p)
      );

      // ✅ CRITICAL FIX: Immediately update queue with hand lower status for proper sorting
      const queueParticipant = queueState.participants.find(p => 
        p._id === data.userId || 
        p.userId === data.userId || 
        p.user?._id === data.userId ||
        (p as any).backendId === data.userId ||
        p.identity === data.userId ||
        // Also check memoizedParticipants for additional ID matching
        memoizedParticipants.some(mp => 
          (mp._id === data.userId || (mp as any).backendId === data.userId) &&
          (mp._id === p._id || mp.user?._id === p._id || (mp as any).backendId === p._id)
        )
      );
      if (queueParticipant) {
        updateHandRaiseStatus(queueParticipant._id, false);
      } else {
        // Fallback: Try to find by displayName
        const foundByName = queueState.participants.find(p => p.displayName === data.displayName);
        if (foundByName) {
          updateHandRaiseStatus(foundByName._id, false);
        }
      }

      // Remove from notices
      setRaisedHandNotices(prev => prev.filter(n => n.id !== data.userId));
    };

    socket.on('HAND_RAISED', (data) => {
      // Check if user is host
      const isHostUser = currentParticipant?.role === 'HOST' || role === 'HOST' || currentUser?.systemRole === 'TUTOR' || currentUser?.systemRole === 'ADMIN';
      if (isHostUser) {
        playChime(); // play sound only for host
      }
      handleHandRaised(data);
    });

    socket.on('HAND_LOWERED', handleHandLowered);
    socket.on('HAND_LOWERED_BY_HOST', handleHandLoweredByHost);
    
    return () => {
      socket.off('HAND_RAISED');
      socket.off('HAND_LOWERED');
      socket.off('HAND_LOWERED_BY_HOST');
    };
  }, [socket, currentParticipant, role, currentUser, queueState.participants, updateHandRaiseStatus, memoizedParticipants]);

  // WebSocket event listener for recording announcements
  useEffect(() => {
    
    if (socket && wsConnected) {
      
      const handleRecordingAnnouncement = (data: { message: string; type: string }) => {

        // 🔄 Update local recording state for everyone
        if (data.type === 'start') {
          setIsRecording(true);
        } else if (data.type === 'stop') {
          setIsRecording(false);
        }

        // 🔊 Play voice announcement on all participant devices
        announceRecordingStatus(data.message);

        // 🔔 Visual feedback - only show info for stop, no success alerts
        if (data.type === 'stop') {
          Swal.fire({
            icon: 'info',
            title: '녹화 중지',
            text: data.message,
            timer: 2500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        }
      };

      const handleTestBroadcast = (data: any) => {
        announceRecordingStatus('WebSocket test received! Broadcasting works!');
      };

      socket.on('RECORDING_ANNOUNCEMENT', handleRecordingAnnouncement);
      socket.on('TEST_BROADCAST', handleTestBroadcast);
      
      // 🚨 Handle being kicked from meeting
      const handleKicked = async (data: any) => {
        // Don't check currentUser or userId - if we receive KICKED, we're being kicked
        
        // Disconnect from LiveKit if connected (don't await)
        if (liveKitDisconnect) {
          liveKitDisconnect().catch(() => {});
        }
        
        // Immediate redirect without waiting
        window.location.href = '/member';
      };

      // ✅ Handle host transfer event
      const handleHostTransfer = async (data: any) => {
        if (!currentUser) return;
        const transferredUserId = currentUser._id || currentUser.id;
        if (data.userId === transferredUserId && data.token) {
          Swal.fire({
            icon: 'success',
            title: '호스트 권한 이전',
            text: '이제 이 회의의 호스트입니다.',
            confirmButtonText: '확인',
            confirmButtonColor: '#28a745'
          });
          
          // ✅ Store the new token for future reconnections
          if (data.token) {
            // Note: Token is already in place on the server, we just need to ensure
            // our local state reflects the new permissions. LiveKit permissions are
            // server-side, so the new token will be used on next connection.
          }
          
          // Update host state
          setIsHostState(true);
          
        }
      };

      socket.on('KICKED', handleKicked);
      socket.on('host-transfer', handleHostTransfer); // ✅ Listen for host transfer
      
      // Handle WebSocket ERROR events (authentication failures, etc.)
      const handleSocketError = (error: any) => {
        if (error && (
          error.message?.includes('UNAUTHENTICATED') ||
          error.message?.includes('No authentication token') ||
          error.message?.includes('Invalid authentication token') ||
          error.message?.includes('Connection failed') ||
          error.message?.includes('User not found')
        )) {
          window.location.href = REDIRECT_URL;
        }
      };
      
      socket.on('ERROR', handleSocketError);

      return () => {
        socket.off('RECORDING_ANNOUNCEMENT', handleRecordingAnnouncement);
        socket.off('TEST_BROADCAST', handleTestBroadcast);
        socket.off('KICKED', handleKicked);
        socket.off('host-transfer', handleHostTransfer); // ✅ Clean up host transfer listener
        socket.off('ERROR', handleSocketError);
      };
    } else {
    }
  }, [socket, wsConnected, currentUser, liveKitDisconnect]);

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
            let desiredRole: 'HOST' | 'PARTICIPANT' | undefined;
            try {
              const { data: meetingInfo } = await apolloClient.query({
                query: GET_MEETING_BY_ID,
                variables: { meetingId: meetingIdToUse },
                fetchPolicy: 'network-only'
              });
              const meetingDetails = (meetingInfo as any)?.getMeetingById;
              const userIdValue = user?.id || user?._id;
              if (meetingDetails) {
                if (!meetingDetails.currentHostId) {
                  desiredRole = 'HOST';
                } else if (
                  meetingDetails.currentHostId === userIdValue ||
                  meetingDetails.hostId === userIdValue
                ) {
                  desiredRole = 'HOST';
                } else {
                  desiredRole = 'PARTICIPANT';
                }
              }
            } catch (fetchError) {
              desiredRole = user.systemRole === 'TUTOR' || user.systemRole === 'ADMIN' ? 'HOST' : 'PARTICIPANT';
            }

            const joinInput: Record<string, any> = {
              meetingId: meetingIdToUse,
              displayName: user.displayName || 'Participant'
            };

            if (desiredRole) {
              joinInput.role = desiredRole;
            }

            const joinResult = await joinMeeting({
              variables: {
                input: joinInput
              }
            });
            
            if ((joinResult.data as any)?.joinMeeting) {
              setCurrentParticipant((joinResult.data as any).joinMeeting);
            } else {
            }
          } catch (joinError: any) {
            // Check for authentication errors in join error
            if (joinError?.message?.includes('UNAUTHENTICATED') || 
                joinError?.message?.includes('Forbidden') ||
                joinError?.graphQLErrors?.some((err: any) => err.extensions?.code === 'UNAUTHENTICATED')) {
              window.location.href = REDIRECT_URL;
              return;
            }
            // Don't fail the entire initialization, just log the error
          }
        } else {
          // Not authenticated - redirect to hrdeedu.co.kr
          window.location.href = REDIRECT_URL;
          return;
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
      const liveKitIdentity = currentUser._id || currentUser.id || userId;

      const connectStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      liveKitConnect({
        roomName: actualMeetingId,
        participantName: currentUser.displayName || currentUser.name || 'User',
        identity: liveKitIdentity, // ✅ give unique identity to each participant
        meetingRole: role as 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER',
        enableCamera: cameraEnabled, // Enable camera based on state - connection handles it properly now
        enableMicrophone: micEnabled,
        enableScreenShare: true
      })
        .then(() => {
          const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (typeof console !== 'undefined') {
            console.info(`[LiveKit] Connection established in ${(end - connectStart).toFixed(0)}ms`);
          }
        })
        .catch(error => {
        // Connection error handled
      });
    }
  }, [authComplete, actualMeetingId, currentUser, role, cameraEnabled, micEnabled, liveKitConnect, isLiveKitConnected, isLiveKitConnecting]);

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
    
    // ✅ FIX: Handle orientation changes smoothly
    const handleOrientationChange = () => {
      // Small delay to let browser finish orientation change
      setTimeout(() => {
        checkMobile();
        // Force a re-render to update grid layout
        if (viewMode === 'grid') {
          // Trigger grid layout recalculation
          window.dispatchEvent(new Event('resize'));
        }
      }, 100);
    };
    
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', handleOrientationChange);
    // Also listen for screen orientation changes (more reliable on some devices)
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, [viewMode]);

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

  // ✅ Listen to LiveKit track state changes for real-time UI sync
  useEffect(() => {
    const local = liveKitService?.room?.localParticipant;
    if (!local) return;

    const updateLocalState = () => {
      setMicEnabled(local.isMicrophoneEnabled);
      setCameraEnabled(local.isCameraEnabled);
    };

    local.on('trackMuted', updateLocalState);
    local.on('trackUnmuted', updateLocalState);
    local.on('localTrackPublished', updateLocalState);
    local.on('localTrackUnpublished', updateLocalState);

    return () => {
      local.off('trackMuted', updateLocalState);
      local.off('trackUnmuted', updateLocalState);
      local.off('localTrackPublished', updateLocalState);
      local.off('localTrackUnpublished', updateLocalState);
    };
  }, [liveKitService?.room]);

  // ✅ MOBILE FIX: Auto-select first participant for main stage on mobile
  useEffect(() => {
    
    // Try memoizedParticipants first, then fallback to queueState.participants
    const participantsToUse = memoizedParticipants.length > 0 ? memoizedParticipants : queueState.participants;
    
    if (isMobile && participantsToUse.length > 0 && !selectedParticipantId) {
      const firstParticipant = participantsToUse[0];
      setSelectedParticipantId(firstParticipant._id);
    }
  }, [isMobile, memoizedParticipants, queueState.participants, selectedParticipantId]);

  // Production environment checks
  useEffect(() => {
    // Check if we're in production
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
    }
  }, []);

  // Mobile fullscreen and immersive mode - FIXED: Opens fullscreen by default
  useEffect(() => {
    if (!isMobile) return;

    // Set viewport meta for mobile optimization
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    const originalContent = viewportMeta?.getAttribute('content');
    
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    }

    // Auto-enter fullscreen on mobile when connected
    const enterFullscreenWhenReady = async () => {
      try {
        // Small delay to ensure page is fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check if already in fullscreen
        if (document.fullscreenElement) return;
        
        // Show controls initially
        setShowControls(true);
        
        // Force video player mode for mobile
        setIsVideoPlayerMode(true);
        setIsFullscreen(true);
        
        // Request fullscreen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen().catch(() => {});
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen().catch(() => {});
        } else if ((elem as any).webkitEnterFullscreen) {
          await (elem as any).webkitEnterFullscreen().catch(() => {});
        }
        
        // Try to hide address bar on mobile browsers
        window.scrollTo(0, 1);
        
        // Delay hiding controls
        setTimeout(() => {
          setShowControls(false);
        }, 2000);
      } catch (error) {
      }
    };

    // Call after a short delay
    const timer = setTimeout(enterFullscreenWhenReady, 1000);

    // Prevent pull-to-refresh on mobile
    const preventPullToRefresh = (e: TouchEvent) => {
      if (e.touches.length > 1) return;
      
      const touch = e.touches[0];
      if (touch.clientY > 50) return;
      
      e.preventDefault();
    };

    document.addEventListener('touchstart', preventPullToRefresh, { passive: false });
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });

    return () => {
      clearTimeout(timer);
      document.removeEventListener('touchstart', preventPullToRefresh);
      document.removeEventListener('touchmove', preventPullToRefresh);
      
      // Restore original viewport settings
      if (viewportMeta && originalContent) {
        viewportMeta.setAttribute('content', originalContent);
      }
    };
  }, [isMobile]);

  const hasShownMobileErrorRef = useRef(false);

  // Mobile error handling
  useEffect(() => {
    if (!isMobile) return;

    const ignoredErrorPatterns = [
      'resizeobserver loop limit exceeded',
      'script error.',
      'cancelled animation frame',
      'the operation was aborted',
    ];

    const shouldIgnoreError = (message?: string) => {
      if (!message) return false;
      const normalized = message.toLowerCase();
      return ignoredErrorPatterns.some((pattern) => normalized.includes(pattern));
    };

    const handleError = (event: ErrorEvent) => {
      const message =
        event?.message ||
        (event?.error && typeof event.error === 'object' && 'message' in event.error
          ? String((event.error as Error).message || '')
          : '') ||
        '';
      
      if (shouldIgnoreError(message) || hasShownMobileErrorRef.current) {
        return;
      }

      hasShownMobileErrorRef.current = true;
      event.preventDefault();

      if (process.env.NODE_ENV === 'development') {
        Swal.fire({
          icon: 'error',
          title: '모바일 환경 오류',
          text: '페이지에서 일시적인 오류가 감지되었습니다. 필요하다면 새로고침 후 다시 시도해 주세요.',
          confirmButtonText: '확인',
          confirmButtonColor: '#4A6CF7'
        }).finally(() => {
          hasShownMobileErrorRef.current = false;
        });
      } else {
        console.error('[LiveStream][mobile] runtime error', message, event.error);
        hasShownMobileErrorRef.current = false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMessage =
        typeof event?.reason === 'string'
          ? event.reason
          : event?.reason && typeof event.reason === 'object' && 'message' in event.reason
          ? String((event.reason as Error).message || '')
          : '';

      if (shouldIgnoreError(reasonMessage) || hasShownMobileErrorRef.current) {
        return;
      }

      hasShownMobileErrorRef.current = true;
      event.preventDefault();
      
      // Only show error alerts in development
      if (process.env.NODE_ENV === 'development') {
        Swal.fire({
          icon: 'error',
          title: '연결 오류',
          text: reasonMessage
            ? `인터넷 연결을 확인하고 다시 시도해주세요.\n오류: ${reasonMessage}`
            : '인터넷 연결을 확인하고 다시 시도해주세요.',
          confirmButtonText: '확인',
          confirmButtonColor: '#4A6CF7'
        }).finally(() => {
          hasShownMobileErrorRef.current = false;
        });
      } else {
        console.error('[LiveStream][mobile] unhandled rejection', event.reason);
        hasShownMobileErrorRef.current = false;
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

  // Fullscreen toggle functionality - FIXED: Now properly handles mobile and desktop
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement && !(document as any).mozFullScreenElement && !(document as any).msFullscreenElement) {
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
      }
    } catch (error) {
    }
  }, []);

  // FIXED: Track fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      
      // On mobile, hide controls when exiting fullscreen
      if (isMobile && !isCurrentlyFullscreen) {
        setShowControls(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [isMobile]);

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
      
      // ✅ FIX: Check if recording is active and add warning
      const isHost = currentParticipant?.role === 'HOST' || role === 'HOST' || currentUser?.systemRole === 'TUTOR' || currentUser?.systemRole === 'ADMIN';
      const recordingWarning = (isHost && isRecording) ? '\n\n⚠️ 녹화 중입니다. 페이지를 새로고침하면 녹화가 중지됩니다.' : '';
      
      // Show browser confirmation dialog
      e.preventDefault();
      e.returnValue = `회의를 나가시겠습니까?${recordingWarning}`;
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
        // Always attempt to leave meeting on unload; meeting ends only via explicit action
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
      
      // Check if host is recording and add warning
      const isHost = currentParticipant?.role === 'HOST' || role === 'HOST' || currentUser?.systemRole === 'TUTOR' || currentUser?.systemRole === 'ADMIN';
      const recordingWarning = (isHost && isRecording) ? '\n\n⚠️ 녹화 중입니다. 호스트가 나가면 녹화가 중지됩니다.' : '';
      
      // Show custom confirmation dialog
      const confirmed = window.confirm(`회의를 나가시겠습니까?${recordingWarning}`);
      
      if (!confirmed) {
        // Prevent navigation
        router.events.emit('routeChangeError');
        throw 'Route change aborted by user';
      } else {
        // User confirmed, mark as intentional leave
        isLeavingIntentionally = true;

        if (currentParticipant?._id) {
          leaveMeeting({
            variables: {
              input: {
                participantId: currentParticipant._id
              }
            }
          }).catch(() => {});
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
  }, [router, currentParticipant, currentUser, actualMeetingId, leaveMeeting, liveKitDisconnect, role, isRecording]);

  // Helper function to redirect based on user role
  const redirectToDashboard = useCallback(() => {
    if (currentUser?.systemRole === 'ADMIN') {
      window.location.href = '/instructor';
    } else if (currentUser?.systemRole === 'TUTOR') {
      window.location.href = '/instructor';
    } else {
      window.location.href = '/member';
    }
  }, [currentUser]);

  const completeHostTransferExit = useCallback(async () => {
    if (!currentParticipant?._id) {
      setPendingHostTransferExit(false);
      setPendingHostTransferUserId(null);
      redirectToDashboard();
      return;
    }

    try {
      await leaveMeeting({
        variables: {
          input: {
            participantId: currentParticipant._id
          }
        }
      });
    } catch (error) {
    } finally {
      setPendingHostTransferExit(false);
      setPendingHostTransferUserId(null);
      setTimeout(() => {
        redirectToDashboard();
      }, 500);
    }
  }, [currentParticipant, leaveMeeting, redirectToDashboard]);

  useEffect(() => {
    if (!pendingHostTransferExit) {
      return;
    }

    const currentHostUserId =
      pendingHostTransferUserId ||
      currentParticipant?.user?._id ||
      currentParticipant?.userId ||
      currentParticipant?._id ||
      null;

    if (!currentHostUserId) {
      completeHostTransferExit();
      return;
    }

    let cancelled = false;
    let intervalId: NodeJS.Timeout | null = null;

    const hasHostChanged = (snapshot?: any) => {
      const hostId =
        snapshot?.currentHostId ??
        snapshot?.hostId ??
        meeting?.currentHostId ??
        meeting?.hostId;

      if (!hostId) {
        return false;
      }

      return hostId !== currentHostUserId;
    };

    const attemptCompletion = async (snapshot?: any) => {
      if (cancelled) {
        return true;
      }

      if (hasHostChanged(snapshot)) {
        await completeHostTransferExit();
        return true;
      }

      return false;
    };

    const startPolling = () => {
      intervalId = setInterval(async () => {
        if (cancelled) {
          return;
        }

        try {
          const refreshed = await refetchMeeting();
          const refreshedMeeting = (refreshed.data as any)?.getMeetingById;
          if (await attemptCompletion(refreshedMeeting)) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        } catch (error) {
        }
      }, 1000);
    };

    (async () => {
      const completedImmediately = await attemptCompletion();
      if (!completedImmediately && !cancelled) {
        startPolling();
      }
    })();

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    pendingHostTransferExit,
    pendingHostTransferUserId,
    meeting?.currentHostId,
    meeting?.hostId,
    completeHostTransferExit,
    refetchMeeting,
    currentParticipant
  ]);

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
      redirectToDashboard();
    }
  }, [currentParticipant, liveKitDisconnect, redirectToDashboard]);

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
              title: '녹화 상태',
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
      // ✅ FIX: Wait for recording upload to complete before redirecting
      const waitForUpload = async () => {
        let attempts = 0;
        const maxWaitTime = 60000; // Maximum 60 seconds wait
        const checkInterval = 500; // Check every 500ms
        
        while (isRecordingUploading && attempts * checkInterval < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          attempts++;
        }
        
        // If still uploading after max wait, show warning but redirect anyway
        if (isRecordingUploading) {
          console.warn('[Meeting] Recording upload still in progress, redirecting anyway...');
          Swal.fire({
            icon: 'warning',
            title: '녹화 업로드 중',
            text: '녹화 파일이 아직 업로드 중입니다. 로컬에 저장되어 나중에 자동으로 업로드됩니다.',
            timer: 3000,
            showConfirmButton: false
          });
        }
        
        redirectToDashboard();
      };
      
      // Start waiting for upload
      waitForUpload();
    }
  }, [meetingStatus, isRecordingUploading, redirectToDashboard]);

  // Handle GraphQL errors
  useEffect(() => {
    if (meetingError) {
      // Check for authentication errors - redirect to hrdeedu.co.kr
      const errorMessage = meetingError.message || '';
      const graphQLErrors = (meetingError as any).graphQLErrors || [];
      
      if (
        errorMessage.includes('UNAUTHENTICATED') ||
        errorMessage.includes('No authentication token') ||
        errorMessage.includes('Invalid authentication token') ||
        errorMessage.includes('User not found') ||
        errorMessage.includes('Forbidden') ||
        graphQLErrors.some((err: any) => 
          err.extensions?.code === 'UNAUTHENTICATED' ||
          err.message?.includes('UNAUTHENTICATED')
        )
      ) {
        window.location.href = REDIRECT_URL;
        return;
      }
      
      // If there's a GraphQL error, it might be because the meeting ended
      // Check if the error is related to null title field
      if (meetingError.message.includes('Cannot return null for non-nullable field MeetingWithHost.title')) {
        setMeetingStatus('ENDED');
        setIsLive(false);
        // Auto-redirect to dashboard after a short delay
        setTimeout(() => {
          redirectToDashboard();
        }, 1000);
      }
    }
  }, [meetingError, redirectToDashboard]);

  // Update participants data
  // ✅ CRITICAL FIX: Use a ref to track the actual participant IDs to prevent infinite loops
  const prevParticipantIdsRef = useRef<string>('');
  
  useEffect(() => {
    if (participantsData && typeof participantsData === 'object' && 'getParticipantsByMeeting' in participantsData && participantsData.getParticipantsByMeeting) {
      const participantsList = participantsData.getParticipantsByMeeting as any[];
      const normalizedParticipantsList = participantsList.map(enhanceParticipantMediaState);
      
      // Throttle participant list updates
      const now = Date.now();
      if (now - lastUpdateRef.current < 500) return;
      lastUpdateRef.current = now;
      
      // 🧠 Step 1 — Detect mismatch in raw participant data
      // Raw participant data processed
      
      // Create a stable string representation of participant IDs
      const currentParticipantIds = normalizedParticipantsList.map((p: any) => p._id).sort().join(',');
      
      // Only process if the actual participant list changed (not just the object reference)
      if (currentParticipantIds !== prevParticipantIdsRef.current) {
        prevParticipantIdsRef.current = currentParticipantIds;
        
        const previousParticipants = participants;
        
        // ✅ CLEAN FIX: No need to normalize - just use the participants as they come from backend
        // The memoizedParticipants will handle the ID mapping cleanly
        setParticipants(normalizedParticipantsList);

        // Check for new participants (joined)
        if (previousParticipants.length > 0) {
          const newParticipants = normalizedParticipantsList.filter((newP: any) => 
            !previousParticipants.find((oldP: any) => oldP._id === newP._id)
          );
          
          newParticipants.forEach((participant: any) => {
            addToQueue({
              _id: participant._id,
              displayName: participant.displayName,
              email: participant.email || '',
              isMuted: participant.micState === 'OFF',
              isCameraOff: participant.cameraState === 'OFF',
              joinedAt: participant.sessions?.[0]?.joinedAt || participant.createdAt || '2024-01-01T00:00:00.000Z',
              isHost: participant.role === 'HOST',
              role: participant.role,
              hasHandRaised: Boolean(participant.isHandRaised || participant.hasHandRaised),
              handRaisedAt: participant.handRaisedAt
            });
          });

          // Check for left participants
          const leftParticipants = previousParticipants.filter((oldP: any) => 
            !normalizedParticipantsList.find((newP: any) => newP._id === oldP._id)
          );
          
          leftParticipants.forEach((participant: any) => {
            removeFromQueue(participant._id);
          });
        } else if (normalizedParticipantsList.length > 0) {
          // Initial load - add all participants
          normalizedParticipantsList.forEach((participant: any) => {
            addToQueue({
              _id: participant._id,
              displayName: participant.displayName,
              email: participant.email || '',
              isMuted: participant.micState === 'OFF',
              isCameraOff: participant.cameraState === 'OFF',
              joinedAt: participant.sessions?.[0]?.joinedAt || participant.createdAt || '2024-01-01T00:00:00.000Z',
              isHost: participant.role === 'HOST',
              role: participant.role,
              hasHandRaised: Boolean(participant.isHandRaised || participant.hasHandRaised),
              handRaisedAt: participant.handRaisedAt
            });
          });
        }
      }
    }
  }, [participantsData, addToQueue, removeFromQueue, enhanceParticipantMediaState]);
  
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
      // Meeting started successfully - no notification needed
      } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '회의 시작에 실패했습니다. 다시 시도해주세요.'
      });
    }
  };

  const handleEndMeeting = useCallback(async () => {
    try {
      await endMeeting({
        variables: { meetingId: actualMeetingId }
      });
      setMeetingStatus('ENDED');
      setIsLive(false);
      
      // Auto-redirect to dashboard immediately without showing success message
      // This ensures all participants are redirected automatically
      setTimeout(() => {
        redirectToDashboard();
      }, 500);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '회의 종료에 실패했습니다. 다시 시도해주세요.'
      });
    }
  }, [endMeeting, actualMeetingId, redirectToDashboard]);

  // ✅ Backend handles auto-end when participantCount reaches 0
  // Frontend just monitors and redirects when meeting status changes to ENDED
  // This ensures meeting ends even if host leaves first (backend doesn't require host permission for auto-end)

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
        title: '회의 나가기',
        text: '회의를 나가시겠습니까?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '나가기',
        cancelButtonText: '취소',
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      });

            if (result.isConfirmed) {
        // Check if we have current participant data
        if (!currentParticipant?._id) {
          Swal.fire({
            icon: 'error',
            title: '오류',
            text: '회의를 나갈 수 없습니다. 새로고침 후 다시 시도해주세요.'
          });
          return;
        }

      const leaveResult = await leaveMeeting({
        variables: { 
          input: { 
              participantId: currentParticipant._id
          }
        }
      });
      
      // Only redirect if leave was successful
      if ((leaveResult.data as any)?.leaveMeeting?.success || true) {
        // Auto-redirect after successful leave
        setTimeout(() => {
          redirectToDashboard();
        }, 1000);
      } else {
        throw new Error('Leave meeting failed');
      }
      }
              } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: 'Failed to leave the meeting. Please try again.'
      });
    }
  };

  const disableHostFeatures = useCallback(async (): Promise<boolean> => {
    const activeFeatures: string[] = [];

    if (isRecording) {
      activeFeatures.push('녹화');
    }

    if (liveKitIsScreenSharing || queueState.screenShareMode) {
      activeFeatures.push('화면 공유');
    }

    if (isWhiteboardActive || isWhiteboardMode) {
      activeFeatures.push('화이트보드');
    }

    if (activeFeatures.length === 0) {
      return true;
    }

    const warningHtml = `
      <div style="text-align:left">
        <p style="margin-bottom:8px;">다음 기능이 활성화되어 있습니다:</p>
        <ul style="padding-left:18px;margin:0 0 12px 0;">
          ${activeFeatures.map(item => `<li>${item}</li>`).join('')}
        </ul>
        <p style="margin:0;">호스트 권한 이전 전에 모든 기능을 종료해야 합니다. 종료하시겠습니까?</p>
      </div>
    `;

    const confirmResult = await Swal.fire({
      icon: 'warning',
      title: '호스트 이전 준비',
      html: warningHtml,
      confirmButtonText: '모두 종료 후 계속',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      showCancelButton: true,
      reverseButtons: true
    });

    if (!confirmResult.isConfirmed) {
      return false;
    }

    try {
      if (isRecording) {
        window.dispatchEvent(new CustomEvent('hrde-stop-recording', { detail: { meetingId: actualMeetingId } }));
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      if (isWhiteboardActive || isWhiteboardMode) {
        try {
          await stopWhiteboard();
        } catch (error) {
        }
        setIsWhiteboardMode(false);
      }

      if (queueState.screenShareMode) {
        stopQueueScreenShare();
      }

      if (liveKitIsScreenSharing && liveKitToggleScreenShare) {
        try {
          await liveKitToggleScreenShare();
        } catch (error) {
        }
      }
    } catch (error) {
    }

    return true;
  }, [
    actualMeetingId,
    isRecording,
    liveKitIsScreenSharing,
    liveKitToggleScreenShare,
    queueState.screenShareMode,
    stopQueueScreenShare,
    isWhiteboardActive,
    isWhiteboardMode,
    stopWhiteboard,
    setIsWhiteboardMode
  ]);

  const handleTransferHost = async () => {
    try {
        const nonHostParticipants = participants.filter(p => p.role !== 'HOST');
      
      if (nonHostParticipants.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: '참가자 없음',
          text: '호스트 권한을 이전할 다른 참가자가 없습니다.',
          confirmButtonText: '확인'
        });
        return;
      }

      const featuresDisabled = await disableHostFeatures();
      if (!featuresDisabled) {
        return;
      }

      // Create participant selection options
      const participantOptions = nonHostParticipants.map((participant, index) => ({
        value: participant._id,
        text: `${participant.displayName || participant.user?.displayName || '참가자'} (${participant.user?.email || 'participant@demo.com'})`
      }));

      const { value: selectedParticipantId } = await Swal.fire({
          title: '호스트 권한 이전',
        text: '새로운 호스트가 될 참가자를 선택하세요:',
        icon: 'question',
        input: 'select',
        inputOptions: participantOptions.reduce((acc, option) => {
          acc[option.value] = option.text;
          return acc;
        }, {} as Record<string, string>),
        inputPlaceholder: '참가자를 선택하세요...',
          showCancelButton: true,
        confirmButtonText: '호스트 이전',
          cancelButtonText: '취소',
            confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        inputValidator: (value) => {
          if (!value) {
            return '참가자를 선택해야 합니다!';
          }
          return null;
        }
      });

      if (selectedParticipantId) {
        const selectedParticipant = nonHostParticipants.find(p => p._id === selectedParticipantId);
        
        if (selectedParticipant) {
          const currentHostUserId =
            currentParticipant?.user?._id ||
            currentParticipant?.userId ||
            currentParticipant?._id ||
            null;

          // First transfer the host role
          const result = await transferHost({
              variables: {
              input: {
                  meetingId: actualMeetingId,
                newHostParticipantId: selectedParticipantId,
                reason: 'Host transferring role'
              }
            }
          });

          // ✅ Check if LiveKit token was generated and store it
          const transferResult = (result?.data as any)?.transferHost;
          if (transferResult?.newLiveKitToken) {
          }

          // Refetch data to update host status
          await Promise.all([
            refetchCurrentParticipant(),
            refetchParticipants(),
            refetchMeeting()
          ]);

          // Wait for backend role update before leaving
          setPendingHostTransferExit(true);
          setPendingHostTransferUserId(currentHostUserId);
          
          Swal.fire({
            icon: 'success',
            title: '호스트 권한 이전 완료',
            text: '호스트 권한을 이전했습니다. 잠시 후 회의에서 나갑니다.',
            confirmButtonText: '확인',
            confirmButtonColor: '#28a745'
          });
          }
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '호스트 권한 이전에 실패했습니다. 다시 시도해주세요.'
      });
    }
  };

  const handleForceExit = async () => {
    try {
      if (isHost && participants.length > 1) {
        // Check if recording is active and add warning
        const recordingWarning = isRecording 
          ? '\n\n⚠️ 녹화 중입니다. 호스트가 나가면 녹화가 중지됩니다.' 
          : '';
        
        // Show options for host
        const result = await Swal.fire({
          title: '회의 나가기',
          text: `호스트로서 모든 참가자를 위해 회의를 종료하거나 호스트 권한을 이전할 수 있습니다:${recordingWarning}`,
          icon: 'question',
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: '모두 종료',
          denyButtonText: '호스트 이전 후 나가기',
          cancelButtonText: '취소',
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
        // Host with no other participants - show warning if recording
        if (isRecording) {
          const result = await Swal.fire({
            title: '회의 종료',
            text: '⚠️ 녹화 중입니다. 호스트가 나가면 녹화가 중지됩니다. 회의를 종료하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '종료',
            cancelButtonText: '취소',
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d'
          });
          
          if (result.isConfirmed) {
            await handleEndMeeting();
          }
        } else {
          // No recording - just end meeting
          await handleEndMeeting();
        }
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: 'Failed to leave the meeting. Please try again.'
      });
    }
  };


  // ✅ Direct LiveKit track control for mic
  const handleMicToggle = async () => {
    const local = liveKitService?.room?.localParticipant;
    if (!local) {
      // Fallback: just toggle state if not connected
      setMicEnabled(!micEnabled);
      return;
    }

    try {
      // ✅ Directly control LiveKit track
      const currentState = local.isMicrophoneEnabled;
      await local.setMicrophoneEnabled(!currentState);
      const newState = !currentState;
      
      setMicEnabled(newState);

      // 🔄 Emit WebSocket event to sync remote state
      socket?.emit('PARTICIPANT_STATE_UPDATE', { 
        meetingId: actualMeetingId, 
        userId: currentUser?._id || currentUser?.id, 
        micState: newState ? 'ON' : 'OFF',
        cameraState: cameraEnabled ? 'ON' : 'OFF'
      });

      // 🔄 Sync participant mic state to match UI
      setParticipants(prev => prev.map(p => {
        if (p._id === currentParticipant?._id) {
          return { ...p, micState: newState ? 'ON' : 'OFF' };
        }
        return p;
      }));
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: '마이크 오류',
        text: error?.message || '마이크 전환에 실패했습니다.'
      });
    }
  };

  // ✅ Direct LiveKit track control for camera
  const handleCameraToggle = async () => {
    const local = liveKitService?.room?.localParticipant;
    if (!local) {
      // Fallback: just toggle state if not connected
      setCameraEnabled(!cameraEnabled);
      return;
    }

    try {
      // ✅ Directly control LiveKit track
      const currentState = local.isCameraEnabled;
      await local.setCameraEnabled(!currentState);
      const newState = !currentState;
      
      setCameraEnabled(newState);

      // 🔄 Emit WebSocket event to sync remote state
      socket?.emit('PARTICIPANT_STATE_UPDATE', { 
        meetingId: actualMeetingId, 
        userId: currentUser?._id || currentUser?.id, 
        micState: micEnabled ? 'ON' : 'OFF',
        cameraState: newState ? 'ON' : 'OFF' 
      });

      // 🔄 Sync participant camera state
      setParticipants(prev => prev.map(p => {
        if (p._id === currentParticipant?._id) {
          return { ...p, cameraState: newState ? 'ON' : 'OFF' };
        }
        return p;
      }));
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: '카메라 오류',
        text: error?.message || '카메라 전환에 실패했습니다.'
      });
    }
  };

  const handleScreenShareToggle = async () => {
    if (!canShareScreen) {
      Swal.fire({
        icon: 'warning',
        title: '화면 공유 권한이 없습니다',
        text: '호스트만 화면을 공유할 수 있습니다.'
      });
      return;
    }

    const isWhiteboardRunning = isWhiteboardActive || isWhiteboardMode;
    const isStartingScreenShare = !liveKitIsScreenSharing;

    if (isWhiteboardRunning && isStartingScreenShare) {
      Swal.fire({
        icon: 'warning',
        title: '화면 공유를 시작할 수 없습니다',
        text: '현재 펜(화이트보드)이 켜져 있습니다. 화면 공유를 사용하려면 먼저 펜 도구를 종료해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    if (isLiveKitConnected) {
      try {
        // ✅ MOBILE FIX: Ensure user gesture is properly handled for mobile screen sharing
        // Mobile browsers require screen share to be initiated from a direct user interaction
        if (isMobile && !liveKitIsScreenSharing) {
          // On mobile, screen sharing must be triggered from user gesture
          // The button click itself is the gesture, so we can proceed
        }

        await liveKitToggleScreenShare();
        // ✅ FIX: Don't manually set screenSharing state - let the useEffect handle it
        // The LiveKit state change will trigger the useEffect to update queue state
      } catch (error: any) {
        
        // ✅ MOBILE FIX: Better error messages for mobile devices
        let errorMessage = error?.message || '화면 공유 전환에 실패했습니다. 사용자가 취소했거나 브라우저가 차단했을 수 있습니다.';
        
        if (isMobile) {
          if (error?.message?.includes('user gesture') || error?.message?.includes('getDisplayMedia')) {
            errorMessage = '모바일에서 화면 공유를 시작하려면 버튼을 다시 탭해주세요.';
          } else if (error?.name === 'NotAllowedError') {
            errorMessage = '화면 공유 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.';
          } else if (error?.name === 'NotSupportedError') {
            errorMessage = '이 브라우저에서는 화면 공유를 지원하지 않습니다. Chrome 또는 Safari를 사용해주세요.';
          }
        }
        
        // Show user-friendly error message
        Swal.fire({
          icon: 'error',
          title: '화면 공유 오류',
          text: errorMessage,
          timer: 3000
        });
        
      }
    } else {
      // Fallback for when LiveKit is not connected
      if (currentParticipant?._id) {
        if (queueState.screenShareMode) {
          stopQueueScreenShare();
        } else {
          startQueueScreenShare(currentParticipant._id);
        }
      }
    }
  };

  // Format recording duration
  const formatRecordingDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Speech synthesis function for recording announcements
  const announceRecordingStatus = (message: string) => {
    try {
      // 🔊 Play short beep before announcement (non-blocking)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // Hz
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15); // short beep 150ms

      // 🗣️ Then speak after slight delay
      setTimeout(() => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.volume = 0.8;
          utterance.rate = 0.9;
          utterance.pitch = 1.0;

          const voices = speechSynthesis.getVoices();
          const preferredVoice =
            voices.find(v => v.name.includes('Female')) ||
            voices.find(v => v.name.includes('Samantha') || v.name.includes('Zira'));
          if (preferredVoice) utterance.voice = preferredVoice;

          speechSynthesis.speak(utterance);
        }
      }, 300);
    } catch (error) {
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
        fromUser: currentUser?.displayName || currentUser?.email || '알 수 없음'
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

  const signalVodRefresh = (recordingId?: string | null) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const payload = {
        meetingId: actualMeetingId,
        recordingId: recordingId || null,
        timestamp: Date.now()
      };
      window.localStorage.setItem('hrde_vod_sync', JSON.stringify(payload));
      setTimeout(() => {
        try {
          window.localStorage.removeItem('hrde_vod_sync');
        } catch (cleanupError) {
        }
      }, 1500);
    } catch (error) {
    }
  };

  const handleRecordingStarted = () => {
    setIsRecording(true);
    setRecordingStartTime(new Date());
    setRecordingDuration(0);
    broadcastRecordingAnnouncement('녹화가 시작되었습니다.', 'start');
  };

  const handleRecordingUploadComplete = (recordingId?: string | null) => {
    setIsRecording(false);
    setRecordingStartTime(null);
    setRecordingDuration(0);
    broadcastRecordingAnnouncement('녹화가 종료되었습니다.', 'stop');
    signalVodRefresh(recordingId || null);
  };

  const handleRecordingError = (errorMessage: string) => {
    setIsRecording(false);
    setIsRecordingUploading(false); // ✅ Reset upload status
    setRecordingStartTime(null);
    setRecordingDuration(0);
    signalVodRefresh(null);
    Swal.fire({
      icon: 'error',
      title: '녹화 업로드 실패',
      text: errorMessage || '녹화 파일 업로드 중 문제가 발생했습니다. 다시 시도해주세요.'
    });
  };

  // ✅ Callback to track recording upload status
  const handleRecordingUploadStatusChange = (isUploading: boolean) => {
    setIsRecordingUploading(isUploading);
    console.log(`[Recording] Upload status changed: ${isUploading ? 'Uploading...' : 'Upload complete/failed'}`);
  };

  // handleRecordingToggle - Disabled for client-side recording
  // const handleRecordingToggle = async () => {
  //   // This function is no longer used - recording is handled by ClientSideRecording component
  // };


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
          title: '권한 거부',
          text: '회의 호스트만 참가자를 제거할 수 있습니다.'
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
          title: '권한 오류',
          text: '회의 호스트만 참가자를 제거할 수 있습니다.'
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
          title: '오류',
          text: '회의에서 참가자를 찾을 수 없습니다.'
        });
        return;
      }
      
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
            userId: String(removedParticipant.userId),
            meetingId: removedParticipant.meetingId,
            reason: 'Removed by host'
          });
        } else {
        }
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
          title: '백엔드 권한 문제',
          html: `
            <p>이전된 호스트로서 참가자를 제거할 수 있어야 하지만, 백엔드가 요청을 거부하고 있습니다.</p>
            <p><strong>문제:</strong> 백엔드가 원래 hostId를 확인하고 있어 currentHostId를 확인하지 않습니다</p>
            <p><strong>사용자 ID:</strong> ${currentUserId}</p>
            <p><strong>원래 호스트 ID:</strong> ${meeting?.hostId}</p>
            <p><strong>현재 호스트 ID:</strong> ${meeting?.currentHostId}</p>
            <p>백엔드 권한 로직에서 수정이 필요합니다.</p>
          `,
          confirmButtonText: '확인'
        });
      } else {
        // Show more specific error message
        const errorMessage = (error as any)?.message || '알 수 없는 오류가 발생했습니다';
      Swal.fire({
        icon: 'error',
        title: '오류',
          text: `참가자 제거 실패: ${errorMessage}`
      });
      }
    }
  }, [refetchCurrentParticipant, participants, removeParticipant, socket, currentUser]);
  
  // Wrapper for onKickParticipant callback that takes Participant object
  const handleKickParticipantClick = useCallback((participant: any) => {
    // ✅ Handle both object format { participantId, name } and direct ID
    // participantId from ParticipantThumbnail is now the backend document _id (not user identity)
    const targetId = participant?.participantId || participant?._id || participant?.id || participant;
    
    if (!targetId) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '참가자를 제거할 수 없습니다: 참가자 ID가 없습니다'
      });
      return;
    }
    
    handleKickParticipant(targetId);
  }, [handleKickParticipant]);

  const handleHostLowerHand = async (participantId: string) => {
    try {
      if (!socket || !wsConnected) {
        Swal.fire({
          icon: 'error',
          title: '오류',
          text: '서버에 연결되지 않았습니다'
        });
        return;
      }

      
      socket.emit('HOST_LOWER_HAND', {
        meetingId: actualMeetingId,
        participantId,
        reason: 'Lowered by host'
      });

      // Hand lowered successfully - no notification needed
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '오류',
        text: '손 내리기 실패'
      });
    }
  };

  // Ensure non-hosts default to chat tab and cannot access participants tab
  useEffect(() => {
    // Strict check - must be actual host with participant role confirmed
    const isConfirmedHost = currentParticipant && currentParticipant.role === 'HOST';
    if (!isConfirmedHost && activeTab === 'participants') {
      setActiveTab('chat');
    }
  }, [currentParticipant, activeTab]);

  // When sidebar opens, ensure non-hosts are on chat tab
  useEffect(() => {
    // Strict check - must be actual host with participant role confirmed
    const isConfirmedHost = currentParticipant && currentParticipant.role === 'HOST';
    if (sidebarOpen && !isConfirmedHost) {
      setActiveTab('chat');
    }
  }, [sidebarOpen, currentParticipant]);


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
  
  // Check for duplicate participants
  useEffect(() => {
  }, [participants, participantsWithHandRaise]);

  // Loading state
  if (loading || !authComplete) {
    return (
      <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: viewportHeightValue,
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
          height: viewportHeightValue,
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
          onClick={() => redirectToDashboard()}
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
          
          /* Mobile Loading Spinner Animation */
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          /* ✅ FIX 5: Mobile-specific video player mode improvements */
          @media (max-width: 768px) {
            .video-player-mode {
              -webkit-overflow-scrolling: touch;
              overscroll-behavior: none;
            }
            
            .video-player-mode body {
              -webkit-text-size-adjust: 100%;
              -ms-text-size-adjust: 100%;
              touch-action: manipulation;
            }
            
            .video-player-mode #__next {
              background: #000000 !important;
              z-index: 9999 !important;
            }
            
            /* Ensure video elements are visible on mobile */
            .video-player-mode video {
              object-fit: cover !important;
              width: 100% !important;
              height: 100% !important;
            }
          }

          .video-player-mode body {
            overflow: hidden;
            position: fixed;
            width: 100vw;
            height: var(--ios-viewport-height, 100vh);
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
            height: var(--ios-viewport-height, 100vh);
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
        
          /* Invisible scrollbar for participant thumbnails */
          .participant-thumbnails::-webkit-scrollbar {
            display: none; /* Hide scrollbar completely */
          }
          
          .participant-thumbnails {
            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
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
            height: viewportHeightValue,
            width: '100vw', // Use full viewport width
            backgroundColor: isVideoPlayerMode ? '#000000' : '#ffffff',
            color: isVideoPlayerMode ? '#ffffff' : '#333333',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            position: 'relative',
            overflow: 'hidden',
            maxHeight: viewportHeightValue, // Ensure it doesn't exceed viewport
            paddingBottom: isIOSPlatform ? 'env(safe-area-inset-bottom)' : undefined,
            paddingTop: isIOSPlatform ? 'env(safe-area-inset-top)' : undefined,
            // Video player mode styling
            ...(isVideoPlayerMode && {
              background: 'linear-gradient(135deg, #000000 0%, #1a1a2e 100%)'
            })
          }}>
          
          {/* ✅ FIX 3: Mobile loading fallback overlay */}
          {isMobile && !isLiveKitConnected && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000000',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                border: '3px solid #333',
                borderTop: '3px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '20px'
              }}></div>
              <h2 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                marginBottom: '10px',
                color: '#ffffff'
              }}>
                Connecting to Meeting...
              </h2>
              <p style={{ 
                fontSize: '14px', 
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0
              }}>
                Please wait while we establish the connection
              </p>
            </div>
          )}
          
          {/* Main Content Area - Takes remaining space */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            // Reserve space for fixed header and bottom bar
            paddingTop: isMobile ? '56px' : '70px',
            // When controls are hidden in video player mode, extend to bottom (no padding)
            paddingBottom: (isVideoPlayerMode && !showControls) 
              ? '0px' 
              : (isMobile ? '100px' : '80px'),
            minHeight: 0 // Allow flex item to shrink
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
              display: (isMobile && isPiPVisible) ? 'none' : 'flex',
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
                src="/Icons/HRDeOnAirBlack.svg" 
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsVideoPlayerMode(!isVideoPlayerMode);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsVideoPlayerMode(!isVideoPlayerMode);
              }}
              style={{
                width: isMobile ? '36px' : '44px',
                height: isMobile ? '36px' : '44px',
                borderRadius: '8px',
                backgroundColor: isVideoPlayerMode 
                  ? 'rgba(74, 108, 247, 0.9)' 
                  : '#f3f4f6',
                border: isVideoPlayerMode 
                  ? '1px solid rgba(74, 108, 247, 0.3)'
                  : '1px solid #e5e7eb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                backdropFilter: isVideoPlayerMode ? 'blur(10px)' : 'none',
                zIndex: 1000,
                position: 'relative'
              }}
              title={isVideoPlayerMode ? 'Exit Video Mode' : 'Enter Video Mode'}
            >
              <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill={isVideoPlayerMode ? "white" : "#374151"}>
                {isVideoPlayerMode ? (
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                ) : (
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7v6l5-3-5-3z"/>
                )}
              </svg>
            </button>

            {/* Fullscreen Toggle Button - Always Visible */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFullscreen();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFullscreen();
              }}
              style={{
                width: isMobile ? '36px' : '44px',
                height: isMobile ? '36px' : '44px',
                borderRadius: '8px',
                backgroundColor: isVideoPlayerMode ? 'rgba(255, 255, 255, 0.1)' : '#f3f4f6',
                border: isVideoPlayerMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #e5e7eb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                backdropFilter: isVideoPlayerMode ? 'blur(10px)' : 'none',
                zIndex: 1000,
                position: 'relative'
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill={isVideoPlayerMode ? "white" : "#374151"}>
                {isFullscreen ? (
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                ) : (
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                )}
              </svg>
            </button>

            {/* Thumbnail Toggle Button - Always Visible */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setThumbnailPanelOpen(!thumbnailPanelOpen);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setThumbnailPanelOpen(!thumbnailPanelOpen);
              }}
              style={{
                width: isMobile ? '36px' : '44px',
                height: isMobile ? '36px' : '44px',
                borderRadius: '8px',
                backgroundColor: isVideoPlayerMode ? 'rgba(255, 255, 255, 0.1)' : '#f3f4f6',
                border: isVideoPlayerMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #e5e7eb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                backdropFilter: isVideoPlayerMode ? 'blur(10px)' : 'none',
                zIndex: 1000,
                position: 'relative'
              }}
              title={thumbnailPanelOpen ? 'Hide participants' : 'Show participants'}
            >
              <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill={isVideoPlayerMode ? "white" : "#374151"} style={{
                transform: thumbnailPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}>
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>

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
                {recordingDuration > 0 && (
                  <span style={{ marginLeft: '4px', fontFamily: 'monospace' }}>
                    {formatRecordingDuration(recordingDuration)}
                  </span>
                )}
              </div>
            )}

            {/* Recording Controls - ONLY for MEETING HOST - Participants should NOT see these buttons */}
            {isMeetingHost && (
              <>
                {/* Desktop Controls */}
                {!isMobile && (
                  <>
                    <ClientSideRecording
                      meetingId={actualMeetingId}
                      userId={currentUser?.id || currentUser?._id || 'unknown'}
                      meetingName={(meetingData as any)?.title || `Meeting_${actualMeetingId}`}
                      meetingStatus={meetingStatus}
                      liveKitService={liveKitService}
                      onRecordingStart={handleRecordingStarted}
                      onRecordingComplete={handleRecordingUploadComplete}
                      onError={handleRecordingError}
                      onUploadStatusChange={handleRecordingUploadStatusChange}
                    />
                  </>
                )}

                {/* ✅ FIX: Mobile Controls - Now in TOP HEADER */}
                {isMobile && (
                  <ClientSideRecording
                    meetingId={actualMeetingId}
                    userId={currentUser?.id || currentUser?._id || 'unknown'}
                    meetingName={(meetingData as any)?.title || `Meeting_${actualMeetingId}`}
                    meetingStatus={meetingStatus}
                    liveKitService={liveKitService}
                    onRecordingStart={handleRecordingStarted}
                    onRecordingComplete={handleRecordingUploadComplete}
                    onError={handleRecordingError}
                    onUploadStatusChange={handleRecordingUploadStatusChange}
                  />
                )}

                {/* Old Mobile Controls - REMOVED - Now only in top header */}
                {false && (
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center',
                    padding: '8px',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    borderRadius: '25px',
                    backdropFilter: 'blur(10px)',
                    flexShrink: 0, // Prevent shrinking
                    minWidth: 'fit-content', // Ensure it doesn't get compressed
                    overflow: 'visible' // Allow content to be visible
                  }}>
                    {/* Microphone Button */}
                    <button
                      onClick={handleMicToggle}
                      onTouchStart={handleMicToggle}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: micEnabled ? '#22c55e' : '#ef4444',
                        border: '2px solid white',
                        cursor: 'pointer',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s ease',
                        zIndex: 1000,
                        position: 'relative',
                        touchAction: 'manipulation'
                      }}
                      title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                    >
                      {micEnabled ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M12 14c1.66 0 3-1.34 3-3V5a3 3 0 0 0-6 0v6c0 1.66 1.34 3 3 3z"/>
                          <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2z"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M19 11h-1.7a6.97 6.97 0 0 1-.43 2.05l1.23 1.23a8.994 8.994 0 0 0 .9-3.28zM12 3a3 3 0 0 0-3 3v.18l6 6V6a3 3 0 0 0-3-3zM4.27 3L3 4.27l6.01 6.01V11a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52a5 5 0 0 1-5-5H5a7 7 0 0 0 11.29 5.29L19.73 21 21 19.73 4.27 3z"/>
                        </svg>
                      )}
                    </button>

                    {/* Camera Button */}
                    <button
                      onClick={handleCameraToggle}
                      onTouchStart={handleCameraToggle}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: cameraEnabled ? '#22c55e' : '#ef4444',
                        border: '2px solid white',
                        cursor: 'pointer',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s ease',
                        zIndex: 1000,
                        position: 'relative',
                        touchAction: 'manipulation'
                      }}
                      title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                    >
                      {cameraEnabled ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                        </svg>
                      )}
                    </button>

                    {/* Screen Share Button */}
                    {canShareScreen && (
                      <button
                        onClick={handleScreenShareToggle}
                        onTouchStart={handleScreenShareToggle}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: liveKitIsScreenSharing ? '#3b82f6' : '#6b7280',
                          border: '2px solid white',
                          cursor: 'pointer',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          transition: 'all 0.2s ease',
                          zIndex: 1000,
                          position: 'relative',
                          touchAction: 'manipulation'
                        }}
                        title={liveKitIsScreenSharing ? 'Stop sharing' : 'Share screen'}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </button>
                    )}

                    {/* Thumbnail Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setThumbnailPanelOpen(!thumbnailPanelOpen);
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setThumbnailPanelOpen(!thumbnailPanelOpen);
                      }}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: thumbnailPanelOpen ? '#3b82f6' : '#6b7280',
                        border: '2px solid white',
                        cursor: 'pointer',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        transition: 'all 0.2s ease',
                        zIndex: 1000,
                        position: 'relative',
                        touchAction: 'manipulation'
                      }}
                      title={thumbnailPanelOpen ? 'Hide participants' : 'Show participants'}
                    >
                      <svg 
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="white"
                        style={{
                          transform: thumbnailPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease'
                        }}
                      >
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>

                    {/* Client-Side Recording - Only for Meeting Host */}
                    {isMeetingHost && (
                      <ClientSideRecording
                        meetingId={actualMeetingId}
                        userId={currentUser?.id || currentUser?._id || 'unknown'}
                        meetingName={(meetingData as any)?.title || `Meeting_${actualMeetingId}`}
                        meetingStatus={meetingStatus}
                        liveKitService={liveKitService}
                        onRecordingStart={handleRecordingStarted}
                        onRecordingComplete={handleRecordingUploadComplete}
                        onError={handleRecordingError}
                        onUploadStatusChange={handleRecordingUploadStatusChange}
                      />
                    )}
                  </div>
                )}
              </>
            )}
            
        </div>
      </div>

        {/* Main Content - Hidden when PiP is active on mobile */}
      <div style={{
        height: viewportHeightValue,
          paddingTop: isMobile ? '10px' : '10px',
          display: (isMobile && isPiPVisible) ? 'none' : 'flex',
          flexDirection: 'column', // Always column layout for better organization
          backgroundColor: '#ffffff',
          overflow: 'hidden'
      }}>
          {/* Participant Thumbnails Row - Show when toggled open AND LiveKit is connected */}
          {thumbnailPanelOpen && isLiveKitConnected && (
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
                height: isMobile ? '15vh' : '20vh', // Increased height for desktop
                width: '100%',
              backgroundColor: '#ffffff',
                borderTop: !isMobile ? '1px solid #e5e7eb' : 'none',
                borderBottom: isMobile ? '1px solid #e5e7eb' : 'none',
              display: 'flex',
              alignItems: 'center',
                padding: isMobile ? '0 8px' : '8px 16px',
                gap: isMobile ? '12px' : '16px',
                justifyContent: 'flex-start',
                overflowX: 'auto', // ✅ Always allow horizontal scrolling
                overflowY: 'hidden',
              marginTop: '0',
              transition: 'all 0.3s ease-in-out',
                position: 'relative',
                scrollbarWidth: 'none', // Hide scrollbar
                scrollbarColor: 'transparent transparent',
                WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                flexDirection: 'row',
                minWidth: 'auto',
                maxWidth: '100%',
                boxSizing: 'border-box',
                scrollBehavior: 'smooth', // ✅ Smooth scrolling
                flexShrink: 0 // ✅ Prevent shrinking
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

              {(() => {
                // ✅ CRITICAL FIX: Use sorted queue participants for rendering, but merge with memoizedParticipants data for completeness
                // Create a map of memoized participants for quick lookup
                const memoizedMap = new Map(memoizedParticipants.map(p => [p._id, p]));
                
                // Use sorted queue participants as the source of truth for order
                const sortedParticipants = queueState.participants.map(queueP => {
                  // Merge queue participant (sorted) with memoized participant data (has user, identity, etc.)
                  const memoized = memoizedMap.get(queueP._id);
                  if (memoized) {
                    return {
                      ...memoized,
                      ...queueP, // Queue data takes precedence for sorting-related fields
                      // Preserve hand raise status from queue (it's updated immediately)
                      hasHandRaised: queueP.hasHandRaised ?? memoized.hasHandRaised,
                      isHandRaised: queueP.hasHandRaised ?? memoized.isHandRaised,
                      handRaisedAt: queueP.handRaisedAt ?? memoized.handRaisedAt,
                      // Preserve speaking status from queue
                      isSpeaking: queueP.isSpeaking ?? memoized.isSpeaking,
                      audioLevel: queueP.audioLevel ?? memoized.audioLevel
                    };
                  }
                  return queueP;
                });
                
                return sortedParticipants.map((participant, index) => {
                // Check if participant is speaking (from audio level detection)
                const isSpeaking = participant.audioLevel > 0.1 || false;
                
                // ✅ FIX: Check hand raise status from wsRaisedHands - match by multiple ID fields
                const hasHandRaisedFromWS = wsRaisedHands.some(hand => {
                  // Match by userId, participant._id, or participant.user?._id
                  const match = hand.userId === participant._id || 
                                hand.userId === participant.userId || 
                                hand.userId === participant.user?._id ||
                                hand.participantId === participant._id;
                  return match;
                });
                
                // ✅ FIX: Combine participant.isHandRaised with WebSocket data for accurate detection
                const isHandRaised = Boolean(participant.isHandRaised || participant.hasHandRaised || hasHandRaisedFromWS);
                
                // Get video and audio tracks from LiveKit room
                let videoTrack = null;
                let audioTrack = null;
                let hasScreenShare = false;
                
                // ✅ CRITICAL FIX: Use consistent identity mapping - MUST match LiveKit identity format
                // LiveKit identity is set to currentUser._id || currentUser.id || userId (line 926)
                // So we must use the same format here
                // Use participant.identity FIRST (set in line 217) since it's the correct LiveKit identity
                const participantIdentity = participant.identity || participant.user?._id || participant.userId || participant._id;
                
                // ✅ CRITICAL FIX: Check if this is the local participant FIRST
                // Compare with multiple possible identity formats
                
                // ✅ CRITICAL FIX: ONLY compare identity strings - don't use multiple fallback comparisons
                const isLocalParticipant = liveKitService?.room ? (
                  participantIdentity === liveKitService.room.localParticipant?.identity
                ) : false;
                
                
                if (liveKitService?.room) {
                  // Debug: Log available LiveKit participants
                  
                  // Debug: Log detailed participant info
                  
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
                    
                    
                    // Local participant tracks retrieved
                  } else {
                    // ✅ REMOTE PARTICIPANT: Get tracks from remoteParticipants
                    let liveKitRoomParticipant = liveKitService.room.remoteParticipants.get(participantIdentity);
                    
                    // ✅ FALLBACK: If direct lookup fails, try to find by iterating through all participants
                    if (!liveKitRoomParticipant && liveKitService.room.remoteParticipants.size > 0) {
                      for (const [identity, p] of liveKitService.room.remoteParticipants.entries()) {
                        if (identity === participantIdentity || 
                            p.identity === participantIdentity ||
                            p.name === participant.displayName ||
                            identity === participant.user?._id ||
                            identity === participant._id) {
                          liveKitRoomParticipant = p;
                          break;
                        }
                      }
                    }
                    
                    
                    if (liveKitRoomParticipant) {
                      // Debug: Log all available video tracks
                      const allVideoTracks = Array.from(liveKitRoomParticipant.videoTrackPublications.values());
                      
                      // ✅ IMPORTANT: Get camera video track for thumbnail (try multiple sources)
                      const cameraTrackPub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => {
                          const track = pub.track;
                          const source = pub.source || track?.source;
                          return source === 'camera' || (!source && !track?.source?.includes('screen'));
                        });
                      videoTrack = cameraTrackPub?.track;
                      
                      // Check if this participant has screen share active (whiteboard or regular screen share)
                      const screenSharePub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => {
                          const source = pub.source || pub.track?.source;
                          // Check enum value - Track.Source.ScreenShare
                          return source === Track.Source.ScreenShare;
                        });
                      hasScreenShare = !!screenSharePub?.track;
                      
                      // Get first audio track publication  
                      const audioTrackPub = Array.from(liveKitRoomParticipant.audioTrackPublications.values())[0];
                      audioTrack = audioTrackPub?.track;
                      
                      // Track publications retrieved
                    }
                    
                    // ✅ Guard: If no valid remote track found, enforce placeholder
                    if (!videoTrack && !isLocalParticipant) {
                      // No valid remote track found; enforce placeholder instead of attaching local
                      // (This ensures we never show the local camera for a remote participant)
                      videoTrack = null;
                    }
                  }
                }
                


                // Check if this participant is currently selected
                const isSelected = selectedParticipantId === participant._id;
                
                // Check if this participant (host) is using whiteboard
                const participantIsHost = participant.role === 'HOST' || 
                                         (isLocalParticipant && (isHost || currentUser?.systemRole === 'TUTOR' || currentUser?.systemRole === 'ADMIN'));
                
                // For local participant (host), check if whiteboard is active
                // For remote participants, check if they have screen share active (which could be whiteboard)
                const isParticipantWhiteboarding = participantIsHost && (
                  isLocalParticipant 
                    ? (isWhiteboardActive || isWhiteboardMode) 
                    : (hasScreenShare && queueState.screenShareMode && queueState.screenShareParticipant?._id === participant._id)
                );
                
                return (
                  <ParticipantThumbnail
                    key={`${participant._id}-${index}`}
                    participantId={(participant as any).backendId || participant._id}
                    name={participant.displayName || '알 수 없음'}
                    videoTrack={videoTrack}
                    audioTrack={audioTrack}
                    isSpeaking={isSpeaking}
                    isHandRaised={isHandRaised} // ✅ FIX: Use combined hand raise status from both participant state and WebSocket
                    isMuted={audioTrack?.isMuted || !audioTrack || participant.micState === 'OFF'} // ✅ Use actual LiveKit track state
                    isVideoOff={!videoTrack || videoTrack?.isMuted || (isLocalParticipant && !cameraEnabled)} // ✅ Use actual LiveKit track state
                    isHost={participant.role === 'HOST'}
                    isScreenSharing={hasScreenShare}
                    isWhiteboarding={isParticipantWhiteboarding}
                    isLocalParticipant={isLocalParticipant}
                    isSelected={isSelected} // Add selection indicator
                    currentUserIsHost={isHostState} // ✅ Check if current user is host
                    isRecording={isRecording} // ✅ Pass recording state
                    onKickParticipant={handleKickParticipantClick} // ✅ Kick participant handler
                    onLowerHand={handleHostLowerHand} // ✅ Lower hand handler for host
                    onClick={() => {
                      setSelectedParticipantId(participant._id);
                      // Participant selection only updates the main video display - no navigation needed
                    }}
                  />
                );
                });
              })()}
              
            </div>
          )}
          
          {/* Main Video Area - Responsive sizing based on thumbnail panel */}
          {/* ✅ FIX: Check for actual screen share track, not just queue state */}
          <div style={{
            flex: viewMode === 'grid' ? 1 : (thumbnailPanelOpen ? 1 : 1.2), // Full flex for grid mode
            backgroundColor: isActuallyScreenSharing ? '#000000' : (viewMode === 'grid' ? '#f3f4f6' : '#f3f4f6'),
            display: 'flex',
            flexDirection: 'column',
            // ✅ MOBILE FIX: Full screen on mobile when screen sharing
            minHeight: isActuallyScreenSharing && isMobile ? `calc(${viewportHeightValue} - 180px)` : (viewMode === 'grid' ? '0' : '60vh'), // Full screen minus header/controls on mobile
            maxHeight: isActuallyScreenSharing && isMobile ? `calc(${viewportHeightValue} - 180px)` : (viewMode === 'grid' ? 'none' : '85vh'), // Full screen on mobile
            height: isActuallyScreenSharing && isMobile ? `calc(${viewportHeightValue} - 180px)` : (viewMode === 'grid' ? '100%' : 'auto'), // Full height on mobile when screen sharing
            alignItems: isActuallyScreenSharing ? 'stretch' : (viewMode === 'grid' ? 'stretch' : 'center'),
            justifyContent: isActuallyScreenSharing ? 'stretch' : (viewMode === 'grid' ? 'stretch' : 'center'),
            position: 'relative',
            padding: isActuallyScreenSharing ? '0' : (viewMode === 'grid' ? '8px' : (isMobile ? '2vh' : '4vh')),
            paddingTop: isActuallyScreenSharing ? '0' : (viewMode === 'grid' ? '8px' : (isMobile ? '2vh' : '4vh')),
            margin: isActuallyScreenSharing ? '0' : '0',
            marginTop: '0',
            border: isActuallyScreenSharing ? 'none' : 'none',
            borderRadius: isActuallyScreenSharing ? '0' : '0',
            boxShadow: isActuallyScreenSharing ? 'none' : 'none',
            overflow: viewMode === 'grid' ? 'hidden' : 'hidden',
            transition: 'flex 0.3s ease',
            // ✅ MOBILE FIX: Ensure full width on mobile when screen sharing
            width: isActuallyScreenSharing && isMobile ? '100vw' : '100%'
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
            {!isMobile && !isActuallyScreenSharing && (
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
                            setThumbnailPanelOpen(false); // Close thumbnail panel when switching to grid
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

            {/* Main Video Content Area - ✅ FIX: Proper flexbox wrapper for full page height */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              height: '100%',
              minHeight: 0, // ✅ FIX: Allow flexbox to control height
              minWidth: 0, // ✅ FIX: Prevent overflow in flex containers
            }}>
              {/* 화이트보드 - 활성화 시 호스트에게만 표시 */}
              {/* 참가자는 LiveKit 화면 공유를 통해 스트리밍된 버전을 봄 */}
              {(() => {
                // 호스트에게만 화이트보드 편집기 표시
                const userIsHost = 
                  isHost ||
                  isCurrentHostById ||
                  currentParticipant?.role === 'HOST' ||
                  currentUser?.systemRole === 'TUTOR' ||
                  currentUser?.systemRole === 'ADMIN';
                
                if (!isWhiteboardMode || !userIsHost) {
                  return null;
                }
                
                return (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 100,
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    // ✅ MOBILE FIX: Remove fixed min dimensions on mobile for proper responsiveness
                    minWidth: isMobile ? '0' : '800px',
                    minHeight: isMobile ? '0' : '600px',
                    // ✅ MOBILE FIX: Ensure full viewport on mobile
                    maxWidth: isMobile ? '100vw' : '100%',
                    maxHeight: isMobile ? viewportHeightValue : '100%',
                    overflow: 'hidden'
                  }}>
                    <WhiteboardComponent
                      isActive={isWhiteboardMode}
                      onStreamReady={handleWhiteboardStreamReady}
                      onStreamStopped={handleWhiteboardStreamStopped}
                    />
                  </div>
                );
              })()}

              {/* Participant Queue Display with LiveKit */}
              {(() => {
                
                return null;
              })()}
              {(() => {
                // Don't show participants when whiteboard is active (host sees whiteboard editor, participants see stream)
                const userIsHost = 
                  isHost ||
                  isCurrentHostById ||
                  currentParticipant?.role === 'HOST' ||
                  currentUser?.systemRole === 'TUTOR' ||
                  currentUser?.systemRole === 'ADMIN';
                
                if (isWhiteboardMode && userIsHost) {
                  // Host sees whiteboard editor, so hide participant view
                  return null;
                }
                
                // Participants see the streamed whiteboard via LiveKit screen share in main screen
                // The main screen will automatically show screen share when whiteboard is active

                // Always render main stage if we have participants (either from LiveKit or memoized)
                const hasParticipants = (isLiveKitConnected && liveKitParticipants.size > 0) || memoizedParticipants.length > 0;
                
                if (!hasParticipants) {
                  return null;
                }
              
              // Grid mode: Show all participants in grid layout
              if (viewMode === 'grid') {
                const participantsToShow = memoizedParticipants.slice(0, gridSize === '2x2' ? 4 : gridSize === '3x3' ? 9 : 16);
                
                // ✅ FIX: Responsive grid columns based on screen size
                const getGridColumns = () => {
                  if (isMobile) {
                    // Mobile: 1 column for portrait, 2 for landscape
                    if (window.innerHeight > window.innerWidth) {
                      return '1fr'; // Portrait: single column
                    } else {
                      return '1fr 1fr'; // Landscape: 2 columns
                    }
                  }
                  // Desktop: Use gridSize setting
                  return gridSize === '2x2' ? '1fr 1fr' :
                         gridSize === '3x3' ? '1fr 1fr 1fr' :
                         '1fr 1fr 1fr 1fr';
                };
                
                const getGridRows = () => {
                  if (isMobile) {
                    // Mobile: Auto rows, let content determine
                    return 'auto';
                  }
                  // Desktop: Use gridSize setting
                  return gridSize === '2x2' ? '1fr 1fr' :
                         gridSize === '3x3' ? '1fr 1fr 1fr' :
                         '1fr 1fr 1fr 1fr';
                };
                
                return (
                  <div className="grid-mode" style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '0',
                    display: 'grid',
                    gridTemplateColumns: getGridColumns(),
                    gridTemplateRows: getGridRows(),
                    gap: isMobile ? '4px' : '8px',
                    padding: isMobile ? '4px' : '8px',
                    backgroundColor: 'transparent',
                    borderRadius: '0',
                    boxShadow: 'none',
                    alignContent: 'stretch',
                    justifyItems: 'stretch',
                    overflow: 'auto', // ✅ FIX: Allow scrolling on mobile if needed
                    gridAutoRows: 'minmax(0, 1fr)', // ✅ FIX: Ensure rows have proper sizing
                    gridAutoFlow: 'row', // ✅ FIX: Flow items row by row
                  }}>
                    {participantsToShow.map((participant, index) => {
                      // Get video and audio tracks for this participant
                      let videoTrack = null;
                      let audioTrack = null;
                      let hasScreenShare = false;
                      
                      const participantIdentity = participant.identity || participant.user?._id || participant.userId || participant._id;
                      const isLocalParticipant = liveKitService?.room ? (
                        participantIdentity === liveKitService.room.localParticipant?.identity
                      ) : false;
                      
                      if (liveKitService?.room && participant._id) {
                        if (isLocalParticipant) {
                          const cameraTrackPub = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                            .find(pub => {
                              const track = pub.track;
                              const source = pub.source || track?.source;
                              return source === 'camera' || (!source && !track?.source?.includes('screen'));
                            });
                          videoTrack = cameraTrackPub?.track;
                          const audioTrackPub = Array.from(liveKitService.room.localParticipant.audioTrackPublications.values())[0];
                          audioTrack = audioTrackPub?.track;
                        } else {
                          let liveKitRoomParticipant = liveKitService.room.remoteParticipants.get(participantIdentity);
                          if (!liveKitRoomParticipant && liveKitService.room.remoteParticipants.size > 0) {
                            for (const [identity, p] of liveKitService.room.remoteParticipants.entries()) {
                              if (identity === participantIdentity || 
                                  p.identity === participantIdentity ||
                                  p.name === participant.displayName ||
                                  identity === participant.user?._id ||
                                  identity === participant._id) {
                                liveKitRoomParticipant = p;
                                break;
                              }
                            }
                          }
                          
                          if (liveKitRoomParticipant) {
                            const cameraTrackPub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                              .find(pub => {
                                const track = pub.track;
                                const source = pub.source || track?.source;
                                return source === 'camera' || (!source && !track?.source?.includes('screen'));
                              });
                            videoTrack = cameraTrackPub?.track;
                            const audioTrackPub = Array.from(liveKitRoomParticipant.audioTrackPublications.values())[0];
                            audioTrack = audioTrackPub?.track;
                          }
                        }
                      }
                      
                      const isHandRaised = Boolean(participant.isHandRaised || participant.hasHandRaised);
                      
                      return (
                        <div key={participant._id} className="grid-mode-item" style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '0',
                          minWidth: '0',
                          borderRadius: isMobile ? '6px' : '8px',
                          overflow: 'hidden',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          backgroundColor: '#1f2937',
                          display: 'flex',
                          alignItems: 'stretch',
                          justifyContent: 'stretch',
                          position: 'relative',
                          aspectRatio: '16 / 9', // ✅ FIX: Maintain 16:9 aspect ratio for grid items
                          flex: '1 1 auto' // ✅ FIX: Allow flexbox sizing
                        }}>
                          <MainStageView
                            participantId={participant._id}
                            name={participant.displayName || '참가자'}
                            videoTrack={videoTrack}
                            audioTrack={audioTrack}
                            isSpeaking={(participant.audioLevel || 0) > 0.1}
                            isHandRaised={isHandRaised}
                            isMuted={participant.micState === 'OFF' || false}
                            isVideoOff={!videoTrack || videoTrack?.isMuted || (isLocalParticipant && !cameraEnabled)}
                            isHost={participant.role === 'HOST' || false}
                            isScreenSharing={false}
                            screenShareTrack={null}
                            connectionQuality={5}
                            isLocalParticipant={isLocalParticipant}
                            isRecording={isRecording}
                            onParticipantClick={(participantId) => {
                              setSelectedParticipantId(participantId);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              }
              
              // 스피커 모드: 메인 스테이지용 참가자 가져오기
              // 중요 수정: 화면 공유가 활성화되어 있으면 화면 공유 참가자를 먼저 우선순위 지정
              // 다른 참가자가 말할 때 화이트보드가 사라지는 것을 방지
              let mainParticipant = null;
              
              // 우선순위 1: 화면 공유 참가자 (화이트보드가 최우선순위)
              if (queueState.screenShareMode && queueState.screenShareParticipant) {
                const screenShareParticipant = memoizedParticipants.find(p => 
                  p._id === queueState.screenShareParticipant?._id ||
                  p.identity === queueState.screenShareParticipant?._id ||
                  p.backendId === queueState.screenShareParticipant?._id ||
                  p.user?._id === queueState.screenShareParticipant?.userId ||
                  p.userId === queueState.screenShareParticipant?.userId
                );
                if (screenShareParticipant) {
                  mainParticipant = screenShareParticipant;
                }
              }
              
              // 우선순위 2: 활성 화면 공유(화이트보드)가 있는 참가자 확인
              // 먼저 로컬 참가자(호스트)의 화면 공유 확인
              if (liveKitService?.room?.localParticipant) {
                const localHasScreenShare = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                  .some(pub => {
                    const source = pub.source || pub.track?.source;
                    return source === Track.Source.ScreenShare;
                  });
                
                if (localHasScreenShare) {
                  // 목록에서 로컬 참가자 찾기 - identity로 매칭
                  const localIdentity = liveKitService.room.localParticipant.identity;
                  const localParticipant = memoizedParticipants.find(p => 
                    p.identity === localIdentity ||
                    p._id === localIdentity ||
                    p.user?._id === localIdentity ||
                    p.userId === localIdentity
                  );
                  
                  if (localParticipant) {
                    mainParticipant = localParticipant;
                  }
                }
              }
              
              // 우선순위 3: 원격 참가자의 화면 공유 확인 (아직 찾지 못한 경우)
              if (!mainParticipant && liveKitService?.room) {
                for (const [identity, remoteParticipant] of liveKitService.room.remoteParticipants.entries()) {
                  const hasScreenShare = Array.from(remoteParticipant.videoTrackPublications.values())
                    .some(pub => {
                      const source = pub.source || pub.track?.source;
                      return source === Track.Source.ScreenShare;
                    });
                  
                  if (hasScreenShare) {
                    // 목록에서 일치하는 참가자 찾기 - 가능한 모든 ID 형식 시도
                    const matchingParticipant = memoizedParticipants.find(p => 
                      p.identity === identity ||
                      p._id === identity || 
                      p.user?._id === identity ||
                      p.userId === identity ||
                      (p as any).backendId === identity
                    );
                    
                    if (matchingParticipant) {
                      mainParticipant = matchingParticipant;
                      break;
                    }
                  }
                }
              }
              
              // 우선순위 4: 선택된 참가자
              if (!mainParticipant && selectedParticipant) {
                mainParticipant = selectedParticipant;
              }
              
              // 우선순위 5: 활성 스피커
              if (!mainParticipant && memoizedActiveSpeaker) {
                mainParticipant = memoizedActiveSpeaker;
              }
              
              // 우선순위 6: 첫 번째 참가자
              if (!mainParticipant && memoizedParticipants.length > 0) {
                mainParticipant = memoizedParticipants[0];
              }
              
              if (!mainParticipant) {
                return null;
              }
              

                // Get video and audio tracks for main stage
                let mainVideoTrack = null;
                let mainAudioTrack = null;
                let mainScreenShareTrack = null;
                let isParticipantScreenSharing = false;
                
                // ✅ FIX: Only show screen share if queue state is active AND track exists
                // This prevents black screen after refresh or when screen sharing stops
                const shouldShowScreenShare = queueState.screenShareMode && queueState.screenShareParticipant;

                // 중요 수정: 일관된 identity 매핑 사용 - LiveKit identity 형식과 반드시 일치해야 함
                // LiveKit identity는 currentUser._id || currentUser.id || userId로 설정됨
                // 올바른 LiveKit identity이므로 participant.identity를 먼저 사용 (memoizedParticipants에서 설정됨)
                const participantIdentity = mainParticipant.identity || mainParticipant.user?._id || mainParticipant.userId || mainParticipant._id;
                
                // 중요 수정: 이것이 로컬 참가자인지 먼저 확인
                // 모든 경우를 포착하도록 여러 가능한 identity 형식 비교
                const localIdentity = liveKitService?.room?.localParticipant?.identity;
                const isLocalParticipant = liveKitService?.room && localIdentity ? (
                  participantIdentity === localIdentity ||
                  mainParticipant._id === localIdentity ||
                  mainParticipant.user?._id === localIdentity ||
                  mainParticipant.userId === localIdentity ||
                  mainParticipant.identity === localIdentity
                ) : false;
                
                
                if (liveKitService?.room && mainParticipant._id) {
                  
                  if (isLocalParticipant) {
                    // 로컬 참가자 - localParticipant에서 트랙 가져오기
                    
                    // 카메라 비디오 트랙 가져오기 (화면 공유 아님)
                    const cameraTrackPub = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                      .find(pub => {
                        const track = pub.track;
                        const source = pub.source || track?.source;
                        return source === 'camera' || (!source && !track?.source?.includes('screen'));
                      });
                    mainVideoTrack = cameraTrackPub?.track;
                    
                    const audioTrackPub = Array.from(liveKitService.room.localParticipant.audioTrackPublications.values())[0];
                    mainAudioTrack = audioTrackPub?.track;
                    
                    // 화면 공유 확인 (화이트보드 또는 일반 화면 공유)
                    const screenShareTrackPub = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
                      .find(pub => {
                        const source = pub.source || pub.track?.source;
                        // enum 값 확인 - Track.Source.ScreenShare
                        return source === Track.Source.ScreenShare;
                      });
                    mainScreenShareTrack = screenShareTrackPub?.track;
                    isParticipantScreenSharing = !!mainScreenShareTrack;
                  } else {
                    // 원격 참가자 - remoteParticipants에서 트랙 가져오기
                    let liveKitRoomParticipant = liveKitService.room.remoteParticipants.get(participantIdentity);
                    
                    // 대체 방법: 직접 조회가 실패하면 모든 참가자를 반복하여 찾기 시도
                    if (!liveKitRoomParticipant && liveKitService.room.remoteParticipants.size > 0) {
                      for (const [identity, p] of liveKitService.room.remoteParticipants.entries()) {
                        if (identity === participantIdentity || 
                            p.identity === participantIdentity ||
                            p.name === mainParticipant.displayName ||
                            identity === mainParticipant.user?._id ||
                            identity === mainParticipant._id) {
                          liveKitRoomParticipant = p;
                          break;
                        }
                      }
                    }
                    
                    
                    if (liveKitRoomParticipant) {
                      // 디버그: 메인 비디오에 사용 가능한 모든 비디오 트랙 로그
                      const allVideoTracks = Array.from(liveKitRoomParticipant.videoTrackPublications.values());
                      
                      // 카메라 비디오 트랙 가져오기 (화면 공유 아님)
                      const cameraTrackPub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => {
                          const track = pub.track;
                          const source = pub.source || track?.source;
                          return source === 'camera' || (!source && !track?.source?.includes('screen'));
                        });
                      mainVideoTrack = cameraTrackPub?.track;
                      
                      const audioTrackPub = Array.from(liveKitRoomParticipant.audioTrackPublications.values())[0];
                      mainAudioTrack = audioTrackPub?.track;
                      
                      // 화면 공유 확인 (화이트보드 또는 일반 화면 공유)
                      const screenShareTrackPub = Array.from(liveKitRoomParticipant.videoTrackPublications.values())
                        .find(pub => {
                          const source = pub.source || pub.track?.source;
                          // enum 값 확인 - Track.Source.ScreenShare
                          return source === Track.Source.ScreenShare;
                        });
                      mainScreenShareTrack = screenShareTrackPub?.track;
                      isParticipantScreenSharing = !!mainScreenShareTrack;
                    }
                    
                    // 가드: 유효한 원격 트랙을 찾지 못한 경우 플레이스홀더 강제 적용
                    if (!mainVideoTrack && !isLocalParticipant) {
                      // 유효한 원격 트랙을 찾지 못함; 로컬을 연결하는 대신 플레이스홀더 강제 적용
                      // (이렇게 하면 원격 참가자에게 로컬 카메라를 절대 표시하지 않음)
                      mainVideoTrack = null;
                      mainAudioTrack = null;
                    }
                  }
                } else {
                  // 대체 방법: 메모이제이션된 참가자의 경우 비디오 트랙을 null로 설정
                  mainVideoTrack = null;
                  mainAudioTrack = null;
                  mainScreenShareTrack = null;
                  isParticipantScreenSharing = false;
                }

                // 참고: isLocalParticipant는 위에서 이미 정의되었으므로 재사용
                const isMainParticipantLocal = isLocalParticipant;

                // ✅ FIX: Check hand raise status for main participant (same logic as thumbnails)
                const hasHandRaisedFromWS = wsRaisedHands.some(hand => {
                  // Match by userId, participant._id, or participant.user?._id
                  const match = hand.userId === mainParticipant._id || 
                                hand.userId === mainParticipant.userId || 
                                hand.userId === mainParticipant.user?._id ||
                                hand.participantId === mainParticipant._id;
                  return match;
                });
                
                // ✅ FIX: Combine participant.isHandRaised with WebSocket data for accurate detection
                const mainIsHandRaised = Boolean(mainParticipant.isHandRaised || mainParticipant.hasHandRaised || hasHandRaisedFromWS);

                // ✅ COMPREHENSIVE DEBUG: Log all main video assignments


                // CRITICAL FIX: Removed continuous logging - only log when track actually changes
                // The previous logging was causing console spam and performance issues

                // ✅ FIX: Only show screen share if we have an actual track AND queue state says it's active
                // This prevents black screen when screen sharing stops or after page refresh
                const finalIsScreenSharing = Boolean(shouldShowScreenShare && isParticipantScreenSharing && mainScreenShareTrack);
                
                return (
                  <MainStageView
                    participantId={mainParticipant._id}
                    name={mainParticipant.displayName || 'Main Stage'}
                    videoTrack={mainVideoTrack}
                    audioTrack={mainAudioTrack}
                    isSpeaking={(mainParticipant.audioLevel || 0) > 0.1}
                    isHandRaised={mainIsHandRaised} // ✅ FIX: Use combined hand raise status
                    isMuted={mainParticipant.micState === 'OFF' || false}
                    isVideoOff={!mainVideoTrack || mainVideoTrack?.isMuted || (isMainParticipantLocal && !cameraEnabled)} // ✅ FIX: Check if track is muted - treat muted tracks as video off to show fallback UI
                    isHost={mainParticipant.role === 'HOST' || false}
                    isScreenSharing={finalIsScreenSharing}
                    screenShareTrack={finalIsScreenSharing ? mainScreenShareTrack : null}
                    connectionQuality={5} // TODO: Get actual connection quality
                    isLocalParticipant={isMainParticipantLocal}
                    isRecording={isRecording} // ✅ Pass recording state
                    onParticipantClick={(participantId) => {
                      const participant = memoizedParticipants.find(p => p._id === participantId);
                      if (participant) {
                        setSelectedParticipantId(participantId);
                        // Participant selection only updates the main video display - no navigation needed
                      }
                    }}
                  />
                );
              })()}
            {(!isLiveKitConnected || liveKitParticipants.size === 0) && queueState.participants.length > 0 ? (
              <ParticipantQueue
                participants={queueState.participants}
                activeSpeaker={queueState.activeSpeaker}
                screenShareMode={queueState.screenShareMode}
                screenShareParticipant={queueState.screenShareParticipant}
                selectedParticipant={selectedParticipant}
                onParticipantClick={(participant) => {
                  setSelectedParticipantId(participant._id);
                  // Participant selection only updates the main video display - no navigation needed
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
          
          {/* Video Player Control Bar - Auto-hide */}
          <div style={{
            // When controls are hidden in video player mode, completely remove the section (height: 0)
            height: (isVideoPlayerMode && !showControls) 
              ? '0px' 
              : (isMobile ? '80px' : '80px'),
            backgroundColor: isVideoPlayerMode 
              ? (showControls ? 'rgba(0, 0, 0, 0.7)' : 'transparent')
              : 'transparent',
            borderTop: isVideoPlayerMode 
              ? (showControls ? '1px solid rgba(255, 255, 255, 0.1)' : 'none')
              : 'none',
            display: (isVideoPlayerMode && !showControls) ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '8px 12px' : '0 24px', // Added top padding for mobile
            boxShadow: isVideoPlayerMode 
              ? (showControls ? '0 -2px 10px rgba(0,0,0,0.3)' : 'none')
              : 'none',
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
            backdropFilter: isVideoPlayerMode && showControls ? 'blur(10px)' : 'none',
            // Ensure mobile controls are always visible when shown
            minHeight: (isVideoPlayerMode && !showControls) 
              ? '0px' 
              : (isMobile ? '80px' : '80px'),
            // Hide completely when controls are closed in video player mode
            opacity: isVideoPlayerMode && !showControls ? 0 : 1,
            pointerEvents: isVideoPlayerMode && !showControls ? 'none' : 'auto',
            overflow: 'hidden' // Hide content when height is 0
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: isMobile ? '10px' : '16px',
              width: '100%',
              justifyContent: 'center',
              flexWrap: isMobile ? 'nowrap' : 'wrap', // Prevent wrapping on mobile
              overflow: 'visible' // Ensure content is visible
            }}>
              {/* Participant Count */}
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
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
                  backgroundColor: micEnabled 
                    ? 'rgba(34, 197, 94, 0.9)' 
                    : 'rgba(239, 68, 68, 0.85)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(10px)'
                }}
                title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {micEnabled ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5a3 3 0 0 0-6 0v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M19 11h-1.7a6.97 6.97 0 0 1-.43 2.05l1.23 1.23a8.994 8.994 0 0 0 .9-3.28zM12 3a3 3 0 0 0-3 3v.18l6 6V6a3 3 0 0 0-3-3zM4.27 3L3 4.27l6.01 6.01V11a3 3 0 0 0 3 3c.22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52a5 5 0 0 1-5-5H5a7 7 0 0 0 11.29 5.29L19.73 21 21 19.73 4.27 3z"/>
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
                  backgroundColor: cameraEnabled 
                    ? 'rgba(34, 197, 94, 0.9)' 
                    : 'rgba(239, 68, 68, 0.85)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(10px)'
                }}
                title={cameraEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {cameraEnabled ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M21 6.5l-4 4V7a1 1 0 0 0-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                  </svg>
                )}
              </button>

              {/* Screen Share Control */}
              {canShareScreen && (
                <button
                  onClick={handleScreenShareToggle}
                  style={{
                    width: isMobile ? '40px' : '48px',
                    height: isMobile ? '40px' : '48px',
                    borderRadius: '50%',
                    backgroundColor: liveKitIsScreenSharing 
                      ? 'rgba(59, 130, 246, 0.9)' 
                      : 'rgba(243, 244, 246, 0.85)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    cursor: 'pointer',
                    color: liveKitIsScreenSharing ? 'white' : '#1f2937',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                  title={liveKitIsScreenSharing ? 'Stop sharing' : 'Share screen'}
                >
                  <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78 0-4.61.85-6 2.72.56-2.67 2.11-5.33 6-5.87V7l4 3.73-4 3.74z"/>
                  </svg>
                </button>
              )}

              {/* 화이트보드 제어 - 호스트 전용 */}
              {(() => {
                // ✅ CRITICAL FIX: Only show whiteboard button to ACTUAL HOST, TUTOR, or ADMIN users
                // DO NOT rely on 'role' prop as it defaults to 'HOST' - use actual participant data
                
                // Check system roles first (TUTOR and ADMIN are always allowed)
                const isSystemAdmin = currentUser?.systemRole === 'TUTOR' || currentUser?.systemRole === 'ADMIN';
                
                // If no currentParticipant data, only allow system admins
                if (!currentParticipant) {
                  if (!isSystemAdmin) {
                    return null;
                  }
                  // System admin can see button even without participant data - continue to render button below
                }
                
                // First, check if user is explicitly a PARTICIPANT - if so, hide button immediately
                // (unless they're a system admin)
                if (currentParticipant?.role === 'PARTICIPANT' && !isSystemAdmin) {
                  return null;
                }
                
                // Check if user is actual HOST from participant data
                const isActualHost = currentParticipant?.role === 'HOST';
                
                // Check if found in memoized participants list with HOST role
                const isHostInList = currentParticipant ? memoizedParticipants.some(p => {
                  const pId = p._id || p.user?._id || (p as any).backendId;
                  const currentId = currentParticipant._id || currentParticipant.user?._id || (currentParticipant as any)?.backendId;
                  return pId === currentId && p.role === 'HOST';
                }) : false;
                
                // Only show button if user is confirmed HOST, TUTOR, or ADMIN
                // DO NOT use 'role' prop as it defaults to 'HOST' and is unreliable for participants
                const userIsHost = isActualHost || isSystemAdmin || isHostInList || isCurrentHostById;
                
                // ✅ STRICT CHECK: Hide button for all non-host participants
                if (!userIsHost) {
                  return null;
                }
                
                return (
                  <button
             onClick={(e) => {
               e.preventDefault();
               e.stopPropagation();
               handleWhiteboardToggle();
             }}
                    style={{
                      width: isMobile ? '40px' : '48px',
                      height: isMobile ? '40px' : '48px',
                      borderRadius: '50%',
                      backgroundColor: isWhiteboardActive 
                        ? 'rgba(139, 92, 246, 0.9)' 
                        : 'rgba(243, 244, 246, 0.85)',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      cursor: 'pointer',
                      color: isWhiteboardActive ? 'white' : '#1f2937',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      backdropFilter: 'blur(10px)',
                      flexShrink: 0,
                      zIndex: 1000,
                      position: 'relative'
                    }}
                    title={isWhiteboardActive ? '화이트보드 닫기' : '화이트보드 열기'}
                  >
                    <svg width={isMobile ? "18" : "20"} height={isMobile ? "18" : "20"} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                );
              })()}

              {/* Chat Control */}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  width: isMobile ? '40px' : '48px',
                  height: isMobile ? '40px' : '48px',
                  borderRadius: '50%',
                  backgroundColor: sidebarOpen 
                    ? 'rgba(59, 130, 246, 0.9)' 
                    : 'rgba(243, 244, 246, 0.85)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  color: sidebarOpen ? 'white' : '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(10px)'
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
              {(() => {
                return (
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
                );
              })()}

              {/* ✅ FIX: Recording Button removed from bottom - Now only in TOP HEADER for mobile */}

              {/* Leave Button */}
              <button
                onClick={handleLeaveMeeting}
                style={{
                  width: isMobile ? '44px' : '52px',
                  height: isMobile ? '44px' : '52px',
                  borderRadius: '50%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'transform 0.2s ease',
                  filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.25))'
                }}
                title="회의 나가기"
                onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <img
                  src="/Icons/endMeeting.svg"
                  alt="회의 종료"
                  style={{
                    width: isMobile ? '42px' : '48px',
                    height: isMobile ? '42px' : '48px',
                    opacity: 0.9
                  }}
                />
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
            height: isMobile ? `calc(${viewportHeightValue} - 136px)` : `calc(${viewportHeightValue} - 150px)`,
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
                {isHost ? '참가자 & 채팅' : '채팅'}
              </h3>
        </div>

                      {/* Only show Active Students tab if user is confirmed meeting host - strict check */}
                      {isHost && currentParticipant && currentParticipant.role === 'HOST' ? (
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
                            참여 학생 ({participants.length})
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
                      ) : (
                        <div style={{
                          display: 'flex',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          <button
                            onClick={() => setActiveTab('chat')}
                            style={{
                              width: '100%',
                              padding: '16px',
                              border: 'none',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: '500',
                              borderBottom: '2px solid #3b82f6',
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
                      )}

            <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Double check - only show participants list if user is confirmed host - strict check */}
            {activeTab === 'participants' && isHost && currentParticipant && currentParticipant.role === 'HOST' && (
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
      </div>
        
      </>
    );
  });

ProfessionalLiveStreamRoom.displayName = 'ProfessionalLiveStreamRoom';

export default ProfessionalLiveStreamRoom;