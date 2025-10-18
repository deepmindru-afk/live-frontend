import React, { useEffect, useRef } from 'react';
import { Participant } from '../hooks/useParticipantQueue';
import { LiveKitParticipant } from '../lib/livekit-service';
import { Track } from 'livekit-client';

// Track source constants from LiveKit
const CAMERA_SOURCE = 'camera';
const SCREEN_SHARE_SOURCE = 'screen_share';

interface LiveKitParticipantQueueProps {
  // Original props
  participants: Participant[];
  activeSpeaker: Participant | null;
  screenShareMode: boolean;
  screenShareParticipant: Participant | null;
  selectedParticipant?: Participant | null;
  selectedIdentity?: string | null;
  onParticipantClick?: (participant: Participant) => void;
  onHandRaiseClick?: (participant: Participant) => void;
  onKickParticipant?: (participant: Participant) => void;
  isHost?: boolean;
  viewMode?: 'grid' | 'speaker';
  maxThumbnails?: number;
  
  // LiveKit props
  liveKitParticipants: Map<string, LiveKitParticipant>;
  localParticipant: LiveKitParticipant | null;
  liveKitService: any;
  isLiveKitConnected: boolean;
}

const LiveKitParticipantQueue: React.FC<LiveKitParticipantQueueProps> = ({
  participants,
  activeSpeaker,
  screenShareMode,
  screenShareParticipant,
  selectedParticipant,
  selectedIdentity,
  onParticipantClick,
  onHandRaiseClick,
  onKickParticipant,
  isHost = false,
  viewMode = 'speaker',
  maxThumbnails = 6,
  liveKitParticipants,
  localParticipant,
  liveKitService,
  isLiveKitConnected
}) => {
  // CIRCUIT BREAKER: Track render count and stop after threshold
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  
  // Circuit breaker status
  const hasInfiniteLoop = renderCountRef.current > 30;
  
  // Track last render time to detect rapid re-renders
  const lastRenderTimeRef = useRef(Date.now());
  const currentTime = Date.now();
  const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
  lastRenderTimeRef.current = currentTime;
  
  // If re-rendering too fast, skip some operations
  const isRapidRerender = timeSinceLastRender < 100; // Less than 100ms
  
  // Track ALL prop changes to find what's causing re-renders
  const prevPropsRef = useRef({ 
    participants, 
    viewMode, 
    liveKitParticipants, 
    isLiveKitConnected,
    liveKitService,
    activeSpeaker,
    screenShareMode,
    screenShareParticipant,
    selectedParticipant,
    onParticipantClick,
    onHandRaiseClick,
    onKickParticipant,
    isHost,
    maxThumbnails,
    localParticipant
  });
  
  
  // Update ref with current values
  prevPropsRef.current = { 
    participants, 
    viewMode, 
    liveKitParticipants, 
    isLiveKitConnected,
    liveKitService,
    activeSpeaker,
    screenShareMode,
    screenShareParticipant,
    selectedParticipant,
    onParticipantClick,
    onHandRaiseClick,
    onKickParticipant,
    isHost,
    maxThumbnails,
    localParticipant
  };
  
  // Filter out invalid participants to prevent undefined entries
  const validLiveKitParticipants = Array.from(liveKitParticipants.entries())
    .filter(([id, p]) => id && p && p.name)
    .map(([id, p]) => ({ id, name: p.name }));
  
  
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const trackRefs = useRef<{ [key: string]: any }>({});
  
  // Essential error logging only
  const errorLog = (message: string, error?: any) => {
    console.error(`[LiveKitParticipantQueue] ${message}`, error || '');
  };

  // Track participants prop changes
  const prevParticipantsRef2 = useRef(participants);
  useEffect(() => {
    if (prevParticipantsRef2.current !== participants) {
      prevParticipantsRef2.current = participants;
    }
  }, [participants]);

  // Connect LiveKit video tracks to video elements
  useEffect(() => {
    if (!liveKitService?.room) return;

    const room = liveKitService.room;
    
    // 1️⃣ Ensure local camera is published and retry once if needed
    const ensureLocalCameraPublished = async () => {
      if (!room?.localParticipant) return;
      const alreadyPublished = Array.from(room.localParticipant.videoTrackPublications.values())
        .some((pub: any) => pub.source === 'camera' && pub.track);
      if (alreadyPublished) return;

      try {
        console.warn('[AUTO-PUBLISH] No local camera track found — trying to publish...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const [track] = stream.getVideoTracks();
        if (track) {
          const { createLocalVideoTrack } = await import('livekit-client');
          const localTrack = await createLocalVideoTrack({ deviceId: track.getSettings().deviceId });
          await room.localParticipant.publishTrack(localTrack);
          console.log('[AUTO-PUBLISH] Camera track published successfully ✅');
        }
      } catch (err: any) {
        console.error('[AUTO-PUBLISH ERROR]', err.name, err.message);
      }
    };

    ensureLocalCameraPublished();
    
    

    // NOTE: Video elements ready notification removed - no longer needed
    // Camera is enabled during initial LiveKit connection

    // Handle track subscription for remote participants
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      
      // CRITICAL FIX: Find the matching participant from our participants list first
      // This ensures we use the same participant object that was used for registration
      const matchingParticipant = participants.find(p => {
        // Try multiple matching strategies
        const userId = p.user?._id || p.userId || p._id;
        const displayName = p.displayName || '';
        const liveKitName = participant.name || '';
        
        // PRIMARY: Exact ID matches (most reliable)
        if (userId === participant.identity || p._id === participant.identity || p.userId === participant.identity) {
          return true;
        }
        
        // SECONDARY: Exact name match (only if IDs don't match)
        if (displayName === liveKitName && displayName !== '' && liveKitName !== '') {
          return true;
        }
        
        // REMOVED: Fuzzy matching that was causing wrong matches
        // This was the problem - "Admin" was matching "Adminnn"
        
        return false;
      });
      
      if (!matchingParticipant) {
        // 2️⃣ Add debug printout for remote participants missing tracks
        console.warn('[REMOTE-NO-MATCH]', participant.identity, participant.name,
          'has no matching participant or no camera track; waiting for publication…');
          
        // FALLBACK: Try to find by LiveKit identity directly in videoRefs
        const directVideoElement = videoRefs.current[participant.identity];
        const isScreenShare = track.source === SCREEN_SHARE_SOURCE || 
                             track.source === 'screen_share' ||
                             String(track.source).includes('screen');
        
        if (directVideoElement && track.kind === Track.Kind.Video && !isScreenShare) {
          try {
            track.attach(directVideoElement);
            trackRefs.current[participant.identity] = track;
          } catch (error) {
            errorLog(`Error attaching track via FALLBACK for ${participant.name}`, error);
          }
        }
        
        return;
      }
      
      // Use the matching participant's data for consistent key lookup
      const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
      const displayName = matchingParticipant.displayName;
      
      // Try multiple lookup methods for video element
      let videoElement = videoRefs.current[matchingParticipant._id] ||
                        videoRefs.current[participant.identity] ||
                        videoRefs.current[userId] ||
                        videoRefs.current[displayName];

      // Only attach CAMERA tracks (skip screen share)
      const isScreenShare = track.source === SCREEN_SHARE_SOURCE || 
                           track.source === 'screen_share' ||
                           String(track.source).includes('screen');
      
      if (videoElement && track.kind === Track.Kind.Video && !isScreenShare) {
        try {
          // Ensure video element has valid dimensions to prevent WebRTC encoding issues
          if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
            videoElement.style.width = '320px';
            videoElement.style.height = '240px';
          }
          
          track.attach(videoElement);
          trackRefs.current[matchingParticipant._id] = track;
        } catch (error) {
          errorLog(`Error attaching track for ${displayName}`, error);
        }
      }
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind === Track.Kind.Video) {
        // Find the matching participant to get consistent keys
        const matchingParticipant = participants.find(p => {
          const userId = p.user?._id || p.userId || p._id;
          return (
            userId === participant.identity ||
            p.displayName === participant.name ||
            p._id === participant.identity ||
            p.userId === participant.identity
          );
        });
        
        if (!matchingParticipant) {
          return;
        }
        
        const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
        const displayName = matchingParticipant.displayName;
        
        track.detach();
        delete trackRefs.current[matchingParticipant._id];
        
        // Try to find video element using multiple keys
        let videoElement = videoRefs.current[matchingParticipant._id] || 
                          videoRefs.current[participant.identity] || 
                          videoRefs.current[userId] || 
                          videoRefs.current[displayName];
        
        if (videoElement) {
          videoElement.srcObject = null;
        }
      }
    };

    // Handle local participant tracks
    const handleLocalTrackPublished = (publication: any, participant: any) => {
      if (publication.kind === Track.Kind.Video && participant.isLocal) {
        let videoElement = videoRefs.current[participant.identity];
        
        if (!videoElement) {
          const matchingParticipant = participants.find(p => 
            (p.user?._id === participant.identity) || 
            (p.userId === participant.identity) ||
            (p._id === participant.identity)
          );
          if (matchingParticipant) {
            const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
            videoElement = videoRefs.current[userId];
          }
        }
        
        if (!videoElement) {
          videoElement = videoRefs.current[participant.name] || 
                        videoRefs.current[participant._id];
        }
        
        if (videoElement && publication.track) {
          try {
            if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
              videoElement.style.width = '320px';
              videoElement.style.height = '240px';
            }
            
            publication.track.attach(videoElement);
            trackRefs.current[participant.identity] = publication.track;
          } catch (error) {
            errorLog(`Error attaching local track for ${participant.name}`, error);
          }
        }
      }
    };

    // Attach existing tracks
    if (room && room.participants) {
      const participantsArray = Array.from(room.participants.values());
      
      participantsArray.forEach((participant: any) => {
        if (participant.trackPublications && participant.trackPublications.size > 0) {
          const publications = Array.from(participant.trackPublications.values());
          publications.forEach((publication: any) => {
            const isScreenShare = publication.source === SCREEN_SHARE_SOURCE || 
                                 publication.source === 'screen_share' ||
                                 String(publication.source).includes('screen');
            
            if (publication.track && publication.kind === Track.Kind.Video && !isScreenShare) {
              let videoElement = videoRefs.current[participant.identity];
              
              if (!videoElement) {
                const matchingParticipant = participants.find(p => 
                  (p.user?._id === participant.identity) || 
                  (p.userId === participant.identity) ||
                  (p._id === participant.identity)
                );
                if (matchingParticipant) {
                  const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
                  videoElement = videoRefs.current[userId];
                }
              }
              
              if (!videoElement) {
                videoElement = videoRefs.current[participant.name] || 
                              videoRefs.current[participant._id];
              }
              
              if (videoElement) {
                try {
                  if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
                    videoElement.style.width = '320px';
                    videoElement.style.height = '240px';
                  }
                  
                  publication.track.attach(videoElement);
                  trackRefs.current[participant.identity] = publication.track;
                } catch (error) {
                  errorLog(`Error attaching existing track for ${participant.name}`, error);
                }
              }
            }
          });
        }
      });
    }

    // Attach local participant tracks
    if (room && room.localParticipant) {
      if (room.localParticipant.trackPublications && room.localParticipant.trackPublications.size > 0) {
        const publications = Array.from(room.localParticipant.trackPublications.values());
        
        publications.forEach((publication: any) => {
          const isScreenShare = publication.source === SCREEN_SHARE_SOURCE || 
                               publication.source === 'screen_share' ||
                               String(publication.source).includes('screen');
          
          if (publication.track && publication.kind === Track.Kind.Video && !isScreenShare) {
            let videoElement = videoRefs.current[room.localParticipant.identity];
            
            if (!videoElement) {
              const matchingParticipant = participants.find(p => 
                (p.user?._id === room.localParticipant.identity) || 
                (p.userId === room.localParticipant.identity) ||
                (p._id === room.localParticipant.identity)
              );
              if (matchingParticipant) {
                const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
                videoElement = videoRefs.current[userId];
              }
            }
            
            if (!videoElement) {
              videoElement = videoRefs.current[room.localParticipant.name] || 
                            videoRefs.current[room.localParticipant._id];
            }
            
            if (videoElement) {
              try {
                if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
                  videoElement.style.width = '320px';
                  videoElement.style.height = '240px';
                }
                
                publication.track.attach(videoElement);
                trackRefs.current[room.localParticipant.identity] = publication.track;
              } catch (error) {
                errorLog(`Error attaching local participant track`, error);
              }
            }
          }
        });
      }
    }

    // Add event listeners
    if (room && typeof room.on === 'function') {
      room.on('trackSubscribed', handleTrackSubscribed);
      room.on('trackUnsubscribed', handleTrackUnsubscribed);
      room.on('localTrackPublished', handleLocalTrackPublished);
    }

    // 3️⃣ Add a short delayed check to list all current publications
    setTimeout(() => {
      if (room && room.participants && typeof room.participants.values === 'function') {
        console.log('[ROOM-PUBLISHES]',
          Array.from(room.participants.values()).map((p: any) => ({
            name: p.name,
            id: p.identity,
            tracks: Array.from(p.trackPublications.values()).map((t: any) => ({
              kind: t.kind, source: t.source, track: !!t.track
            }))
          }))
        );
      }
    }, 1500);

    return () => {
      if (room && typeof room.off === 'function') {
        room.off('trackSubscribed', handleTrackSubscribed);
        room.off('trackUnsubscribed', handleTrackUnsubscribed);
        room.off('localTrackPublished', handleLocalTrackPublished);
      }
      
      // Clean up track references
      Object.entries(trackRefs.current).forEach(([key, track]: [string, any]) => {
        if (track) {
          track.detach();
        }
      });
      trackRefs.current = {};
    };
  }, [liveKitService]);

  // Get main stage participants based on view mode
  const getMainStageParticipants = () => {
    if (screenShareMode && screenShareParticipant) {
      return [screenShareParticipant];
    }
    
    if (viewMode === 'speaker') {
      // Speaker mode: Show selectedParticipant if available, otherwise first participant
      if (selectedParticipant && participants.find(p => p._id === selectedParticipant._id)) {
        return [selectedParticipant];
      }
      // Fallback to first participant if no selected participant or selected participant not found
      return participants.slice(0, 1);
    }
    
    // Grid mode: Show ALL participants in the main stage
    return participants;
  };

  // Get thumbnail participants based on view mode
  const getThumbnailParticipants = () => {
    if (screenShareMode) {
      // In screen share mode, show ALL participants as thumbnails (including screen sharer's camera)
      return participants;
    }
    
    if (viewMode === 'speaker') {
      // Speaker mode: Show all participants except the one being displayed as main video
      const mainParticipants = getMainStageParticipants();
      const mainParticipantId = mainParticipants[0]?._id;
      return participants.filter(p => p._id !== mainParticipantId);
    }
    
    // Grid mode: No thumbnails needed since all participants are in main stage
    return [];
  };

  const mainStageParticipants = getMainStageParticipants();
  const thumbnailParticipants = getThumbnailParticipants();
  
  
  

  // Helper function to get user ID from participant (used as LiveKit identity)
  const getUserIdFromParticipant = (participant: Participant): string | null => {
    return participant?.identity || participant?.user?._id || participant?.userId || participant?._id || null;
  };

  // 3️⃣ Fix lookup: search only by identity and log clearer mismatch info.
  const findLiveKitParticipantById = (participant: Participant) => {
    const identity = getUserIdFromParticipant(participant);
    if (!identity) return undefined;

    const lk = liveKitParticipants.get(identity);
    if (!lk) {
      console.warn('[LK-LOOKUP-MISS]', {
        displayName: participant.displayName,
        identityWanted: identity,
        liveKitKeys: Array.from(liveKitParticipants.keys()),
      });
    } else {
      console.log('[LK-MATCH]', participant.displayName, '→', identity);
    }
    return lk;
  };

  // CIRCUIT BREAKER: Early return AFTER all hooks are called
  if (hasInfiniteLoop) {
    // TEMPORARY: Stop after 50 renders to see debug output
    if (renderCountRef.current > 50) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#ff0000',
          color: 'white',
          textAlign: 'center'
        }}>
          <h2>⚠️ Infinite Loop Detected in LiveKitParticipantQueue</h2>
          <p>Rendered {renderCountRef.current} times</p>
          <p>Check console for details</p>
        </div>
      );
    }
  }

  // Render participant video with LiveKit integration
  const renderParticipantVideo = (participant: Participant, isMainStage: boolean = false) => {
    const isActiveSpeaker = activeSpeaker?._id === participant._id;
    const isScreenSharing = screenShareMode && screenShareParticipant?._id === participant._id;
    
    // Find corresponding LiveKit participant using improved lookup
    const liveKitParticipant = findLiveKitParticipantById(participant);
    const userId = getUserIdFromParticipant(participant);
    
    // C) Local/remote detection must be exact: ONLY local when identities match
    const isLocalParticipant =
      !!localParticipant?.identity && !!userId &&
      localParticipant.identity === userId;

    // F) Add a short sanity log (temporarily) to ensure Host vs Participant are distinct & correct:
    console.log('[RENDER-CHECK]', {
      name: participant.displayName,
      role: participant.role,
      identity: userId,
      lkIdentity: liveKitParticipant?.identity,
      localIdentity: localParticipant?.identity,
      isLocalParticipant,
      isMainStage
    });

    // 4️⃣ Guard to wait until participant is available with timeout
    const [waited, setWaited] = React.useState(false);
    React.useEffect(() => {
      const t = setTimeout(() => setWaited(true), 5000);
      return () => clearTimeout(t);
    }, []);
    
    if (!liveKitParticipant && !isLocalParticipant && !waited) {
      console.warn('[MAIN-STAGE-WAIT]', participant.displayName, 'waiting for track registration…');
      return (
        <div style={{
          display:'flex',alignItems:'center',justifyContent:'center',
          background:'#111',color:'#888',width:'100%',height:'100%'
        }}>
          Loading {participant.displayName} video…
        </div>
      );
    }
    
    if (!liveKitParticipant && waited) {
      return (
        <div style={{
          display:'flex',alignItems:'center',justifyContent:'center',
          background:'#111',color:'#f87171',width:'100%',height:'100%'
        }}>
          ⚠️ {participant.displayName} has no camera track.
        </div>
      );
    }
    
    return (
      <div
        key={participant._id}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: isScreenSharing ? '0' : (isMainStage ? '12px' : '8px'),
          overflow: 'hidden',
          cursor: onParticipantClick ? 'pointer' : 'default',
          border: isScreenSharing ? 'none' : (isActiveSpeaker ? '3px solid #3b82f6' : '2px solid #e5e7eb'),
          boxShadow: isScreenSharing ? 'none' : (isActiveSpeaker 
            ? '0 0 20px rgba(59, 130, 246, 0.5)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)'),
          transition: 'all 0.3s ease',
          backgroundColor: isScreenSharing ? '#000000' : '#1f2937',
          minWidth: isMainStage ? '200px' : '120px',
          minHeight: isMainStage ? '150px' : '80px'
        }}
        onClick={() => onParticipantClick?.(participant)}
      >
        {/* Video Element */}
        <video
          ref={el => {
            console.log('[VIDEO-REF] Registering video element', {
              displayName: participant.displayName,
              primaryKey: liveKitParticipant?.identity || participant._id,
              liveKitIdentity: liveKitParticipant?.identity,
              localIdentity: localParticipant?.identity,
              isLocalParticipant,
              isMainStage,
            });
            
            // D) Video ref registration must use identity only (no name/_id fallbacks)
            const primaryKey = userId || liveKitParticipant?.identity || participant._id;
            
            
            // Track which keys will be registered
            const keysToRegister: string[] = [primaryKey];
            
            // Get old element reference before overwriting
            const oldElement = videoRefs.current[primaryKey];
            const isUpdatingExisting = oldElement !== null && oldElement !== el;
            const isNewRegistration = el !== null && oldElement === null;
            const isUnregistering = el === null;
            const isSameElement = oldElement === el;
            
            // Skip logging if it's the same element (prevents spam)
            if (isSameElement && el !== null) {
              return; // Don't re-register the same element
            }
            
            // Skip rapid re-renders to prevent instability
            if (isRapidRerender && !isNewRegistration) {
              return;
            }
            
            videoRefs.current[primaryKey] = el;
            
            // IMMEDIATE FIX: If this is local participant and we have their video track, attach it NOW
            if (el && isLocalParticipant && liveKitService?.room?.localParticipant) {
              const roomLocalParticipant = liveKitService.room.localParticipant;
              const localVideoTrack: any = Array.from(roomLocalParticipant.videoTrackPublications.values())
                .find((pub: any) => pub.source === 'camera' && pub.track);
              
              if (localVideoTrack && localVideoTrack.track) {
                try {
                  localVideoTrack.track.attach(el);
                  // CRITICAL FIX: Update trackRefs.current for local participant
                  trackRefs.current[primaryKey] = localVideoTrack.track;
                } catch (attachError) {
                  errorLog(`Failed to attach local track in ref callback for ${participant.displayName}`, attachError);
                }
              }
            }
            
            // REMOVED: Multiple key registration that was causing race conditions
            // Only register with the primary key (participant._id) for consistency
            
          }}
          autoPlay
          muted={true} // Always mute to prevent feedback, local video is for visual only
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: isScreenSharing ? 'contain' : 'cover',
            backgroundColor: isScreenSharing ? '#000000' : '#1f2937',
            borderRadius: isScreenSharing ? '0' : (isMainStage ? '10px' : '6px'),
            minWidth: '100%',
            minHeight: '100%',
            // Performance optimizations for smooth video
            transform: 'translateZ(0)', // Hardware acceleration
            willChange: 'transform', // Optimize for animations
            backfaceVisibility: 'hidden', // Prevent flickering
            WebkitBackfaceVisibility: 'hidden', // Safari support
          }}
        />
        
        {/* Connection Status Indicator */}
        {liveKitParticipant && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '8px',
              height: '8px',
              backgroundColor: liveKitParticipant.connectionQuality > 0.7 ? '#10b981' : 
                              liveKitParticipant.connectionQuality > 0.3 ? '#f59e0b' : '#ef4444',
              borderRadius: '50%',
              border: '2px solid white'
            }}
            title={`Connection Quality: ${Math.round(liveKitParticipant.connectionQuality * 100)}%`}
          />
        )}
        
        {/* Speaking Indicator */}
        {isActiveSpeaker && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: liveKitParticipant ? '28px' : '8px',
              width: '12px',
              height: '12px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'pulse 1s infinite'
            }}
          />
        )}
        
        {/* Screen Share Indicator */}
        {isScreenSharing && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600'
            }}
          >
            📺 Screen
          </div>
        )}
        
        {/* Hand Raise Indicator */}
        {participant.hasHandRaised && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: isActiveSpeaker ? '48px' : '8px',
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              animation: 'bounce 1s infinite'
            }}
          >
            ✋ Raised
          </div>
        )}
        
        {/* Muted Indicator */}
        {(participant.isMuted || liveKitParticipant?.isMuted) && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 6px',
              borderRadius: '4px',
              fontSize: '10px'
            }}
          >
            🔇
          </div>
        )}
        
        {/* Camera Off Indicator */}
        {(participant.isCameraOff || !liveKitParticipant?.isCameraEnabled) && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 6px',
              borderRadius: '4px',
              fontSize: '10px'
            }}
          >
            📷
          </div>
        )}
        
        {/* Fallback Avatar - Show when camera is off or no video */}
        {(participant.isCameraOff || !liveKitParticipant?.isCameraEnabled) && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: isMainStage ? '80px' : '60px',
                height: isMainStage ? '80px' : '60px',
                backgroundColor: participant.role === 'HOST' ? '#3b82f6' : '#6b7280',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMainStage ? '32px' : '24px',
                fontWeight: 'bold',
                marginBottom: '8px'
              }}
            >
              {participant.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div
              style={{
                fontSize: isMainStage ? '14px' : '12px',
                fontWeight: '500',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              {participant.displayName}
            </div>
          </div>
        )}
        
        {/* Participant Name */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: (participant.isMuted || liveKitParticipant?.isMuted) ? '40px' : '8px',
            right: (participant.isCameraOff || !liveKitParticipant?.isCameraEnabled) ? '40px' : '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {participant.displayName}
          {participant.role === 'HOST' && ' 👑'}
        </div>
        
        {/* Host Controls */}
        {isHost && participant.role !== 'HOST' && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: isScreenSharing ? '80px' : '8px',
              display: 'flex',
              gap: '4px'
            }}
          >
            {participant.hasHandRaised && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onHandRaiseClick?.(participant);
                }}
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px'
                }}
                title="Lower hand"
              >
                ✋
              </button>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onKickParticipant?.(participant);
              }}
              style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#ef4444',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px'
              }}
              title="Remove participant"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      padding: '12px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* CSS Animation for loading indicator */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      {/* Main Stage */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: viewMode === 'speaker' ? '1fr' :
                               mainStageParticipants.length === 1 ? '1fr' :
                               mainStageParticipants.length === 2 ? '1fr 1fr' :
                               mainStageParticipants.length === 3 ? '1fr 1fr 1fr' :
                               mainStageParticipants.length === 4 ? '1fr 1fr 1fr 1fr' :
                               mainStageParticipants.length <= 6 ? '1fr 1fr 1fr' :
                               mainStageParticipants.length <= 9 ? '1fr 1fr 1fr' :
                               '1fr 1fr 1fr 1fr',
          gridTemplateRows: viewMode === 'speaker' ? '1fr' :
                           mainStageParticipants.length <= 4 ? '1fr' :
                           mainStageParticipants.length <= 6 ? '1fr 1fr' :
                           mainStageParticipants.length <= 9 ? '1fr 1fr 1fr' :
                           '1fr 1fr 1fr 1fr',
          gap: (viewMode === 'speaker' || screenShareMode) ? '0' : '12px',
          padding: (viewMode === 'speaker' || screenShareMode) ? '0' : '8px',
          backgroundColor: screenShareMode ? '#000000' : (viewMode === 'speaker' ? 'transparent' : '#f8fafc'),
          borderRadius: (viewMode === 'speaker' || screenShareMode) ? '0' : '12px',
          boxShadow: (viewMode === 'speaker' || screenShareMode) ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        {mainStageParticipants.map((participant, index) => (
          <div
            key={participant._id}
            style={{
              height: '100%',
              minHeight: viewMode === 'speaker' ? '300px' : '200px',
              margin: (viewMode === 'speaker' || screenShareMode) ? '0' : '4px',
              borderRadius: screenShareMode ? '0' : (viewMode === 'speaker' ? '12px' : '8px'),
              overflow: 'hidden',
              boxShadow: screenShareMode ? 'none' : (viewMode === 'speaker' ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.1)')
            }}
          >
            {renderParticipantVideo(participant, true)}
          </div>
        ))}
      </div>
      
      
      {/* Queue Order Indicator */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '500',
          zIndex: 10,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        👥 {participants.length} participants
        {activeSpeaker && (
          <span style={{ color: '#10b981', marginLeft: '8px' }}>
            • 🎤 {activeSpeaker.displayName}
          </span>
        )}
        {participants.filter(p => p.hasHandRaised).length > 0 && (
          <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
            • ✋ {participants.filter(p => p.hasHandRaised).length} raised
          </span>
        )}
        {isLiveKitConnected && (
          <span style={{ color: '#3b82f6', marginLeft: '8px' }}>
            • 🎥 LiveKit Connected
          </span>
        )}
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
          60% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
};

export default LiveKitParticipantQueue;
