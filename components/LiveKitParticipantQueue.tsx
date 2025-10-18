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
  
  // DEBUG: Track video element registrations and track operations
  const debugLog = (category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const colors: any = {
      'REF_REGISTER': '#9333ea',    // Purple - video element registration
      'TRACK_ATTACH': '#10b981',     // Green - track attachment
      'TRACK_DETACH': '#ef4444',     // Red - track detachment
      'ELEMENT_LOOKUP': '#3b82f6',   // Blue - element lookup
      'CLEANUP': '#f59e0b',          // Orange - cleanup
      'ERROR': '#dc2626',            // Dark red - errors
      'WARNING': '#eab308'           // Yellow - warnings
    };
    console.log(
      `%c[${timestamp}] [${category}]%c ${message}`,
      `color: ${colors[category] || '#6b7280'}; font-weight: bold`,
      'color: inherit',
      data || ''
    );
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
    
    debugLog('TRACK_ATTACH', '🎬 useEffect running - Setting up LiveKit track handlers', {
      roomExists: !!room,
      participantsCount: participants.length,
      liveKitParticipantsCount: liveKitParticipants.size,
      currentVideoRefs: Object.keys(videoRefs.current).length,
      currentTrackRefs: Object.keys(trackRefs.current).length
    });
    

    // NOTE: Video elements ready notification removed - no longer needed
    // Camera is enabled during initial LiveKit connection

    // Handle track subscription for remote participants
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      debugLog('TRACK_ATTACH', `🎬 Track subscription event fired for ${participant.name}`, {
        participantIdentity: participant.identity,
        participantName: participant.name,
        trackKind: track.kind,
        trackSource: track.source,
        // CRITICAL: Show what we're looking for
        lookingFor: {
          liveKitIdentity: participant.identity,
          liveKitName: participant.name
        },
        // CRITICAL: Show what participants we have
        availableParticipants: participants.map(p => ({
          _id: p._id,
          displayName: p.displayName,
          userId: p.user?._id || p.userId,
          // Show if this participant's IDs match what we're looking for
          matchesLiveKitIdentity: (p.user?._id || p.userId || p._id) === participant.identity,
          matchesLiveKitName: p.displayName === participant.name
        })),
        // CRITICAL: Show current video refs and track refs
        currentVideoRefs: Object.keys(videoRefs.current).filter(key => videoRefs.current[key] !== null),
        currentTrackRefs: Object.keys(trackRefs.current)
      });
      
      // CRITICAL FIX: Find the matching participant from our participants list first
      // This ensures we use the same participant object that was used for registration
      const matchingParticipant = participants.find(p => {
        // Try multiple matching strategies
        const userId = p.user?._id || p.userId || p._id;
        const displayName = p.displayName || '';
        const liveKitName = participant.name || '';
        
        // PRIMARY: Exact ID matches (most reliable)
        if (userId === participant.identity || p._id === participant.identity || p.userId === participant.identity) {
          debugLog('ELEMENT_LOOKUP', `✅ Found by ID match: ${displayName}`, {
            matchType: 'ID_MATCH',
            liveKitIdentity: participant.identity,
            participantId: p._id,
            userId: userId
          });
          return true;
        }
        
        // SECONDARY: Exact name match (only if IDs don't match)
        if (displayName === liveKitName && displayName !== '' && liveKitName !== '') {
          debugLog('ELEMENT_LOOKUP', `✅ Found by exact name match: ${displayName}`, {
            matchType: 'EXACT_NAME_MATCH',
            liveKitName: liveKitName,
            displayName: displayName
          });
          return true;
        }
        
        // REMOVED: Fuzzy matching that was causing wrong matches
        // This was the problem - "Admin" was matching "Adminnn"
        
        return false;
      });
      
      if (!matchingParticipant) {
        debugLog('ERROR', `❌ No matching participant found in participants list`, {
          liveKitParticipant: {
            identity: participant.identity,
            name: participant.name,
            _id: participant._id
          },
          availableParticipants: participants.map(p => {
            const userId = p.user?._id || p.userId;
            return {
              _id: p._id,
              displayName: p.displayName,
              userId: userId,
              matchingAttempts: {
                userIdMatch: userId === participant.identity,
                idMatch: p._id === participant.identity,
                nameMatch: p.displayName === participant.name
              }
            };
          }),
          suggestion: 'Check if participant.identity matches any participant._id or userId'
        });
        
        // FALLBACK: Try to find by LiveKit identity directly in videoRefs
        debugLog('ELEMENT_LOOKUP', `🔄 FALLBACK: Looking for video element by LiveKit identity directly`, {
          liveKitIdentity: participant.identity,
          availableVideoRefKeys: Object.keys(videoRefs.current),
          // CRITICAL: Show all video elements and their keys
          videoElementsDetails: Object.entries(videoRefs.current)
            .filter(([_, el]) => el !== null)
            .map(([key, el]) => ({
              key,
              hasElement: !!el,
              elementType: el?.tagName,
              // Check if this element is registered under the LiveKit identity we're looking for
              isTargetElement: key === participant.identity
            }))
        });
        
        // Try to attach track directly using LiveKit identity
        const directVideoElement = videoRefs.current[participant.identity];
        const isScreenShare = track.source === SCREEN_SHARE_SOURCE || 
                             track.source === 'screen_share' ||
                             String(track.source).includes('screen');
        
        if (directVideoElement) {
          debugLog('ELEMENT_LOOKUP', `✅ FALLBACK SUCCESS: Found video element by LiveKit identity`, {
            liveKitIdentity: participant.identity,
            elementFound: true
          });
          
          // Attach track directly
          if (track.kind === Track.Kind.Video && !isScreenShare) {
            try {
              track.attach(directVideoElement);
              trackRefs.current[participant.identity] = track;
              debugLog('TRACK_ATTACH', `✅ Track attached via FALLBACK method`, {
                participant: participant.name,
                liveKitIdentity: participant.identity
              });
            } catch (error) {
              debugLog('ERROR', `❌ Error attaching track via FALLBACK`, {
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
        } else {
          debugLog('ERROR', `❌ FALLBACK FAILED: No video element found for LiveKit identity`, {
            liveKitIdentity: participant.identity,
            availableKeys: Object.keys(videoRefs.current)
          });
        }
        
        return;
      }
      
      // Use the matching participant's data for consistent key lookup
          const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
      const displayName = matchingParticipant.displayName;
      
      debugLog('ELEMENT_LOOKUP', `✅ Found matching participant: ${displayName}`, {
        liveKitIdentity: participant.identity,
        liveKitName: participant.name,
        matchedParticipant: {
          _id: matchingParticipant._id,
          displayName: matchingParticipant.displayName,
          userId: userId
        },
        // CRITICAL: Show the ID mismatch
        idMismatch: {
          liveKitIdentity: participant.identity,
          matchedUserId: userId,
          isSameUser: participant.identity === userId,
          warning: participant.identity !== userId ? '🚨 DIFFERENT USERS - Track for wrong participant!' : '✅ Same user'
        }
      });
      
      // REMOVED: Blocking logic that was preventing track attachment
      // The primary key fix above ensures correct video element lookup
      
      // PRIMARY: Look up by participant._id (consistent with registration)
      let videoElement = videoRefs.current[matchingParticipant._id];
      let lookupKey = matchingParticipant._id;
      let lookupMethod = 'PRIMARY_PARTICIPANT_ID';
      
      // CRITICAL: Log the lookup attempt
      debugLog('ELEMENT_LOOKUP', `🔍 Looking up video element for ${participant.name}`, {
        liveKitParticipant: {
          identity: participant.identity,
          name: participant.name
        },
        matchingParticipant: {
          _id: matchingParticipant._id,
          displayName: matchingParticipant.displayName
        },
        lookupKey: lookupKey,
        found: !!videoElement
      });
      
      debugLog('ELEMENT_LOOKUP', `Attempt 1: Looking up by participant._id="${matchingParticipant._id}"`, {
        found: !!videoElement,
        allKeys: Object.keys(videoRefs.current)
      });
      
      // FALLBACK 1: Try LiveKit identity directly if participant._id not found
      if (!videoElement) {
        videoElement = videoRefs.current[participant.identity];
        if (videoElement) {
          lookupKey = participant.identity;
          lookupMethod = 'FALLBACK_1_LIVEKIT_IDENTITY';
          debugLog('ELEMENT_LOOKUP', `Attempt 2: Found via LiveKit identity="${participant.identity}"`, {});
        }
      }
      
      // FALLBACK 2: Try userId if still not found
      if (!videoElement && matchingParticipant) {
        const fallbackUserId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
        videoElement = videoRefs.current[fallbackUserId];
        if (videoElement) {
          lookupKey = fallbackUserId;
          lookupMethod = 'FALLBACK_2_USER_ID';
          debugLog('ELEMENT_LOOKUP', `Attempt 3: Found via userId="${fallbackUserId}"`, {});
        }
      }
      
      // FALLBACK 3: Try display name
      if (!videoElement) {
        videoElement = videoRefs.current[displayName];
        if (videoElement) {
          lookupKey = displayName;
          lookupMethod = 'FALLBACK_3_DISPLAY_NAME';
          debugLog('ELEMENT_LOOKUP', `Attempt 4: Found via displayName="${displayName}"`, {});
        }
      }
      
      // FALLBACK 4: Try participant._id
      if (!videoElement) {
        videoElement = videoRefs.current[matchingParticipant._id];
        if (videoElement) {
          lookupKey = matchingParticipant._id;
          lookupMethod = 'FALLBACK_4_PARTICIPANT_ID';
          debugLog('ELEMENT_LOOKUP', `Attempt 5: Found via participant._id="${matchingParticipant._id}"`, {});
        }
      }

      // Only attach CAMERA tracks (skip screen share)
      const isScreenShare = track.source === SCREEN_SHARE_SOURCE || 
                           track.source === 'screen_share' ||
                           String(track.source).includes('screen');
      
      if (videoElement && track.kind === Track.Kind.Video && !isScreenShare) {
        // Check if this element already has a track attached
        const existingTrack = trackRefs.current[userId];
        const hasExistingSrcObject = videoElement.srcObject !== null;
        
        if (existingTrack || hasExistingSrcObject) {
          debugLog('WARNING', `⚠️ Video element already has track attached!`, {
            participant: displayName,
            lookupKey,
            lookupMethod,
            existingTrackRef: !!existingTrack,
            existingSrcObject: hasExistingSrcObject,
            videoElement: videoElement.id || 'no-id'
          });
        }
        
        try {
          // Ensure video element has valid dimensions to prevent WebRTC encoding issues
          if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
            videoElement.style.width = '320px';
            videoElement.style.height = '240px';
          }
          
          track.attach(videoElement);
          trackRefs.current[matchingParticipant._id] = track; // Use participant._id as the key
          
          // CRITICAL: Log successful track attachment
          debugLog('TRACK_ATTACH', `✅ SUCCESS: Track attached to video element`, {
            participant: displayName,
            participantId: matchingParticipant._id,
            trackRefsCount: Object.keys(trackRefs.current).length,
            videoElementFound: !!videoElement
          });
          
          debugLog('TRACK_ATTACH', `✅ Track successfully attached to video element`, {
            participant: displayName,
            lookupKey,
            lookupMethod,
            trackRefStoredAs: userId,
            elementDimensions: `${videoElement.offsetWidth}x${videoElement.offsetHeight}`
          });
        } catch (error) {
          debugLog('ERROR', `❌ Error attaching track`, {
            participant: displayName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else if (!videoElement) {
        debugLog('ERROR', `❌ No video element found for participant ${displayName}`, {
          liveKitParticipant: {
            identity: participant.identity,
            name: participant.name,
            _id: participant._id
          },
          matchedParticipant: {
            _id: matchingParticipant._id,
            displayName: matchingParticipant.displayName,
            userId: userId
          },
          lookupAttempts: {
            userId: userId,
            identity: participant.identity,
            displayName: displayName,
            participantId: matchingParticipant._id
          },
          availableKeys: Object.keys(videoRefs.current),
          registeredKeys: Object.keys(videoRefs.current).map(key => ({
            key,
            hasElement: !!videoRefs.current[key],
            elementType: videoRefs.current[key]?.tagName
          }))
        });
      }
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      debugLog('TRACK_DETACH', `🎬 Track unsubscription event fired for ${participant.name}`, {
        participantIdentity: participant.identity,
        participantName: participant.name,
        trackKind: track.kind
      });
      
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
          debugLog('WARNING', `⚠️ No matching participant found for cleanup`, {
            liveKitParticipant: {
              identity: participant.identity,
              name: participant.name
            }
          });
          return;
        }
        
        const userId = matchingParticipant.user?._id || matchingParticipant.userId || matchingParticipant._id;
        const displayName = matchingParticipant.displayName;
        
        // Check what keys exist before cleanup
        const keysBeforeCleanup = Object.keys(videoRefs.current).filter(key => 
          videoRefs.current[key] !== null
        );
        
        debugLog('CLEANUP', `🧹 Starting cleanup for ${displayName}`, {
          participantIdentity: participant.identity,
          userId: userId,
          allVideoRefKeys: keysBeforeCleanup,
          trackRefExists: !!trackRefs.current[matchingParticipant._id]
        });
        
        track.detach();
        const hadTrackRef = !!trackRefs.current[matchingParticipant._id];
        delete trackRefs.current[matchingParticipant._id];
        
        // Try to find video element using participant._id first (consistent with registration)
        let videoElement = videoRefs.current[matchingParticipant._id] || 
                          videoRefs.current[participant.identity] || 
                          videoRefs.current[userId] || 
                          videoRefs.current[displayName];
        
        if (videoElement) {
          const hadSrcObject = videoElement.srcObject !== null;
          videoElement.srcObject = null;
          
          debugLog('CLEANUP', `✅ Cleaned up video element found via userId="${userId}"`, {
            hadTrackRef,
            hadSrcObject,
            clearedSrcObject: true
          });
        } else {
          debugLog('WARNING', `⚠️ No video element found during cleanup`, {
            identity: participant.identity,
            name: participant.name,
            userId: userId,
            hadTrackRef
          });
        }
        
        // Check if there are dangling references with other keys
        const danglingKeys = keysBeforeCleanup.filter(key => {
          if (key === userId || key === participant.identity || key === displayName || key === matchingParticipant._id) {
            return false; // Already handled
          }
          const element = videoRefs.current[key];
          // Check if this element is the same as the one we just cleaned (by comparing references)
          return element === videoElement && element !== null;
        });
        
        if (danglingKeys.length > 0) {
          debugLog('WARNING', `⚠️ DANGLING REFERENCES DETECTED! Same video element registered under ${danglingKeys.length} other keys`, {
            participant: displayName,
            primaryKey: userId,
            danglingKeys,
            totalKeysForThisElement: danglingKeys.length + 1
          });
        }
      }
    };

    // Handle local participant tracks
    const handleLocalTrackPublished = (publication: any, participant: any) => {

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
          }
        }
        
        // FALLBACK 2: Try other keys
        if (!videoElement) {
          videoElement = videoRefs.current[participant.name] || 
                        videoRefs.current[participant._id];
        }
        
        
        if (videoElement && publication.track) {
          try {
            // Ensure video element has valid dimensions to prevent WebRTC encoding issues
            if (videoElement.offsetWidth === 0 || videoElement.offsetHeight === 0) {
              videoElement.style.width = '320px';
              videoElement.style.height = '240px';
            }
            
            publication.track.attach(videoElement);
            trackRefs.current[participant.identity] = publication.track;
          } catch (error) {
          }
        } else {
        }
      }
    };

    // Attach existing tracks

    // CRITICAL FIX: room.participants is a Map in LiveKit, not an array!
    if (room && room.participants) {
      const participantsArray = Array.from(room.participants.values());
      
      participantsArray.forEach((participant: any) => {
        
        // CRITICAL FIX: trackPublications is a Map, not an array!
        if (participant.trackPublications && participant.trackPublications.size > 0) {
          const publications = Array.from(participant.trackPublications.values());
          publications.forEach((publication: any) => {
            const isScreenShare = publication.source === SCREEN_SHARE_SOURCE || 
                                 publication.source === 'screen_share' ||
                                 String(publication.source).includes('screen');
            
            if (publication.track && publication.kind === Track.Kind.Video && !isScreenShare) {
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
                    videoElement.style.width = '320px';
                    videoElement.style.height = '240px';
                  }
                  
                  publication.track.attach(videoElement);
                  trackRefs.current[participant.identity] = publication.track;
                } catch (error) {
                }
              } else {
              }
            }
          });
        }
      });
    } else {
    }

    // Attach local participant tracks
    if (room && room.localParticipant) {
      
      // CRITICAL FIX: trackPublications is a Map, not an array!
      if (room.localParticipant.trackPublications && room.localParticipant.trackPublications.size > 0) {
        const publications = Array.from(room.localParticipant.trackPublications.values());
        
        publications.forEach((publication: any) => {
          
          // Only attach camera tracks, not screen share
          const isScreenShare = publication.source === SCREEN_SHARE_SOURCE || 
                               publication.source === 'screen_share' ||
                               String(publication.source).includes('screen');
          
          if (publication.track && publication.kind === Track.Kind.Video && !isScreenShare) {
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
                  videoElement.style.width = '320px';
                  videoElement.style.height = '240px';
                }
                
                publication.track.attach(videoElement);
                trackRefs.current[room.localParticipant.identity] = publication.track;
              } catch (error) {
              }
            } else {
            }
          }
        });
      } else {
      }
    } else {
    }

    // Add event listeners
    if (room && typeof room.on === 'function') {
      room.on('trackSubscribed', handleTrackSubscribed);
      room.on('trackUnsubscribed', handleTrackUnsubscribed);
      room.on('localTrackPublished', handleLocalTrackPublished);
    }

    return () => {
      debugLog('CLEANUP', '🧹 useEffect cleanup - Removing event listeners and detaching all tracks', {
        totalTrackRefs: Object.keys(trackRefs.current).length,
        totalVideoRefs: Object.keys(videoRefs.current).length,
        trackRefKeys: Object.keys(trackRefs.current),
        videoRefKeys: Object.keys(videoRefs.current)
      });
      
      if (room && typeof room.off === 'function') {
        room.off('trackSubscribed', handleTrackSubscribed);
        room.off('trackUnsubscribed', handleTrackUnsubscribed);
        room.off('localTrackPublished', handleLocalTrackPublished);
      }
      
      // Clean up track references
      Object.entries(trackRefs.current).forEach(([key, track]: [string, any]) => {
        if (track) {
          debugLog('CLEANUP', `Detaching track for key: ${key}`, { key });
          track.detach();
        }
      });
      trackRefs.current = {};
      
      debugLog('CLEANUP', '✅ useEffect cleanup complete - All tracks detached', {
        trackRefsCleared: Object.keys(trackRefs.current).length === 0
      });
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
  
  // CRITICAL: Log which participants are where with ALL IDs
  debugLog('REF_REGISTER', `📊 Video Layout Analysis`, {
    mainStageParticipants: mainStageParticipants.map(p => ({
      _id: p._id,
      displayName: p.displayName,
      userId: p.user?._id || p.userId,
      // CRITICAL: Show ALL IDs for main stage participants
      allIds: {
        participantId: p._id,
        userId: p.user?._id || p.userId,
        user_id: p.user?._id,
        displayName: p.displayName
      }
    })),
    thumbnailParticipants: thumbnailParticipants.map(p => ({
      _id: p._id,
      displayName: p.displayName,
      userId: p.user?._id || p.userId,
      // CRITICAL: Show ALL IDs for thumbnail participants
      allIds: {
        participantId: p._id,
        userId: p.user?._id || p.userId,
        user_id: p.user?._id,
        displayName: p.displayName
      }
    })),
    totalParticipants: participants.length,
    videoRefsCount: Object.keys(videoRefs.current).length,
    trackRefsCount: Object.keys(trackRefs.current).length,
    // CRITICAL: Show all video element keys currently registered
    allVideoElementKeys: Object.keys(videoRefs.current).filter(key => videoRefs.current[key] !== null),
    // CRITICAL: Show all track ref keys currently registered
    allTrackRefKeys: Object.keys(trackRefs.current)
  });
  
  // DEBUG: Log component state on every 10th render to avoid spam
  useEffect(() => {
    if (renderCountRef.current % 10 === 0) {
      debugLog('REF_REGISTER', `📊 Component state summary (render #${renderCountRef.current})`, {
        renderCount: renderCountRef.current,
        participants: participants.map(p => ({
          id: p._id,
          name: p.displayName,
          userId: p.user?._id || p.userId,
          // CRITICAL: Show all possible IDs for this participant
          allIds: {
            _id: p._id,
            userId: p.userId,
            user_id: p.user?._id,
            displayName: p.displayName
          }
        })),
        videoRefsState: Object.entries(videoRefs.current)
          .filter(([_, el]) => el !== null)
          .map(([key, el]) => ({
            key,
            hasElement: !!el,
            hasSrcObject: !!(el?.srcObject)
          })),
        trackRefsState: Object.keys(trackRefs.current),
        liveKitParticipantsCount: liveKitParticipants.size,
        isLiveKitConnected,
        // CRITICAL: Show LiveKit participants details
        liveKitParticipants: Array.from(liveKitParticipants.entries()).map(([key, p]) => ({
          key,
          identity: p.identity,
          name: p.name
        }))
      });
    }
  });
  

  // Helper function to get user ID from participant (used as LiveKit identity)
  const getUserIdFromParticipant = (participant: Participant): string | null => {
    // LiveKit identity is set to user._id in backend token generation
    // Priority: 1) user._id, 2) userId, 3) _id as fallback
    const userId = participant.user?._id || participant.userId || participant._id;
    return userId;
  };

  // Helper function to find LiveKit participant by backend participant
  const findLiveKitParticipantById = (participant: Participant) => {
    // Get the user ID which is used as LiveKit identity
    const userId = getUserIdFromParticipant(participant);
    
    debugLog('REF_REGISTER', `🔍 findLiveKitParticipantById for ${participant.displayName}`, {
      participant: {
        _id: participant._id,
        displayName: participant.displayName,
        userId: userId,
        user: participant.user
      },
      availableLiveKitParticipants: Array.from(liveKitParticipants.entries()).map(([key, p]) => ({
        key,
        identity: p.identity,
        name: p.name
      })),
      lookupAttempts: {
        byUserId: userId ? liveKitParticipants.has(userId) : false,
        byParticipantId: liveKitParticipants.has(participant._id)
      },
      // CRITICAL: Show all possible keys we could search for
      allPossibleKeys: [
        userId,
        participant._id,
        participant.user?._id,
        participant.userId,
        participant.displayName
      ].filter(Boolean)
    });
    
    // CRITICAL FIX: Use user ID (LiveKit identity) for lookup
    let liveKitParticipant = userId ? liveKitParticipants.get(userId) : undefined;
    
    // If not found by user ID, try participant._id as fallback
    if (!liveKitParticipant) {
      liveKitParticipant = liveKitParticipants.get(participant._id);
    }
    
    // If still not found, search by identity or name across all participants
    if (!liveKitParticipant) {
      for (const [key, lkParticipant] of liveKitParticipants.entries()) {
        if (lkParticipant?.identity === userId || 
            lkParticipant?.identity === participant._id ||
            lkParticipant?.name === participant.displayName) {
          liveKitParticipant = lkParticipant;
          break;
        }
      }
    }
    
    debugLog('REF_REGISTER', `🔍 findLiveKitParticipantById result for ${participant.displayName}`, {
      found: liveKitParticipant ? {
        identity: liveKitParticipant.identity,
        name: liveKitParticipant.name
      } : 'undefined'
    });
    
    return liveKitParticipant;
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
    // CRITICAL FIX: Check if this participant is local using multiple criteria
    // If no LiveKit participant found, assume it's local if it matches localParticipant
    let isLocalParticipant = liveKitParticipant ? 
      (localParticipant?.identity === userId || 
       localParticipant?.identity === participant._id ||
       localParticipant?.identity === liveKitParticipant.identity ||
       localParticipant?.name === participant.displayName) :
      (localParticipant?.identity === userId || 
       localParticipant?.identity === participant._id ||
       localParticipant?.name === participant.displayName);
    
    // CRITICAL: Override local participant detection with the correct logic
    // Only the participant whose LiveKit identity matches localParticipant.identity should be local
    if (localParticipant?.identity && liveKitParticipant?.identity) {
      const shouldBeLocal = localParticipant.identity === liveKitParticipant.identity;
      
      if (shouldBeLocal && !isLocalParticipant) {
        // This participant should be local but isn't - fix it
        isLocalParticipant = true;
        debugLog('REF_REGISTER', `✅ FIXING LOCAL PARTICIPANT: ${participant.displayName} (LiveKit identity matches localParticipant)`, {
          participantId: participant._id,
          liveKitIdentity: liveKitParticipant.identity,
          actualLocalParticipantIdentity: localParticipant.identity,
          isMainStage: isMainStage,
          wasLocal: false,
          nowLocal: true,
          reason: 'LiveKit identity matches localParticipant identity'
        });
      } else if (!shouldBeLocal && isLocalParticipant) {
        // This participant shouldn't be local but is - fix it
        isLocalParticipant = false;
        debugLog('REF_REGISTER', `🚫 FIXING NON-LOCAL PARTICIPANT: ${participant.displayName} (LiveKit identity does not match localParticipant)`, {
          participantId: participant._id,
          liveKitIdentity: liveKitParticipant.identity,
          actualLocalParticipantIdentity: localParticipant.identity,
          isMainStage: isMainStage,
          wasLocal: true,
          nowLocal: false,
          reason: 'LiveKit identity does not match localParticipant identity'
        });
      }
    }
    
    // CRITICAL: Prevent duplicate local participants
    // If this participant is not found in LiveKit participants but has the same display name as localParticipant,
    // it might be a duplicate. Only treat as local if it's the first one or matches exactly.
    if (!liveKitParticipant && localParticipant?.name === participant.displayName && !isMainStage) {
      // This is likely a duplicate participant, don't treat as local
      isLocalParticipant = false;
      debugLog('REF_REGISTER', `🚫 DUPLICATE PARTICIPANT DETECTED: ${participant.displayName}`, {
        participantId: participant._id,
        localParticipantName: localParticipant?.name,
        localParticipantIdentity: localParticipant?.identity,
        isDuplicate: true
      });
    }
    
    // CRITICAL: Log local participant detection details
    debugLog('REF_REGISTER', `🏠 LOCAL PARTICIPANT CHECK for ${participant.displayName}`, {
      participant: {
        _id: participant._id,
        displayName: participant.displayName,
        userId: userId
      },
      localParticipant: {
        identity: localParticipant?.identity,
        name: localParticipant?.name
      },
      liveKitParticipant: {
        identity: liveKitParticipant?.identity,
        name: liveKitParticipant?.name
      },
      checks: {
        userIdMatch: localParticipant?.identity === userId,
        participantIdMatch: localParticipant?.identity === participant._id,
        liveKitIdentityMatch: liveKitParticipant && localParticipant?.identity === liveKitParticipant.identity
      },
      isLocalParticipant: isLocalParticipant,
      // CRITICAL: Show what we're comparing against
      comparisonDetails: {
        localParticipantIdentity: localParticipant?.identity,
        localParticipantName: localParticipant?.name,
        participantUserId: userId,
        participantId: participant._id,
        liveKitParticipantIdentity: liveKitParticipant?.identity,
        allPossibleMatches: [
          localParticipant?.identity === userId,
          localParticipant?.identity === participant._id,
          localParticipant?.identity === liveKitParticipant?.identity,
          localParticipant?.name === participant.displayName
        ],
        // CRITICAL: Show the exact comparison that determines local status
        exactMatch: localParticipant?.identity === liveKitParticipant?.identity
      }
    });
    
    // CRITICAL: Debug why liveKitParticipant is undefined
    debugLog('REF_REGISTER', `🔍 DEBUGGING liveKitParticipant lookup for ${participant.displayName}`, {
      participant: {
        _id: participant._id,
        displayName: participant.displayName,
        userId: participant.user?._id || participant.userId
      },
      liveKitParticipants: Array.from(liveKitParticipants.entries()).map(([key, p]) => ({
        key,
        identity: p.identity,
        name: p.name
      })),
      findLiveKitParticipantByIdResult: liveKitParticipant ? {
        identity: liveKitParticipant.identity,
        name: liveKitParticipant.name
      } : 'undefined',
      isMainStage
    });
    
    // CRITICAL: Log which type of video element this is with ALL IDs
    debugLog('REF_REGISTER', `🎬 Rendering ${isMainStage ? 'MAIN STAGE' : 'THUMBNAIL'} video for ${participant.displayName}`, {
      participant: participant.displayName,
      isMainStage,
      // ALL POSSIBLE IDs FOR THIS PARTICIPANT
      allIds: {
        participantId: participant._id,
        userId: userId,
        user_id: participant.user?._id,
        displayName: participant.displayName,
        liveKitIdentity: liveKitParticipant?.identity,
        liveKitName: liveKitParticipant?.name
      },
      isLocalParticipant,
      // CRITICAL: Show which key will be used for video element registration
      primaryKey: liveKitParticipant?.identity || participant._id
    });
    
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
            // CRITICAL FIX: Use LiveKit identity as primary key for consistency with track events
            // This ensures video elements are registered with the same key that LiveKit uses for tracks
            // If no LiveKit participant found, use participant._id as fallback
            const primaryKey = liveKitParticipant?.identity || participant._id;
            
            // CRITICAL: Log the primary key to ensure consistency
            debugLog('REF_REGISTER', `🔑 PRIMARY KEY for ${participant.displayName}`, {
              participantId: participant._id,
              liveKitIdentity: liveKitParticipant?.identity,
              primaryKey: primaryKey,
              usingLiveKitIdentity: liveKitParticipant?.identity === primaryKey,
              usingParticipantId: participant._id === primaryKey
            });
            
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
              debugLog('WARNING', `⚡ Skipping rapid re-render for ${participant.displayName}`, {
                timeSinceLastRender,
                isRapidRerender: true
              });
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
                  debugLog('TRACK_ATTACH', `✅ Immediately attached local track in ref callback`, {
                    participant: participant.displayName,
                    isLocal: true,
                    primaryKey: primaryKey
                  });
                  
                  // CRITICAL FIX: Update trackRefs.current for local participant
                  trackRefs.current[primaryKey] = localVideoTrack.track;
                  debugLog('TRACK_ATTACH', `📝 Updated trackRefs for local participant`, {
                    participant: participant.displayName,
                    primaryKey: primaryKey,
                    trackRefsCount: Object.keys(trackRefs.current).length
                  });
                } catch (attachError) {
                  debugLog('ERROR', `❌ Failed to attach local track in ref callback`, {
                    participant: participant.displayName,
                    error: attachError instanceof Error ? attachError.message : String(attachError)
                  });
                }
              } else {
                debugLog('TRACK_ATTACH', `⚠️ No local video track found for ${participant.displayName}`, {
                  participant: participant.displayName,
                  isLocalParticipant: isLocalParticipant,
                  hasRoom: !!liveKitService?.room,
                  hasLocalParticipant: !!liveKitService?.room?.localParticipant,
                  videoTrackPublications: liveKitService?.room?.localParticipant ? 
                    Array.from(liveKitService.room.localParticipant.videoTrackPublications.values()).map((pub: any) => ({
                      source: pub.source,
                      hasTrack: !!pub.track
                    })) : []
                });
              }
            }
            
            // REMOVED: Multiple key registration that was causing race conditions
            // Only register with the primary key (participant._id) for consistency
            
            // Log the registration
            if (isNewRegistration) {
              debugLog('REF_REGISTER', `📹 NEW video element registered for ${participant.displayName}`, {
                participant: participant.displayName,
                primaryKey,
                totalKeys: keysToRegister.length,
                allKeys: keysToRegister,
                // CRITICAL: Show ALL IDs being used for registration
                allIds: {
                  participantId: participant._id,
                  userId: userId,
                  user_id: participant.user?._id,
                  displayName: participant.displayName,
                  liveKitIdentity: liveKitParticipant?.identity,
                  liveKitName: liveKitParticipant?.name
                },
                isLocal: isLocalParticipant,
                isMainStage: isMainStage,
                // CRITICAL: Show which keys the video element is registered under
                videoElementKeys: {
                  primaryKey: primaryKey,
                  allRegisteredKeys: keysToRegister,
                  liveKitIdentityKey: liveKitParticipant?.identity,
                  userIdKey: userId,
                  participantIdKey: participant._id,
                  displayNameKey: participant.displayName
                }
              });
            } else if (isUpdatingExisting) {
              debugLog('WARNING', `⚠️ UPDATING existing video element for ${participant.displayName}`, {
                participant: participant.displayName,
                primaryKey,
                totalKeys: keysToRegister.length,
                allKeys: keysToRegister,
                oldElementExists: true
              });
            } else if (isUnregistering) {
              debugLog('REF_REGISTER', `🗑️ Unregistering video element for ${participant.displayName}`, {
                participant: participant.displayName,
                primaryKey,
                totalKeys: keysToRegister.length
              });
            } else if (el !== null) {
              debugLog('REF_REGISTER', `🔄 Re-registering SAME video element for ${participant.displayName}`, {
                participant: participant.displayName,
                primaryKey,
                totalKeys: keysToRegister.length,
                allKeys: keysToRegister,
                sameElement: true
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
