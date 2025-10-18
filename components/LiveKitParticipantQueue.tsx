import React, { useEffect, useRef } from 'react';
import { Participant } from '../hooks/useParticipantQueue';
import { LiveKitParticipant } from '../lib/livekit-service';
import { Track, ConnectionQuality } from 'livekit-client';

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
  
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const screenVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const trackRefs = useRef<{ [key: string]: any }>({});
  const screenTrackRefs = useRef<{ [key: string]: any }>({});
  const selectedParticipantRef = useRef<Participant | null>(null);
  const retryIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  
  // Refs to prevent stale closures in event handlers
  const participantsRef = useRef(participants);
  const liveKitParticipantsRef = useRef(liveKitParticipants);
  
  // Update refs when participants change
  useEffect(() => {
    participantsRef.current = participants;
    liveKitParticipantsRef.current = liveKitParticipants;
  }, [participants, liveKitParticipants]);
  
  // Global cleanup effect for retry intervals
  useEffect(() => {
    return () => {
      Object.values(retryIntervals.current).forEach(clearInterval);
      retryIntervals.current = {};
    };
  }, []);
  
  // Video switching detection logs
  const logVideoSwitch = (action: string, data: any) => {
    console.log(`[VIDEO-SWITCH] ${action}:`, data);
  };

  // Screen sharing functions
  const startScreenShare = async () => {
    if (!liveKitService?.room?.localParticipant) {
      console.error('No local participant available for screen sharing');
      return;
    }

    try {
      // Check if getDisplayMedia is supported
      if (!('getDisplayMedia' in navigator.mediaDevices)) {
        alert('Your browser does not support screen sharing.');
        return;
      }

      const { createLocalScreenTracks } = await import('livekit-client');
      const screenTracks = await createLocalScreenTracks({
        audio: false,
        video: true
      });

      // Publish screen share track
      await liveKitService.room.localParticipant.publishTrack(screenTracks[0]);
      
      logVideoSwitch('SCREEN_SHARE_STARTED', {
        identity: liveKitService.room.localParticipant.identity
      });
    } catch (error) {
      logVideoSwitch('SCREEN_SHARE_ERROR', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (error instanceof Error && error.message.includes('NotAllowedError')) {
        alert('Screen sharing permission denied.');
      } else if (error instanceof Error && error.message.includes('NotSupportedError')) {
        alert('Screen sharing not supported on this device.');
      }
    }
  };

  const stopScreenShare = async () => {
    if (!liveKitService?.room?.localParticipant) return;

    try {
      const screenTracks = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
        .filter((pub: any) => pub.source === 'screen_share');
      
      for (const publication of screenTracks) {
        await liveKitService.room.localParticipant.unpublishTrack((publication as any).track);
      }
      
      logVideoSwitch('SCREEN_SHARE_STOPPED', {
        identity: liveKitService.room.localParticipant.identity
      });
    } catch (error) {
      logVideoSwitch('SCREEN_SHARE_STOP_ERROR', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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

  // Debug: Log hand-raise state changes
  useEffect(() => {
    participants.forEach(participant => {
      logVideoSwitch('HAND_RAISE_STATE', {
        id: participant._id,
        name: participant.displayName,
        hasHandRaised: participant.hasHandRaised,
        role: participant.role
      });
    });
  }, [participants]);

  // Debug: Log LiveKit participants map changes
  useEffect(() => {
    logVideoSwitch('LIVEKIT_PARTICIPANTS_CHANGED', {
      count: liveKitParticipants.size,
      liveKitKeys: Array.from(liveKitParticipants.keys()),
      liveKitParticipants: Array.from(liveKitParticipants.entries()).map(([key, participant]) => ({
        key,
        name: participant.name,
        identity: participant.identity,
        isLocal: (participant as any).isLocal
      }))
    });
  }, [liveKitParticipants]);

  // Connect LiveKit video tracks to video elements
  useEffect(() => {
    if (!liveKitService?.room) return;

    const room = liveKitService.room;
    
    // Ensure local camera is published with timeout and better error handling
    const ensureLocalCameraPublished = async () => {
      if (!room?.localParticipant) return;
      const alreadyPublished = Array.from(room.localParticipant.videoTrackPublications.values())
        .some((pub: unknown) => (pub as any).source === 'camera' && (pub as any).track);
      if (alreadyPublished) {
        logVideoSwitch('CAMERA_READY', { identity: room.localParticipant.identity, reason: 'already_published' });
        return;
      }

      try {
        // Wrap getUserMedia in 3-second timeout
        const cameraPromise = navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Camera access timeout')), 3000)
        );
        
        const stream = await Promise.race([cameraPromise, timeoutPromise]) as MediaStream;
        const [track] = stream.getVideoTracks();
        
        if (track) {
          const { createLocalVideoTrack } = await import('livekit-client');
          const localTrack = await createLocalVideoTrack({ deviceId: track.getSettings().deviceId });
          await room.localParticipant.publishTrack(localTrack);
          logVideoSwitch('CAMERA_READY', { identity: room.localParticipant.identity, reason: 'successfully_published' });
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
          logVideoSwitch('CAMERA_PERMISSION_DENIED', { error: err.message, identity: room.localParticipant.identity });
        } else if (err.message.includes('timeout')) {
          logVideoSwitch('CAMERA_WAIT_TIMEOUT', { error: err.message, identity: room.localParticipant.identity });
        } else {
          logVideoSwitch('LOCAL_CAMERA_ERROR', { error: err.message, identity: room.localParticipant.identity });
        }
      }
    };

    // Non-blocking camera publishing - don't await
    ensureLocalCameraPublished();
    
    

    // NOTE: Video elements ready notification removed - no longer needed
    // Camera is enabled during initial LiveKit connection

    // Handle track subscription for remote participants
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      const isScreenShare = track.source === SCREEN_SHARE_SOURCE || 
                           track.source === 'screen_share' ||
                           String(track.source).includes('screen');
      
      // Skip non-video tracks
      if (track.kind !== Track.Kind.Video) return;
      
      // Log the track subscription attempt
      logVideoSwitch('TRACK_SUBSCRIPTION_ATTEMPT', {
        liveKitIdentity: participant.identity,
        liveKitName: participant.name,
        participantsCount: participantsRef.current.length,
        participantsAvailable: participantsRef.current.length > 0
      });
      
      // Find matching participant using multiple strategies
      const matchingParticipant = participantsRef.current.find(p => {
        const realId = (p as any)?.user_id;
        const participantId = p._id;
        const identity = p.identity;
        
        // Strategy 1: Exact match with real user_id
        if (realId === participant.identity) {
          logVideoSwitch('PARTICIPANT_MATCH_FOUND', {
            participantName: p.displayName,
            strategy: 'realId_match',
            realId: realId,
            liveKitIdentity: participant.identity
          });
          return true;
        }
        
        // Strategy 2: Match with participant._id
        if (participantId === participant.identity) {
          logVideoSwitch('PARTICIPANT_MATCH_FOUND', {
            participantName: p.displayName,
            strategy: 'participantId_match',
            participantId: participantId,
            liveKitIdentity: participant.identity
          });
          return true;
        }
        
        // Strategy 3: Match with identity field
        if (identity === participant.identity) {
          logVideoSwitch('PARTICIPANT_MATCH_FOUND', {
            participantName: p.displayName,
            strategy: 'identity_match',
            identity: identity,
            liveKitIdentity: participant.identity
          });
          return true;
        }
        
        // Strategy 4: Match by display name (fallback)
        if (p.displayName === participant.name) {
          logVideoSwitch('PARTICIPANT_MATCH_FOUND', {
            participantName: p.displayName,
            strategy: 'name_match',
            displayName: p.displayName,
            liveKitName: participant.name
          });
          return true;
        }
        
        return false;
      });
      
      if (!matchingParticipant) {
        logVideoSwitch('TRACK_NO_MATCH', {
          liveKitIdentity: participant.identity,
          liveKitName: participant.name,
          availableParticipants: participantsRef.current.map(p => ({
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
      
      // Use the best available ID as primary key
      const primaryKey = (matchingParticipant as any)?.user_id || 
                        matchingParticipant._id || 
                        matchingParticipant.identity ||
                        participant.identity;
      
      // Handle screen share vs camera tracks
      if (isScreenShare) {
        const screenKey = `screen_${primaryKey}`;
        const screenVideoElement = screenVideoRefs.current[screenKey];
        
        if (screenVideoElement) {
          try {
            if (screenVideoElement.offsetWidth === 0 || screenVideoElement.offsetHeight === 0) {
              screenVideoElement.style.width = '100%';
              screenVideoElement.style.height = '100%';
            }
            
            track.attach(screenVideoElement);
            screenTrackRefs.current[screenKey] = track;
            
            logVideoSwitch('SCREEN_SHARE_SUBSCRIBED', {
              participant: matchingParticipant.displayName,
              key: screenKey,
              videoElementExists: true
            });
          } catch (error) {
            logVideoSwitch('SCREEN_SHARE_ATTACH_ERROR', {
              participant: matchingParticipant.displayName,
              key: screenKey,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        } else {
          logVideoSwitch('SCREEN_VIDEO_ELEMENT_NOT_FOUND', {
            participant: matchingParticipant.displayName,
            key: screenKey,
            registeredKeys: Object.keys(screenVideoRefs.current)
          });
          
          // Retry logic for screen share track attachment
          const retryInterval = setInterval(() => {
            const retryScreenElement = screenVideoRefs.current[screenKey];
            if (retryScreenElement) {
              try {
                track.attach(retryScreenElement);
                screenTrackRefs.current[screenKey] = track;
                logVideoSwitch('SCREEN_SHARE_ATTACHED_RETRY', {
                  participant: matchingParticipant.displayName,
                  key: screenKey
                });
                clearInterval(retryInterval);
                delete retryIntervals.current[screenKey];
              } catch (error) {
                logVideoSwitch('SCREEN_SHARE_ATTACH_RETRY_ERROR', {
                  participant: matchingParticipant.displayName,
                  key: screenKey,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          }, 500);
          
          // Store retry interval for cleanup
          retryIntervals.current[screenKey] = retryInterval;
          
          // Clear retry after 10 seconds
          setTimeout(() => {
            if (retryIntervals.current[screenKey]) {
              clearInterval(retryIntervals.current[screenKey]);
              delete retryIntervals.current[screenKey];
            }
          }, 10000);
        }
      } else {
        // Camera track
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
          
          // If video element not found, set up a retry mechanism for thumbnail reopen
          // This handles cases where the element might be recreated later
          const retryInterval = setInterval(() => {
            const retryElement = videoRefs.current[primaryKey];
            if (retryElement) {
              try {
                track.attach(retryElement);
                trackRefs.current[primaryKey] = track;
                logVideoSwitch('TRACK_ATTACHED_RETRY', {
                  participant: matchingParticipant.displayName,
                  key: primaryKey
                });
                clearInterval(retryInterval);
                delete retryIntervals.current[primaryKey];
              } catch (error) {
                logVideoSwitch('TRACK_ATTACH_RETRY_ERROR', {
                  participant: matchingParticipant.displayName,
                  key: primaryKey,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          }, 500);
          
          // Store retry interval for cleanup
          retryIntervals.current[primaryKey] = retryInterval;
          
          // Clear retry after 10 seconds to prevent infinite retries
          setTimeout(() => {
            if (retryIntervals.current[primaryKey]) {
              clearInterval(retryIntervals.current[primaryKey]);
              delete retryIntervals.current[primaryKey];
            }
          }, 10000);
        }
      }
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind !== Track.Kind.Video) return;
      
      const isScreenShare = track.source === SCREEN_SHARE_SOURCE || 
                           track.source === 'screen_share' ||
                           String(track.source).includes('screen');
      
      const matchingParticipant = participantsRef.current.find(p => {
        const realId = (p as any)?.user_id;
        return realId === participant.identity;
      });
      
      if (!matchingParticipant) return;
      
      const primaryKey = (matchingParticipant as any)?.user_id;
      
      track.detach();
      
      if (isScreenShare) {
        const screenKey = `screen_${primaryKey}`;
        delete screenTrackRefs.current[screenKey];
        
        const screenVideoElement = screenVideoRefs.current[screenKey];
        if (screenVideoElement) {
          screenVideoElement.srcObject = null;
        }
        
        logVideoSwitch('SCREEN_SHARE_UNSUBSCRIBED', {
          participant: matchingParticipant.displayName,
          key: screenKey
        });
      } else {
        delete trackRefs.current[primaryKey];
        
        const videoElement = videoRefs.current[primaryKey];
        if (videoElement) {
          videoElement.srcObject = null;
        }
        
        logVideoSwitch('TRACK_DETACHED', {
          participant: matchingParticipant.displayName,
          key: primaryKey
        });
      }
    };

    // Handle local participant tracks
    const handleLocalTrackPublished = (publication: any, participant: any) => {
      if (publication.kind !== Track.Kind.Video || !participant.isLocal) return;
      
      const isScreenShare = publication.source === SCREEN_SHARE_SOURCE || 
                           publication.source === 'screen_share' ||
                           String(publication.source).includes('screen');
      
      if (isScreenShare) {
        const screenKey = `screen_${participant.identity}`;
        const screenVideoElement = screenVideoRefs.current[screenKey];
        
        if (screenVideoElement && publication.track) {
          try {
            if (screenVideoElement.offsetWidth === 0 || screenVideoElement.offsetHeight === 0) {
              screenVideoElement.style.width = '100%';
              screenVideoElement.style.height = '100%';
            }
            
            publication.track.attach(screenVideoElement);
            screenTrackRefs.current[screenKey] = publication.track;
            
            logVideoSwitch('LOCAL_SCREEN_SHARE_PUBLISHED', {
              identity: participant.identity,
              name: participant.name,
              key: screenKey
            });
          } catch (error) {
            logVideoSwitch('LOCAL_SCREEN_SHARE_ERROR', {
              identity: participant.identity,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        } else {
          logVideoSwitch('LOCAL_SCREEN_VIDEO_ELEMENT_NOT_FOUND', {
            identity: participant.identity,
            hasTrack: !!publication.track,
            registeredKeys: Object.keys(screenVideoRefs.current)
          });
        }
      } else {
        // Camera track
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
          
          if (!publication.track || publication.kind !== Track.Kind.Video) return;
          
          const matchingParticipant = participantsRef.current.find(p => {
            const realId = (p as any)?.user_id;
            return realId === participant.identity;
          });
          
          if (!matchingParticipant) return;
          
          const primaryKey = (matchingParticipant as any)?.user_id;
          
          if (isScreenShare) {
            const screenKey = `screen_${primaryKey}`;
            const screenVideoElement = screenVideoRefs.current[screenKey];
            
            if (screenVideoElement) {
              try {
                if (screenVideoElement.offsetWidth === 0 || screenVideoElement.offsetHeight === 0) {
                  screenVideoElement.style.width = '100%';
                  screenVideoElement.style.height = '100%';
                }
                
                publication.track.attach(screenVideoElement);
                screenTrackRefs.current[screenKey] = publication.track;
                
                logVideoSwitch('EXISTING_SCREEN_SHARE_ATTACHED', {
                  participant: matchingParticipant.displayName,
                  key: screenKey
                });
              } catch (error) {
                logVideoSwitch('EXISTING_SCREEN_SHARE_ERROR', {
                  participant: matchingParticipant.displayName,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          } else {
            // Camera track
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
        
        if (!publication.track || publication.kind !== Track.Kind.Video) return;
        
        if (isScreenShare) {
          const screenKey = `screen_${room.localParticipant.identity}`;
          const screenVideoElement = screenVideoRefs.current[screenKey];
          
          if (screenVideoElement) {
            try {
              if (screenVideoElement.offsetWidth === 0 || screenVideoElement.offsetHeight === 0) {
                screenVideoElement.style.width = '100%';
                screenVideoElement.style.height = '100%';
              }
              
              publication.track.attach(screenVideoElement);
              screenTrackRefs.current[screenKey] = publication.track;
              
              logVideoSwitch('LOCAL_EXISTING_SCREEN_SHARE_ATTACHED', {
                identity: room.localParticipant.identity,
                name: room.localParticipant.name,
                key: screenKey
              });
            } catch (error) {
              logVideoSwitch('LOCAL_EXISTING_SCREEN_SHARE_ERROR', {
                identity: room.localParticipant.identity,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        } else {
          // Camera track
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
        }
      });
    }

    // Handle participant connection/disconnection for track reattachment
    const reattachTracksForNewParticipant = (participant: any) => {
      logVideoSwitch('PARTICIPANT_CONNECTED', {
        identity: participant.identity,
        name: participant.name,
        isLocal: participant.isLocal
      });
      
      // Try to attach any existing tracks for this participant
      if (participant.trackPublications) {
        const publications = Array.from(participant.trackPublications.values());
        publications.forEach((publication: any) => {
          if (publication.track && publication.kind === 'video' && publication.source === 'camera') {
            handleTrackSubscribed(publication.track, publication, participant);
          }
        });
      }
    };

    // Reattach tracks when video elements are recreated (for thumbnail reopen)
    const reattachTracksForExistingParticipant = (participantId: string) => {
      logVideoSwitch('REATTACH_TRACKS_FOR_PARTICIPANT', {
        participantId,
        reason: 'video_element_recreated'
      });
      
      // Find the participant in our participants array
      const participant = participantsRef.current.find(p => {
        const realId = (p as any)?.user_id;
        return realId === participantId;
      });
      
      if (!participant) return;
      
      // Find the LiveKit participant
      const liveKitParticipant = liveKitParticipantsRef.current.get(participantId);
      if (!liveKitParticipant) return;
      
      // Get the video element
      const videoElement = videoRefs.current[participantId];
      if (!videoElement) return;
      
      // Try to find and attach the track from LiveKit room
      if (liveKitService?.room) {
        const roomParticipant = liveKitService.room.participants.get(participantId);
        if (roomParticipant && roomParticipant.trackPublications) {
          const publications = Array.from(roomParticipant.trackPublications.values());
          publications.forEach((publication: any) => {
            if (publication.track && publication.kind === 'video' && publication.source === 'camera') {
              try {
                publication.track.attach(videoElement);
                trackRefs.current[participantId] = publication.track;
                logVideoSwitch('TRACK_REATTACHED', {
                  participant: participant.displayName,
                  key: participantId
                });
              } catch (error) {
                logVideoSwitch('TRACK_REATTACH_ERROR', {
                  participant: participant.displayName,
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
              }
            }
          });
        }
      }
    };

    const cleanUpTracksForParticipant = (participant: any) => {
      // Clean up retry intervals for this participant
      Object.keys(retryIntervals.current).forEach(k => {
        if (k.includes(participant.identity)) {
          clearInterval(retryIntervals.current[k]);
          delete retryIntervals.current[k];
        }
      });
      
      logVideoSwitch('PARTICIPANT_DISCONNECTED', {
        identity: participant.identity,
        name: participant.name
      });
      
      // Clean up video element and track references
      const primaryKey = participant.identity;
      const videoElement = videoRefs.current[primaryKey];
      if (videoElement) {
        videoElement.srcObject = null;
        delete videoRefs.current[primaryKey];
      }
      
      const track = trackRefs.current[primaryKey];
      if (track) {
        track.detach();
        delete trackRefs.current[primaryKey];
      }
    };

    // Add event listeners
    if (room && typeof room.on === 'function') {
      room.on('trackSubscribed', handleTrackSubscribed);
      room.on('trackUnsubscribed', handleTrackUnsubscribed);
      room.on('localTrackPublished', handleLocalTrackPublished);
      room.on('participantConnected', reattachTracksForNewParticipant);
      room.on('participantDisconnected', cleanUpTracksForParticipant);
    }

    return () => {
      if (room && typeof room.off === 'function') {
        room.off('trackSubscribed', handleTrackSubscribed);
        room.off('trackUnsubscribed', handleTrackUnsubscribed);
        room.off('localTrackPublished', handleLocalTrackPublished);
        room.off('participantConnected', reattachTracksForNewParticipant);
        room.off('participantDisconnected', cleanUpTracksForParticipant);
      }
      
      // Clean up track references
      Object.entries(trackRefs.current).forEach(([key, track]: [string, any]) => {
        if (track) {
          track.detach();
        }
      });
      trackRefs.current = {};
      
      // Clean up screen share track references
      Object.entries(screenTrackRefs.current).forEach(([key, track]: [string, any]) => {
        if (track) {
          track.detach();
        }
      });
      screenTrackRefs.current = {};
      
      // Clean up retry intervals
      Object.values(retryIntervals.current).forEach(interval => {
        clearInterval(interval);
      });
      retryIntervals.current = {};
    };
  }, [liveKitService, participants, liveKitParticipants]);

  // Sort participants with Zoom-style prioritization
  const sortedParticipants = React.useMemo(() => {
    const sorted = [...participants].sort((a, b) => {
      // 1. Host always stays at index 0
      if (a.role === 'HOST' && b.role !== 'HOST') return -1;
      if (b.role === 'HOST' && a.role !== 'HOST') return 1;
      if (a.role === 'HOST' && b.role === 'HOST') return 0;

      // 2. Users with raised hands, sorted by handRaisedAt timestamp (oldest first)
      if (a.hasHandRaised && !b.hasHandRaised) return -1;
      if (!a.hasHandRaised && b.hasHandRaised) return 1;
      if (a.hasHandRaised && b.hasHandRaised) {
        const aTime = new Date(a.handRaisedAt || 0).getTime();
        const bTime = new Date(b.handRaisedAt || 0).getTime();
        return aTime - bTime; // Oldest first
      }

      // 3. Users who are actively speaking
      if (a.isSpeaking && !b.isSpeaking) return -1;
      if (!a.isSpeaking && b.isSpeaking) return 1;

      // 4. Remaining users sorted by joinedAt (oldest first)
      const aCreated = new Date(a.joinedAt || 0).getTime();
      const bCreated = new Date(b.joinedAt || 0).getTime();
      return aCreated - bCreated;
    });

    // Debug logging
    console.log('[THUMBNAIL_SORT]', sorted.map(p => ({
      name: p.displayName,
      hasHandRaised: p.hasHandRaised,
      isSpeaking: p.isSpeaking,
      joinedAt: p.joinedAt,
      role: p.role,
      handRaisedAt: p.handRaisedAt
    })));

    return sorted;
  }, [participants]);

  // Filter out duplicate participants (same user appearing as both local and remote)
  const uniqueParticipants = React.useMemo(() => {
    const unique = sortedParticipants.filter(
      (p, idx, arr) => arr.findIndex(q => 
        ((q as any).user_id || q._id || q.identity) === ((p as any).user_id || p._id || p.identity)
      ) === idx
    );
    
    console.log('[DUPLICATE_FILTER]', {
      originalCount: sortedParticipants.length,
      uniqueCount: unique.length,
      duplicates: sortedParticipants.length - unique.length,
      participants: unique.map(p => ({
        name: p.displayName,
        id: (p as any).user_id || p._id || p.identity,
        role: p.role
      }))
    });
    
    return unique;
  }, [sortedParticipants]);

  // Get main stage participants based on view mode
  const getMainStageParticipants = () => {
    if (screenShareMode && screenShareParticipant) {
      return [screenShareParticipant];
    }
    
    if (viewMode === 'speaker') {
      // Speaker mode: Show selectedParticipant if available, otherwise first participant
      if (selectedParticipant && uniqueParticipants.find(p => p._id === selectedParticipant._id)) {
        return [selectedParticipant];
      }
      // Fallback to first participant if no selected participant or selected participant not found
      return uniqueParticipants.slice(0, 1);
    }
    
    // Grid mode is now handled by gridParticipants directly
    return [];
  };

  // Get thumbnail participants based on view mode
  const getThumbnailParticipants = () => {
    if (screenShareMode) {
      // In screen share mode, show ALL participants as thumbnails (including screen sharer's camera)
      return uniqueParticipants;
    }
    
    if (viewMode === 'speaker') {
      // Speaker mode: Show all participants except the one being displayed as main video
      const mainParticipants = getMainStageParticipants();
      const mainParticipantId = mainParticipants[0]?._id;
      return uniqueParticipants.filter(p => p._id !== mainParticipantId);
    }
    
    // Grid mode: No thumbnails needed since all participants are in main stage
    return [];
  };

  const mainStageParticipants = getMainStageParticipants();
  const thumbnailParticipants = getThumbnailParticipants();
  
  // Determine which participants to use for grid rendering
  const gridParticipants = viewMode === 'grid' ? uniqueParticipants : mainStageParticipants;
  
  // Debug logging for grid participants
  console.log('[GRID_RENDERING]', {
    viewMode,
    screenShareMode,
    gridParticipantsCount: gridParticipants.length,
    mainStageParticipantsCount: mainStageParticipants.length,
    uniqueParticipantsCount: uniqueParticipants.length,
    usingUniqueForGrid: viewMode === 'grid'
  });
  
  
  

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

  // ParticipantTile Component - Dedicated component for each participant tile
  const ParticipantTile: React.FC<{
    participant: Participant;
    isMainStage: boolean;
    activeSpeaker: Participant | null;
    screenShareMode: boolean;
    screenShareParticipant: Participant | null;
    localParticipant: LiveKitParticipant | null;
    liveKitParticipants: Map<string, LiveKitParticipant>;
    liveKitService: any;
    onParticipantClick?: (participant: Participant) => void;
    onHandRaiseClick?: (participant: Participant) => void;
    onKickParticipant?: (participant: Participant) => void;
    isHost: boolean;
    logVideoSwitch: (action: string, data: any) => void;
    videoRefs: React.MutableRefObject<{ [key: string]: HTMLVideoElement | null }>;
    screenVideoRefs: React.MutableRefObject<{ [key: string]: HTMLVideoElement | null }>;
    trackRefs: React.MutableRefObject<{ [key: string]: any }>;
    screenTrackRefs: React.MutableRefObject<{ [key: string]: any }>;
    retryIntervals: React.MutableRefObject<Record<string, ReturnType<typeof setInterval>>>;
    participants: Participant[];
  }> = ({
    participant,
    isMainStage,
    activeSpeaker,
    screenShareMode,
    screenShareParticipant,
    localParticipant,
    liveKitParticipants,
    liveKitService,
    onParticipantClick,
    onHandRaiseClick,
    onKickParticipant,
    isHost,
    logVideoSwitch,
    videoRefs,
    screenVideoRefs,
    trackRefs,
    screenTrackRefs,
    retryIntervals,
    participants
  }) => {
    const isActiveSpeaker = activeSpeaker?._id === participant._id;
    const isScreenSharing = screenShareMode && screenShareParticipant?._id === participant._id;
    
    // Helper function to get user ID from participant
    const getUserIdFromParticipant = (p: Participant): string | null => {
      return (p as any)?.user_id || null;
    };

    const findLiveKitParticipantById = (p: Participant) => {
      const identity = getUserIdFromParticipant(p);
      if (!identity) return undefined;

      const lk = liveKitParticipants.get(identity);
      if (!lk) {
        logVideoSwitch('LIVEKIT_PARTICIPANT_NOT_FOUND', {
          displayName: p.displayName,
          identityWanted: identity,
          availableLiveKitIdentities: Array.from(liveKitParticipants.keys())
        });
      }
      return lk;
    };
    
    // Find corresponding LiveKit participant using improved lookup
    const liveKitParticipant = findLiveKitParticipantById(participant);
    const userId = getUserIdFromParticipant(participant);
    
    // Local/remote detection
    const isLocalParticipant =
      !!localParticipant?.identity && !!userId &&
      localParticipant.identity === userId;
    
    // Check if participant has screen share track
    const hasScreenShare = liveKitParticipant && 
      Array.from((liveKitParticipant as any).trackPublications?.values() || [])
        .some((pub: any) => pub.source === 'screen_share' && pub.track);

    // Wait for participant to be available with improved timeout handling
    const [waited, setWaited] = React.useState(false);
    const [showLoading, setShowLoading] = React.useState(true);
    
    React.useEffect(() => {
      // 2000ms → show "Loading video..."
      const loadingTimer = setTimeout(() => {
        setShowLoading(false);
      }, 2000);
      
      // 8000ms → log timeout if still no track
      const timeoutTimer = setTimeout(() => {
        setWaited(true);
        if (!liveKitParticipant && !isLocalParticipant) {
          logVideoSwitch('NO_CAMERA_TRACK_AFTER_8S', {
            participant: participant.displayName,
            userId,
            isMainStage,
            waitedMs: 8000
          });
        }
      }, 8000);
      
      // Cancel timers if track becomes available
      if (liveKitParticipant || isLocalParticipant) {
        clearTimeout(loadingTimer);
        clearTimeout(timeoutTimer);
        setShowLoading(false);
        setWaited(true);
      }
      
      return () => {
        clearTimeout(loadingTimer);
        clearTimeout(timeoutTimer);
      };
    }, [liveKitParticipant, isLocalParticipant]);
    
    if (!liveKitParticipant && !isLocalParticipant && showLoading) {
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
        {/* Video Container */}
        <div className={isScreenSharing || hasScreenShare ? "screen-share-container" : ""}>
          {/* Camera Video Element */}
          <div className={isScreenSharing || hasScreenShare ? "camera-pip" : ""}>
            <video
              ref={el => {
            // Use the best available ID as primary key
            const primaryKey = userId || 
                              liveKitParticipant?.identity || 
                              participant._id;
            
            if (!primaryKey) {
              logVideoSwitch('VIDEO_REF_NO_VALID_ID', {
                participant: participant.displayName,
                userId,
                liveKitIdentity: liveKitParticipant?.identity,
                participantId: participant._id
              });
              return;
            }
            
            // Get old element reference before overwriting
            const oldElement = videoRefs.current[primaryKey];
            const isSameElement = oldElement === el;
            
            // Skip if it's the same element (prevents spam)
            if (isSameElement && el !== null) {
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
              } else {
                // For remote participants, try to reattach existing tracks
                // This handles the case when thumbnails are closed and reopened
                setTimeout(() => {
                  // Find the participant in our participants array using multiple strategies
                  const foundParticipant = participants.find(p => {
                    const realId = (p as any)?.user_id;
                    const participantId = p._id;
                    const identity = p.identity;
                    
                    return realId === primaryKey || 
                           participantId === primaryKey || 
                           identity === primaryKey ||
                           p.displayName === participant.displayName;
                  });
                  
                  if (!foundParticipant) {
                    logVideoSwitch('REATTACH_PARTICIPANT_NOT_FOUND', {
                      primaryKey,
                      availableParticipants: participants.map(p => ({
                        name: p.displayName,
                        user_id: (p as any)?.user_id,
                        _id: p._id,
                        identity: p.identity
                      }))
                    });
                    return;
                  }
                  
                  // Try multiple LiveKit participant lookups
                  let roomParticipant = liveKitService?.room?.participants.get(primaryKey);
                  if (!roomParticipant) {
                    // Try with participant's user_id
                    const realId = (foundParticipant as any)?.user_id;
                    if (realId) {
                      roomParticipant = liveKitService?.room?.participants.get(realId);
                    }
                  }
                  if (!roomParticipant) {
                    // Try with participant's _id
                    roomParticipant = liveKitService?.room?.participants.get(foundParticipant._id);
                  }
                  
                  if (!roomParticipant) {
                    logVideoSwitch('REATTACH_LIVEKIT_PARTICIPANT_NOT_FOUND', {
                      primaryKey,
                      participantName: foundParticipant.displayName,
                      availableLiveKitKeys: Array.from(liveKitService?.room?.participants.keys() || [])
                    });
                    return;
                  }
                  
                  // Get the video element
                  const videoElement = videoRefs.current[primaryKey];
                  if (!videoElement) {
                    logVideoSwitch('REATTACH_VIDEO_ELEMENT_NOT_FOUND', {
                      primaryKey,
                      participantName: foundParticipant.displayName
                    });
                    return;
                  }
                  
                  // Try to find and attach the track from LiveKit room
                  if (roomParticipant.trackPublications) {
                    const publications = Array.from(roomParticipant.trackPublications.values());
                    publications.forEach((publication: any) => {
                      if (publication.track && publication.kind === 'video' && publication.source === 'camera') {
                        try {
                          publication.track.attach(videoElement);
                          trackRefs.current[primaryKey] = publication.track;
                          logVideoSwitch('TRACK_REATTACHED', {
                            participant: foundParticipant.displayName,
                            key: primaryKey,
                            liveKitIdentity: roomParticipant.identity
                          });
                        } catch (error) {
                          logVideoSwitch('TRACK_REATTACH_ERROR', {
                            participant: foundParticipant.displayName,
                            error: error instanceof Error ? error.message : 'Unknown error'
                          });
                        }
                      }
                    });
                  }
                }, 100); // Small delay to ensure element is fully mounted
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
          </div>
        
          {/* Screen Share Video Element */}
          {(isScreenSharing || hasScreenShare) && (
            <video
              className="screen-share-video"
              ref={el => {
              const primaryKey = userId || 
                                liveKitParticipant?.identity || 
                                participant._id;
              
              if (!primaryKey) return;
              
              const screenKey = `screen_${primaryKey}`;
              const oldElement = screenVideoRefs.current[screenKey];
              const isSameElement = oldElement === el;
              
              if (isSameElement && el !== null) return;
              
              screenVideoRefs.current[screenKey] = el;
              
              if (el) {
                logVideoSwitch('SCREEN_VIDEO_REF_REGISTERED', {
                  participant: participant.displayName,
                  key: screenKey,
                  isLocal: isLocalParticipant,
                  isMainStage
                });
              } else {
                logVideoSwitch('SCREEN_VIDEO_REF_UNREGISTERED', {
                  participant: participant.displayName,
                  key: screenKey
                });
              }
            }}
            autoPlay
            muted={true}
            playsInline
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#000000',
              borderRadius: isScreenSharing ? '0' : (isMainStage ? '10px' : '6px'),
              zIndex: 1
            }}
            />
          )}
        </div>
        
        {/* Connection Status Indicator */}
        {liveKitParticipant && (() => {
          const q = liveKitParticipant.connectionQuality;
          // connectionQuality is a number between 0 and 1
          const backgroundColor = 
            q > 0.7 ? '#10b981' : 
            q > 0.3 ? '#f59e0b' : 
            '#ef4444';
          
          return (
            <div
              style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                width: '8px',
                height: '8px',
                backgroundColor,
                borderRadius: '50%',
                border: '2px solid white'
              }}
              title={`Connection Quality: ${Math.round(q * 100)}%`}
            />
          );
        })()}
        
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
        
        {/* Hand Raise Indicator - Visible to ALL users */}
        {participant.hasHandRaised && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              animation: 'bounce 1s infinite',
              zIndex: 10
            }}
          >
            ✋
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

  // Wrapper function for rendering participant tiles
  const renderParticipantVideo = (participant: Participant, isMainStage: boolean = false) => {
    return (
      <ParticipantTile
        participant={participant}
        isMainStage={isMainStage}
        activeSpeaker={activeSpeaker}
        screenShareMode={screenShareMode}
        screenShareParticipant={screenShareParticipant}
        localParticipant={localParticipant}
        liveKitParticipants={liveKitParticipants}
        liveKitService={liveKitService}
        onParticipantClick={onParticipantClick}
        onHandRaiseClick={onHandRaiseClick}
        onKickParticipant={onKickParticipant}
        isHost={isHost}
        logVideoSwitch={logVideoSwitch}
        videoRefs={videoRefs}
        screenVideoRefs={screenVideoRefs}
        trackRefs={trackRefs}
        screenTrackRefs={screenTrackRefs}
        retryIntervals={retryIntervals}
        participants={participants}
      />
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
                               gridParticipants.length === 1 ? '1fr' :
                               gridParticipants.length === 2 ? '1fr 1fr' :
                               gridParticipants.length === 3 ? '1fr 1fr 1fr' :
                               gridParticipants.length === 4 ? '1fr 1fr 1fr 1fr' :
                               gridParticipants.length <= 6 ? '1fr 1fr 1fr' :
                               gridParticipants.length <= 9 ? '1fr 1fr 1fr' :
                               '1fr 1fr 1fr 1fr',
          gridTemplateRows: viewMode === 'speaker' ? '1fr' :
                           gridParticipants.length <= 4 ? '1fr' :
                           gridParticipants.length <= 6 ? '1fr 1fr' :
                           gridParticipants.length <= 9 ? '1fr 1fr 1fr' :
                           '1fr 1fr 1fr 1fr',
          gap: (viewMode === 'speaker' || screenShareMode) ? '0' : '12px',
          padding: (viewMode === 'speaker' || screenShareMode) ? '0' : '8px',
          backgroundColor: screenShareMode ? '#000000' : (viewMode === 'speaker' ? 'transparent' : '#f8fafc'),
          borderRadius: (viewMode === 'speaker' || screenShareMode) ? '0' : '12px',
          boxShadow: (viewMode === 'speaker' || screenShareMode) ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        {gridParticipants.map((participant, index) => {
          const stableKey = (participant as any).user_id || participant._id || participant.identity;
          return (
          <div
            key={stableKey}
            style={{
              position: 'relative',
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
          );
        })}
      </div>
      
      {/* Thumbnail Participants (for speaker view) */}
      {thumbnailParticipants.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            justifyContent: 'center',
            marginTop: '12px',
            maxHeight: '120px',
            overflowY: 'auto'
          }}
        >
          {thumbnailParticipants.slice(0, maxThumbnails).map((participant) => {
            const stableKey = (participant as any).user_id || participant._id || participant.identity;
            return (
            <div
              key={stableKey}
              style={{
                width: '80px',
                height: '60px',
                borderRadius: '6px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: '2px solid #e5e7eb',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onClick={() => onParticipantClick?.(participant)}
            >
              {renderParticipantVideo(participant, false)}
            </div>
            );
          })}
        </div>
      )}
      
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
        👥 {uniqueParticipants.length} participants
        {activeSpeaker && (
          <span style={{ color: '#10b981', marginLeft: '8px' }}>
            • 🎤 {activeSpeaker.displayName}
          </span>
        )}
        {uniqueParticipants.filter(p => p.hasHandRaised).length > 0 && (
          <span style={{ color: '#f59e0b', marginLeft: '8px' }}>
            • ✋ {uniqueParticipants.filter(p => p.hasHandRaised).length} raised
          </span>
        )}
        {isLiveKitConnected && (
          <span style={{ color: '#3b82f6', marginLeft: '8px' }}>
            • 🎥 LiveKit Connected
          </span>
        )}
      </div>

      {/* Screen Share Controls */}
      {isHost && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            display: 'flex',
            gap: '8px',
            zIndex: 10
          }}
        >
          <button
            onClick={startScreenShare}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Start Screen Share"
          >
            📺 Share Screen
          </button>
          <button
            onClick={stopScreenShare}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Stop Screen Share"
          >
            🛑 Stop Share
          </button>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
          60% { transform: translateY(-2px); }
        }
        
        /* Mobile screen share layout */
        @media (max-width: 768px) {
          .screen-share-container {
            position: relative;
            width: 100%;
            height: 100%;
          }
          
          .screen-share-video {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            background-color: #000000;
            z-index: 1;
          }
          
          .camera-pip {
            position: absolute;
            bottom: 16px;
            right: 16px;
            width: 120px;
            height: 90px;
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid #3b82f6;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 2;
          }
          
          .camera-pip video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }
      `}</style>
    </div>
  );
};

export default LiveKitParticipantQueue;
