import React, { useEffect, useRef } from 'react';
import { Participant } from '../hooks/useParticipantQueue';
import { LiveKitParticipant } from '../lib/livekit-service';
import { Track } from 'livekit-client';

interface LiveKitParticipantQueueProps {
  // Original props
  participants: Participant[];
  activeSpeaker: Participant | null;
  screenShareMode: boolean;
  screenShareParticipant: Participant | null;
  selectedParticipant?: Participant | null;
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
  // Filter out invalid participants to prevent undefined entries
  const validLiveKitParticipants = Array.from(liveKitParticipants.entries())
    .filter(([id, p]) => id && p && p.name)
    .map(([id, p]) => ({ id, name: p.name }));
  
  console.log('🔍 LiveKitParticipantQueue Props:', {
    participantsCount: participants.length,
    participants: participants.map(p => ({ id: p._id, name: p.displayName })),
    liveKitParticipantsCount: liveKitParticipants.size,
    liveKitParticipants: validLiveKitParticipants,
    localParticipant: localParticipant ? { id: localParticipant.identity, name: localParticipant.name } : null,
    isLiveKitConnected
  });
  
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const trackRefs = useRef<{ [key: string]: any }>({});

  // Connect LiveKit video tracks to video elements
  useEffect(() => {
    if (!liveKitService?.room) return;

    const room = liveKitService.room;
    
    console.log('🔍 LiveKit Room Connection Debug:', {
      hasRoom: !!room,
      roomType: typeof room,
      roomState: room.state,
      roomName: room.name,
      localParticipant: room.localParticipant ? {
        identity: room.localParticipant.identity,
        name: room.localParticipant.name,
        isCameraEnabled: room.localParticipant.isCameraEnabled,
        isMicrophoneEnabled: room.localParticipant.isMicrophoneEnabled
      } : 'no local participant',
      participantsCount: room.participants ? room.participants.size : 'no participants array',
      videoElementKeys: Object.keys(videoRefs.current)
    });

    // NOTE: Video elements ready notification removed - no longer needed
    // Camera is enabled during initial LiveKit connection

    // Handle track subscription for remote participants
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      console.log('🎥 Track subscribed:', { 
        participant: participant.identity, 
        trackKind: track.kind,
        trackSource: track.source,
        participantName: participant.name,
        isLocal: participant.isLocal
      });

      // CRITICAL FIX: participant.identity is the user._id (set in backend token)
      // This should match our video element registration which uses userId
      console.log('🔍 LiveKit participant object:', {
        identity: participant.identity,
        name: participant.name,
        hasId: '_id' in participant,
        participantId: participant._id,
        allKeys: Object.keys(participant)
      });
      
      // PRIMARY: Look up by participant.identity (which is user._id)
      let videoElement = videoRefs.current[participant.identity];
      
      // FALLBACK 1: Try to find by matching user._id in our participants list
      if (!videoElement) {
        const matchingParticipant = participants.find(p => 
          (p.user?._id === participant.identity) || 
          (p.userId === participant.identity) ||
          (p._id === participant.identity)
        );
        if (matchingParticipant) {
          const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
          videoElement = videoRefs.current[userId];
          console.log('🔍 Found video element via participant match:', {
            matchingParticipantId: matchingParticipant._id,
            userId: userId
          });
        }
      }
      
      // FALLBACK 2: Try other keys
      if (!videoElement) {
        videoElement = videoRefs.current[participant.name] || 
                      videoRefs.current[participant._id];
      }
      
      console.log('🔍 Video element lookup:', {
        participantIdentity: participant.identity,
        participantName: participant.name,
        hasVideoElement: !!videoElement,
        videoElementKeys: Object.keys(videoRefs.current),
        isVideoTrack: track.kind === Track.Kind.Video,
        lookupAttempts: {
          byIdentity: !!videoRefs.current[participant.identity],
          byId: !!videoRefs.current[participant._id],
          byName: !!videoRefs.current[participant.name]
        }
      });

      if (videoElement && track.kind === Track.Kind.Video) {
        try {
          // Ensure video element has valid dimensions to prevent WebRTC encoding issues
          if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
            console.log('⚠️ Video element has no dimensions, setting default size');
            videoElement.style.width = '320px';
            videoElement.style.height = '240px';
          }
          
          track.attach(videoElement);
          trackRefs.current[participant.identity] = track;
          console.log('✅ Video track attached to element for participant:', participant.identity);
        } catch (error) {
          console.error('❌ Error attaching video track:', error);
        }
      } else {
        console.log('⚠️ Cannot attach track:', {
          hasVideoElement: !!videoElement,
          isVideoTrack: track.kind === Track.Kind.Video,
          trackKind: track.kind
        });
      }
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      console.log('🎥 Track unsubscribed:', { 
        participant: participant.identity, 
        trackKind: track.kind 
      });

      if (track.kind === Track.Kind.Video) {
        track.detach();
        delete trackRefs.current[participant.identity];
        
        const videoElement = videoRefs.current[participant.identity];
        if (videoElement) {
          videoElement.srcObject = null;
        }
      }
    };

    // Handle local participant tracks
    const handleLocalTrackPublished = (publication: any, participant: any) => {
      console.log('🎥 Local track published:', { 
        participant: participant.identity, 
        trackKind: publication.kind,
        participantName: participant.name,
        isLocal: participant.isLocal
      });

      if (publication.kind === Track.Kind.Video && participant.isLocal) {
        // CRITICAL FIX: Use participant.identity (user._id) as primary lookup key
        let videoElement = videoRefs.current[participant.identity];
        
        // FALLBACK: Try to find by matching user._id in our participants list
        if (!videoElement) {
          const matchingParticipant = participants.find(p => 
            (p.user?._id === participant.identity) || 
            (p.userId === participant.identity) ||
            (p._id === participant.identity)
          );
          if (matchingParticipant) {
            const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
            videoElement = videoRefs.current[userId];
            console.log('🔍 Found local video element via participant match:', {
              matchingParticipantId: matchingParticipant._id,
              userId: userId
            });
          }
        }
        
        // FALLBACK 2: Try other keys
        if (!videoElement) {
          videoElement = videoRefs.current[participant.name] || 
                        videoRefs.current[participant._id];
        }
        
        console.log('🔍 Local video element lookup:', {
          participantIdentity: participant.identity,
          participantName: participant.name,
          hasVideoElement: !!videoElement,
          videoElementKeys: Object.keys(videoRefs.current),
          lookupAttempts: {
            byIdentity: !!videoRefs.current[participant.identity],
            byId: !!videoRefs.current[participant._id],
            byName: !!videoRefs.current[participant.name]
          }
        });
        
        if (videoElement && publication.track) {
          try {
            // Ensure video element has valid dimensions to prevent WebRTC encoding issues
            if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
              console.log('⚠️ Local video element has no dimensions, setting default size');
              videoElement.style.width = '320px';
              videoElement.style.height = '240px';
            }
            
            publication.track.attach(videoElement);
            trackRefs.current[participant.identity] = publication.track;
            console.log('✅ Local video track attached to element');
          } catch (error) {
            console.error('❌ Error attaching local video track:', error);
          }
        } else {
          console.log('⚠️ Cannot attach local track:', {
            hasVideoElement: !!videoElement,
            hasTrack: !!publication.track,
            isVideo: publication.kind === Track.Kind.Video,
            isLocal: participant.isLocal
          });
        }
      }
    };

    // Attach existing tracks
    console.log('🔍 LiveKit Room Debug:', {
      hasRoom: !!room,
      roomType: typeof room,
      roomKeys: room ? Object.keys(room) : 'no room',
      hasParticipants: room && 'participants' in room,
      participantsType: room && 'participants' in room ? typeof room.participants : 'no participants',
      participantsValue: room && 'participants' in room ? room.participants : 'no participants'
    });

    if (room && room.participants && Array.isArray(room.participants)) {
      console.log('🔍 Processing participants:', room.participants.length);
      room.participants.forEach((participant: any) => {
        console.log('🔍 Processing participant:', {
          identity: participant.identity,
          hasTrackPublications: !!participant.trackPublications,
          trackPublicationsType: typeof participant.trackPublications
        });
        
        if (participant.trackPublications && Array.isArray(participant.trackPublications)) {
          participant.trackPublications.forEach((publication: any) => {
            if (publication.track && publication.kind === Track.Kind.Video) {
              // CRITICAL FIX: Use participant.identity (user._id) as primary lookup key
              let videoElement = videoRefs.current[participant.identity];
              
              // FALLBACK: Try to find by matching user._id in our participants list
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
              
              // FALLBACK 2: Try other keys
              if (!videoElement) {
                videoElement = videoRefs.current[participant.name] || 
                              videoRefs.current[participant._id];
              }
              
              if (videoElement) {
                try {
                  // Ensure video element has valid dimensions to prevent WebRTC encoding issues
                  if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
                    console.log('⚠️ Existing remote video element has no dimensions, setting default size');
                    videoElement.style.width = '320px';
                    videoElement.style.height = '240px';
                  }
                  
                  publication.track.attach(videoElement);
                  trackRefs.current[participant.identity] = publication.track;
                  console.log('✅ Existing video track attached for participant:', participant.identity);
                } catch (error) {
                  console.error('❌ Error attaching existing remote video track:', error);
                }
              }
            }
          });
        }
      });
    } else {
      console.log('⚠️ No participants found or participants is not an array');
    }

    // Attach local participant tracks
    if (room && room.localParticipant) {
      console.log('🔍 Local participant debug:', {
        hasLocalParticipant: !!room.localParticipant,
        localParticipantIdentity: room.localParticipant.identity,
        hasTrackPublications: !!room.localParticipant.trackPublications,
        trackPublicationsType: typeof room.localParticipant.trackPublications
      });
      
      if (room.localParticipant.trackPublications && Array.isArray(room.localParticipant.trackPublications)) {
        room.localParticipant.trackPublications.forEach((publication: any) => {
          if (publication.track && publication.kind === Track.Kind.Video) {
            // CRITICAL FIX: Use localParticipant.identity (user._id) as primary lookup key
            let videoElement = videoRefs.current[room.localParticipant.identity];
            
            // FALLBACK: Try to find by matching user._id in our participants list
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
            
            // FALLBACK 2: Try other keys
            if (!videoElement) {
              videoElement = videoRefs.current[room.localParticipant.name] || 
                            videoRefs.current[room.localParticipant._id];
            }
            
            if (videoElement) {
              try {
                // Ensure video element has valid dimensions to prevent WebRTC encoding issues
                if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
                  console.log('⚠️ Existing local video element has no dimensions, setting default size');
                  videoElement.style.width = '320px';
                  videoElement.style.height = '240px';
                }
                
                publication.track.attach(videoElement);
                trackRefs.current[room.localParticipant.identity] = publication.track;
                console.log('✅ Local participant video track attached');
              } catch (error) {
                console.error('❌ Error attaching existing local video track:', error);
              }
            }
          }
        });
      }
    } else {
      console.log('⚠️ No local participant found');
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
      Object.values(trackRefs.current).forEach((track: any) => {
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
      // In screen share mode, show all other participants as thumbnails
      return participants.filter(p => p._id !== screenShareParticipant?._id);
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
  
  console.log('🔍 LiveKitParticipantQueue Render Data:', {
    mainStageCount: mainStageParticipants.length,
    mainStageParticipants: mainStageParticipants.map(p => ({ id: p._id, name: p.displayName })),
    thumbnailCount: thumbnailParticipants.length,
    thumbnailParticipants: thumbnailParticipants.map(p => ({ id: p._id, name: p.displayName })),
    totalParticipants: participants.length
  });

  // Helper function to get user ID from participant (used as LiveKit identity)
  const getUserIdFromParticipant = (participant: Participant): string | null => {
    // LiveKit identity is set to user._id in backend token generation
    // Priority: 1) user._id, 2) userId, 3) _id as fallback
    return participant.user?._id || participant.userId || participant._id;
  };

  // Helper function to find LiveKit participant by backend participant
  const findLiveKitParticipantById = (participant: Participant) => {
    // Get the user ID which is used as LiveKit identity
    const userId = getUserIdFromParticipant(participant);
    
    console.log('🔍 findLiveKitParticipantById called:', {
      participantId: participant._id,
      participantName: participant.displayName,
      userId,
      liveKitParticipantsSize: liveKitParticipants.size,
      liveKitParticipantsKeys: Array.from(liveKitParticipants.keys())
    });
    
    // CRITICAL FIX: Use user ID (LiveKit identity) for lookup
    let liveKitParticipant = userId ? liveKitParticipants.get(userId) : undefined;
    
    // If not found by user ID, try participant._id as fallback
    if (!liveKitParticipant) {
      console.log('⚠️ Not found by userId, trying participant._id:', participant._id);
      liveKitParticipant = liveKitParticipants.get(participant._id);
    }
    
    // If still not found, search by identity or name across all participants
    if (!liveKitParticipant) {
      console.log('⚠️ Not found by direct lookup, searching all participants...');
      for (const [key, lkParticipant] of liveKitParticipants.entries()) {
        if (lkParticipant?.identity === userId || 
            lkParticipant?.identity === participant._id ||
            lkParticipant?.name === participant.displayName) {
          liveKitParticipant = lkParticipant;
          console.log('✅ Found LiveKit participant by search:', {
            key,
            identity: lkParticipant.identity,
            name: lkParticipant.name
          });
          break;
        }
      }
    }
    
    console.log('🔍 findLiveKitParticipantById result:', {
      participantId: participant._id,
      userId,
      found: !!liveKitParticipant,
      liveKitParticipantIdentity: liveKitParticipant?.identity,
      liveKitParticipantName: liveKitParticipant?.name
    });
    
    return liveKitParticipant;
  };

  // Render participant video with LiveKit integration
  const renderParticipantVideo = (participant: Participant, isMainStage: boolean = false) => {
    const isActiveSpeaker = activeSpeaker?._id === participant._id;
    const isScreenSharing = screenShareMode && screenShareParticipant?._id === participant._id;
    
    // Find corresponding LiveKit participant using improved lookup
    const liveKitParticipant = findLiveKitParticipantById(participant);
    const userId = getUserIdFromParticipant(participant);
    const isLocalParticipant = localParticipant?.identity === userId;
    
    console.log('🎬 renderParticipantVideo called:', {
      participantId: participant._id,
      participantName: participant.displayName,
      isMainStage,
      hasLiveKitParticipant: !!liveKitParticipant,
      liveKitParticipantIdentity: liveKitParticipant?.identity,
      isLocalParticipant
    });
    
    return (
      <div
        key={participant._id}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: isMainStage ? '12px' : '8px',
          overflow: 'hidden',
          cursor: onParticipantClick ? 'pointer' : 'default',
          border: isActiveSpeaker ? '3px solid #3b82f6' : '2px solid #e5e7eb',
          boxShadow: isActiveSpeaker 
            ? '0 0 20px rgba(59, 130, 246, 0.5)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
          backgroundColor: '#1f2937',
          minWidth: isMainStage ? '200px' : '120px',
          minHeight: isMainStage ? '150px' : '80px'
        }}
        onClick={() => onParticipantClick?.(participant)}
      >
        {/* Video Element */}
        <video
          ref={el => {
            // CRITICAL FIX: Use user ID (LiveKit identity) as primary key
            // This ensures video elements are registered with the same key LiveKit uses
            const primaryKey = userId || participant._id; // User ID is the LiveKit identity, fallback to _id
            videoRefs.current[primaryKey] = el;
            
            console.log('🎬 Video element created:', {
              participantId: participant._id,
              participantDisplayName: participant.displayName,
              userId: userId,
              liveKitIdentity: liveKitParticipant?.identity,
              primaryKey: primaryKey,
              hasElement: !!el,
              currentKeys: Object.keys(videoRefs.current)
            });
            
            // Create backup keys for different lookup scenarios
            // This ensures compatibility with track subscription handlers
            if (liveKitParticipant?.identity && liveKitParticipant.identity !== primaryKey) {
              videoRefs.current[liveKitParticipant.identity] = el;
            }
            if (participant._id && participant._id !== primaryKey) {
              videoRefs.current[participant._id] = el;
            }
            if (participant.displayName && participant.displayName !== primaryKey) {
              videoRefs.current[participant.displayName] = el;
            }
          }}
          autoPlay
          muted={!isLocalParticipant} // Mute remote participants, unmute local
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#1f2937',
            borderRadius: isMainStage ? '10px' : '6px',
            minWidth: '100%',
            minHeight: '100%'
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
          gap: viewMode === 'speaker' ? '0' : '12px',
          padding: viewMode === 'speaker' ? '0' : '8px',
          backgroundColor: viewMode === 'speaker' ? 'transparent' : '#f8fafc',
          borderRadius: viewMode === 'speaker' ? '0' : '12px',
          boxShadow: viewMode === 'speaker' ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        {mainStageParticipants.map((participant, index) => (
          <div
            key={participant._id}
            style={{
              height: '100%',
              minHeight: viewMode === 'speaker' ? '300px' : '200px',
              margin: viewMode === 'speaker' ? '0' : '4px',
              borderRadius: viewMode === 'speaker' ? '12px' : '8px',
              overflow: 'hidden',
              boxShadow: viewMode === 'speaker' ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.1)'
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
