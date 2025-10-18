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
  
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const trackRefs = useRef<{ [key: string]: any }>({});
  const selectedParticipantRef = useRef<Participant | null>(null);
  
  // Video switching detection logs
  const logVideoSwitch = (action: string, data: any) => {
    console.log(`[VIDEO-SWITCH] ${action}:`, data);
  };

  // Track selected participant changes for video switching detection
  useEffect(() => {
    if (selectedParticipant?._id !== selectedParticipantRef.current?._id) {
      const prevId = selectedParticipantRef.current?._id;
      const newId = selectedParticipant?._id;
      
      logVideoSwitch('PARTICIPANT_SWITCHED', {
        from: selectedParticipantRef.current?.displayName || 'None',
        to: selectedParticipant?.displayName || 'None',
        fromId: prevId,
        toId: newId,
        timestamp: Date.now()
      });
      
      selectedParticipantRef.current = selectedParticipant || null;
    }
  }, [selectedParticipant]);

  // Debug: Log participants array changes
  useEffect(() => {
    logVideoSwitch('PARTICIPANTS_ARRAY_CHANGED', {
      count: participants.length,
      participants: participants.map(p => ({
        name: p.displayName,
        _id: p._id,
        identity: p.identity,
        user_id: (p as any)?.user_id,
        userId: p.userId
      }))
    });
  }, [participants]);

  // Connect LiveKit video tracks to video elements
  useEffect(() => {
    if (!liveKitService?.room) return;

    const room = liveKitService.room;
    
    // Ensure local camera is published
    const ensureLocalCameraPublished = async () => {
      if (!room?.localParticipant) return;
      const alreadyPublished = Array.from(room.localParticipant.videoTrackPublications.values())
        .some((pub: any) => pub.source === 'camera' && pub.track);
      if (alreadyPublished) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const [track] = stream.getVideoTracks();
        if (track) {
          const { createLocalVideoTrack } = await import('livekit-client');
          const localTrack = await createLocalVideoTrack({ deviceId: track.getSettings().deviceId });
          await room.localParticipant.publishTrack(localTrack);
          logVideoSwitch('LOCAL_CAMERA_PUBLISHED', { identity: room.localParticipant.identity });
        }
      } catch (err: any) {
        logVideoSwitch('LOCAL_CAMERA_ERROR', { error: err.message });
      }
    };

    ensureLocalCameraPublished();
    
    

    // NOTE: Video elements ready notification removed - no longer needed
    // Camera is enabled during initial LiveKit connection

    // Handle track subscription for remote participants
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      const isScreenShare = track.source === SCREEN_SHARE_SOURCE || 
                           track.source === 'screen_share' ||
                           String(track.source).includes('screen');
      
      // Skip non-camera tracks
      if (track.kind !== Track.Kind.Video || isScreenShare) return;
      
      // Log the track subscription attempt
      logVideoSwitch('TRACK_SUBSCRIPTION_ATTEMPT', {
        liveKitIdentity: participant.identity,
        liveKitName: participant.name,
        participantsCount: participants.length,
        participantsAvailable: participants.length > 0
      });
      
      // Find matching participant using ONLY real ID
      const matchingParticipant = participants.find(p => {
        const realId = (p as any)?.user_id;
        const matches = realId === participant.identity;
        if (matches) {
          logVideoSwitch('PARTICIPANT_MATCH_FOUND', {
            participantName: p.displayName,
            realId: realId,
            liveKitIdentity: participant.identity
          });
        }
        return matches;
      });
      
      if (!matchingParticipant) {
        logVideoSwitch('TRACK_NO_MATCH', {
          liveKitIdentity: participant.identity,
          liveKitName: participant.name,
          availableParticipants: participants.map(p => ({
            id: p._id,
            name: p.displayName,
            realId: (p as any)?.user_id,
            identity: p.identity,
            userId: p.userId,
            user_id: (p as any)?.user_id
          })),
          searchCriteria: {
            lookingFor: participant.identity,
            participantCount: participants.length
          }
        });
        
        // FALLBACK: Try direct attachment
        const directVideoElement = videoRefs.current[participant.identity];
        if (directVideoElement) {
          try {
            track.attach(directVideoElement);
            trackRefs.current[participant.identity] = track;
            logVideoSwitch('TRACK_ATTACHED_FALLBACK', {
              identity: participant.identity,
              name: participant.name
            });
          } catch (error) {
            logVideoSwitch('TRACK_ATTACH_ERROR', {
              identity: participant.identity,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        return;
      }
      
      // Use ONLY real ID as primary key
      const primaryKey = (matchingParticipant as any)?.user_id;
      const videoElement = videoRefs.current[primaryKey];

      if (videoElement) {
        try {
          if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
            videoElement.style.width = '320px';
            videoElement.style.height = '240px';
          }
          
          track.attach(videoElement);
          trackRefs.current[primaryKey] = track;
          
          logVideoSwitch('TRACK_ATTACHED', {
            participant: matchingParticipant.displayName,
            key: primaryKey,
            videoElementExists: true
          });
        } catch (error) {
          logVideoSwitch('TRACK_ATTACH_ERROR', {
            participant: matchingParticipant.displayName,
            key: primaryKey,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        logVideoSwitch('VIDEO_ELEMENT_NOT_FOUND', {
          participant: matchingParticipant.displayName,
          key: primaryKey,
          registeredKeys: Object.keys(videoRefs.current)
        });
      }
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind !== Track.Kind.Video) return;
      
      const matchingParticipant = participants.find(p => {
        const realId = (p as any)?.user_id;
        return realId === participant.identity;
      });
      
      if (!matchingParticipant) return;
      
      const primaryKey = (matchingParticipant as any)?.user_id;
      
      track.detach();
      delete trackRefs.current[primaryKey];
      
      const videoElement = videoRefs.current[primaryKey];
      if (videoElement) {
        videoElement.srcObject = null;
      }
      
      logVideoSwitch('TRACK_DETACHED', {
        participant: matchingParticipant.displayName,
        key: primaryKey
      });
    };

    // Handle local participant tracks
    const handleLocalTrackPublished = (publication: any, participant: any) => {
      if (publication.kind !== Track.Kind.Video || !participant.isLocal) return;
      
      const videoElement = videoRefs.current[participant.identity];
      
      if (videoElement && publication.track) {
        try {
          if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
            videoElement.style.width = '320px';
            videoElement.style.height = '240px';
          }
          
          publication.track.attach(videoElement);
          trackRefs.current[participant.identity] = publication.track;
          
          logVideoSwitch('LOCAL_TRACK_PUBLISHED', {
            identity: participant.identity,
            name: participant.name
          });
        } catch (error) {
          logVideoSwitch('LOCAL_TRACK_ERROR', {
            identity: participant.identity,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        logVideoSwitch('LOCAL_VIDEO_ELEMENT_NOT_FOUND', {
          identity: participant.identity,
          hasTrack: !!publication.track,
          registeredKeys: Object.keys(videoRefs.current)
        });
      }
    };

    // Attach existing remote tracks
    if (room && room.participants) {
      const participantsArray = Array.from(room.participants.values());
      
      participantsArray.forEach((participant: any) => {
        if (!participant.trackPublications || participant.trackPublications.size === 0) return;
        
        const publications = Array.from(participant.trackPublications.values());
        publications.forEach((publication: any) => {
          const isScreenShare = publication.source === SCREEN_SHARE_SOURCE || 
                               publication.source === 'screen_share' ||
                               String(publication.source).includes('screen');
          
          if (!publication.track || publication.kind !== Track.Kind.Video || isScreenShare) return;
          
          const matchingParticipant = participants.find(p => {
            const realId = (p as any)?.user_id;
            return realId === participant.identity;
          });
          
          if (!matchingParticipant) return;
          
          const primaryKey = (matchingParticipant as any)?.user_id;
          const videoElement = videoRefs.current[primaryKey];
          
          if (videoElement) {
            try {
              if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
                videoElement.style.width = '320px';
                videoElement.style.height = '240px';
              }
              
              publication.track.attach(videoElement);
              trackRefs.current[primaryKey] = publication.track;
              
              logVideoSwitch('EXISTING_TRACK_ATTACHED', {
                participant: matchingParticipant.displayName,
                key: primaryKey
              });
            } catch (error) {
              logVideoSwitch('EXISTING_TRACK_ERROR', {
                participant: matchingParticipant.displayName,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        });
      });
    }

    // Attach local participant tracks
    if (room?.localParticipant?.trackPublications?.size > 0) {
      const publications = Array.from(room.localParticipant.trackPublications.values());
      
      publications.forEach((publication: any) => {
        const isScreenShare = publication.source === SCREEN_SHARE_SOURCE || 
                             publication.source === 'screen_share' ||
                             String(publication.source).includes('screen');
        
        if (!publication.track || publication.kind !== Track.Kind.Video || isScreenShare) return;
        
        const videoElement = videoRefs.current[room.localParticipant.identity];
        
        if (videoElement) {
          try {
            if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
              videoElement.style.width = '320px';
              videoElement.style.height = '240px';
            }
            
            publication.track.attach(videoElement);
            trackRefs.current[room.localParticipant.identity] = publication.track;
            
            logVideoSwitch('LOCAL_EXISTING_TRACK_ATTACHED', {
              identity: room.localParticipant.identity,
              name: room.localParticipant.name
            });
          } catch (error) {
            logVideoSwitch('LOCAL_EXISTING_TRACK_ERROR', {
              identity: room.localParticipant.identity,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      });
    }

    // Add event listeners
    if (room && typeof room.on === 'function') {
      room.on('trackSubscribed', handleTrackSubscribed);
      room.on('trackUnsubscribed', handleTrackUnsubscribed);
      room.on('localTrackPublished', handleLocalTrackPublished);
    }

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
    // ONLY use the real ID field - user_id
    return (participant as any)?.user_id || null;
  };

  const findLiveKitParticipantById = (participant: Participant) => {
    const identity = getUserIdFromParticipant(participant);
    if (!identity) return undefined;

    const lk = liveKitParticipants.get(identity);
    if (!lk) {
      logVideoSwitch('LIVEKIT_PARTICIPANT_NOT_FOUND', {
        displayName: participant.displayName,
        identityWanted: identity,
        availableLiveKitIdentities: Array.from(liveKitParticipants.keys())
      });
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
    
    // Local/remote detection
    const isLocalParticipant =
      !!localParticipant?.identity && !!userId &&
      localParticipant.identity === userId;

    // Wait for participant to be available with timeout
    const [waited, setWaited] = React.useState(false);
    React.useEffect(() => {
      const t = setTimeout(() => {
        setWaited(true);
        if (!liveKitParticipant && !isLocalParticipant) {
          logVideoSwitch('PARTICIPANT_TRACK_TIMEOUT', {
            participant: participant.displayName,
            userId,
            isMainStage,
            waitedMs: 5000
          });
        }
      }, 5000);
      return () => clearTimeout(t);
    }, []);
    
    if (!liveKitParticipant && !isLocalParticipant && !waited) {
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
      logVideoSwitch('NO_CAMERA_TRACK', {
        participant: participant.displayName,
        userId,
        isMainStage
      });
      
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
            // Use ONLY real ID as primary key - must be valid
            if (!userId) {
              logVideoSwitch('VIDEO_REF_NO_USER_ID', {
                participant: participant.displayName,
                displayName: participant.displayName
              });
              return;
            }
            
            const primaryKey = userId;
            
            // Get old element reference before overwriting
            const oldElement = videoRefs.current[primaryKey];
            const isSameElement = oldElement === el;
            
            // Skip if it's the same element (prevents spam)
            if (isSameElement && el !== null) {
              return;
            }
            
            // Skip rapid re-renders to prevent instability
            const isNewRegistration = el !== null && oldElement === null;
            if (isRapidRerender && !isNewRegistration) {
              return;
            }
            
            // Register video element
            videoRefs.current[primaryKey] = el;
            
            if (el) {
              logVideoSwitch('VIDEO_REF_REGISTERED', {
                participant: participant.displayName,
                key: primaryKey,
                isLocal: isLocalParticipant,
                isMainStage
              });
              
              // Immediate attach for local participant
              if (isLocalParticipant && liveKitService?.room?.localParticipant) {
                const roomLocalParticipant = liveKitService.room.localParticipant;
                const localVideoTrack: any = Array.from(roomLocalParticipant.videoTrackPublications.values())
                  .find((pub: any) => pub.source === 'camera' && pub.track);
                
                if (localVideoTrack?.track) {
                  try {
                    localVideoTrack.track.attach(el);
                    trackRefs.current[primaryKey] = localVideoTrack.track;
                    logVideoSwitch('LOCAL_TRACK_IMMEDIATE_ATTACH', {
                      participant: participant.displayName,
                      key: primaryKey
                    });
                  } catch (error) {
                    logVideoSwitch('LOCAL_TRACK_IMMEDIATE_ATTACH_ERROR', {
                      participant: participant.displayName,
                      error: error instanceof Error ? error.message : 'Unknown error'
                    });
                  }
                }
              }
            } else {
              logVideoSwitch('VIDEO_REF_UNREGISTERED', {
                participant: participant.displayName,
                key: primaryKey
              });
            }
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
