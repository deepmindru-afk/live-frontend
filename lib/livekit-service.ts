import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, LocalParticipant, ConnectionState, RoomOptions, VideoPresets } from 'livekit-client';
import { apolloClient } from '../apollo/client';
import { CREATE_LIVEKIT_TOKEN } from '../apollo/livekit/mutations';

export interface LiveKitConnectionOptions {
  roomName: string;
  participantName: string;
  identity?: string; // ✅ Unique user identity for LiveKit
  meetingRole: 'HOST' | 'CO_HOST' | 'PRESENTER' | 'PARTICIPANT' | 'VIEWER';
  enableCamera?: boolean;
  enableMicrophone?: boolean;
  enableScreenShare?: boolean;
}

export interface LiveKitParticipant {
  identity: string;
  name: string;
  isMuted: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  connectionQuality: number;
}

export interface LiveKitRoomState {
  isConnected: boolean;
  connectionState: ConnectionState;
  participants: Map<string, LiveKitParticipant>;
  localParticipant: LiveKitParticipant | null;
  isMuted: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  error: string | null;
  serverNumber?: number; // Server number (1 or 2)
}

export class LiveKitService {
  private _room: Room | null = null;
  private isUpdatingState: boolean = false;
  private isHandlingEvent: boolean = false;
  private lastConnectionState: ConnectionState | null = null;
  private roomListenersSetup: boolean = false;
  private roomState: LiveKitRoomState = {
    isConnected: false,
    connectionState: ConnectionState.Disconnected,
    participants: new Map(),
    localParticipant: null,
    isMuted: false,
    isCameraEnabled: false,
    isScreenSharing: false,
    error: null,
    serverNumber: undefined,
  };

  private eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.addEventListener('participantConnected', this.handleParticipantConnected.bind(this));
    this.addEventListener('participantDisconnected', this.handleParticipantDisconnected.bind(this));
    this.addEventListener('trackSubscribed', this.handleTrackSubscribed.bind(this));
    this.addEventListener('trackUnsubscribed', this.handleTrackUnsubscribed.bind(this));
    this.addEventListener('connectionStateChanged', this.handleConnectionStateChanged.bind(this));
    this.addEventListener('trackMuted', this.handleTrackMuted.bind(this));
    this.addEventListener('trackUnmuted', this.handleTrackUnmuted.bind(this));
    this.addEventListener('participantMetadataChanged', this.handleParticipantMetadataChanged.bind(this));
  }

  async connect(options: LiveKitConnectionOptions): Promise<void> {
    try {

      // Get LiveKit token from backend
      const tokenResponse = await this.getLiveKitToken(options);
      
      // Store server number in state
      if (tokenResponse.serverNumber) {
        this.updateRoomState({ serverNumber: tokenResponse.serverNumber });
      }

      // Create room instance with safe, validated video encoding configuration
      // FIX: Prevent "scaleResolutionDownBy non-finite value" error in RTCPeerConnection.addTransceiver
      // This error occurs when VideoPresets or browser calculations produce NaN/Infinity values
      this._room = new Room({
        adaptiveStream: true,
        dynacast: true,
        
        // 중요 수정: 더 빠른 화면 공유 표시를 위해 자동 트랙 구독 활성화
        // 게시된 트랙을 자동 구독하여 10초 지연 감소
        defaultSubscribeToTracks: true,
        
        // Explicit video capture settings for 360p quality
        videoCaptureDefaults: {
          resolution: {
            width: 640,  // 360p capture for grid mode
            height: 360,
            frameRate: 30,
          },
        },
        
        publishDefaults: {
          // Explicit video encoding parameters for 360p quality
          videoEncoding: {
            maxBitrate: 1_000_000,  // Lower bitrate for 360p
            maxFramerate: 30,
          },
          
          // ✅ Simulcast enabled for grid mode optimization
          // Layer 1: 360p (for grid view)
          simulcast: true,
          videoSimulcastLayers: [
            VideoPresets.h360,  // 360p (640x360) - Primary quality for grid mode
          ],
        },
      });

      // Set up room event listeners
      this.setupRoomEventListeners();

      // Connect to room

      await this._room.connect(tokenResponse.wsUrl, tokenResponse.token);
      

      // Initialize local participant
      const localParticipant = this._room.localParticipant;
      const localParticipantData: LiveKitParticipant = {
        identity: localParticipant.identity,
        name: localParticipant.name || options.participantName,
        isMuted: localParticipant.isMicrophoneEnabled === false,
        isCameraEnabled: localParticipant.isCameraEnabled,
        isScreenSharing: localParticipant.isScreenShareEnabled,
        isSpeaking: localParticipant.isSpeaking,
        connectionQuality: Number(localParticipant.connectionQuality) || 0,
      };
      this.roomState.localParticipant = localParticipantData;

      // Enable media tracks

      if (options.enableCamera !== false) {
        // Enabling camera
        await this.enableCamera();
        // Camera enabled successfully
      } else {
        // Camera disabled by options
      }

      if (options.enableMicrophone !== false) {
        try {
          await this.enableMicrophone();
        } catch (micError: any) {
          // Don't throw - allow connection to continue without microphone
          // User can try to enable it later via UI
        }
      } else {
      }
      
      // DIAGNOSTIC: Verify all tracks after a short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      const allVideoTracks = Array.from(this._room.localParticipant.videoTrackPublications.values());
      const allAudioTracks = Array.from(this._room.localParticipant.audioTrackPublications.values());
      
      
      if (options.enableCamera !== false && allVideoTracks.length === 0) {
      }
      
      if (options.enableMicrophone !== false && allAudioTracks.length === 0) {
      }

      // CRITICAL FIX: Add local participant to participants map
      
      if (this._room?.localParticipant) {
        
        // CRITICAL FIX: Validate local participant before adding
        if (this._room.localParticipant.identity) {
          const localLiveKitParticipant: LiveKitParticipant = {
            identity: this._room.localParticipant.identity,
            name: this._room.localParticipant.name || this._room.localParticipant.identity,
            isMuted: this._room.localParticipant.isMicrophoneEnabled === false,
            isCameraEnabled: this._room.localParticipant.isCameraEnabled,
            isScreenSharing: this._room.localParticipant.isScreenShareEnabled,
            isSpeaking: this._room.localParticipant.isSpeaking,
            connectionQuality: Number(this._room.localParticipant.connectionQuality) || 0,
          };
          
          this.roomState.participants.set(this._room.localParticipant.identity, localLiveKitParticipant);
          // Local participant added to service state
        } else {
          // Local participant has no identity
        }
      }

      this.updateRoomState({ isConnected: true });
      this.emit('connected', { room: this.room, options });

    } catch (error: any) {
      this.updateRoomState({ error: error.message });
      this.emit('error', error);
      throw error;
    }
  }

  private async getLiveKitToken(options: LiveKitConnectionOptions): Promise<{ wsUrl: string; token: string; serverNumber?: number }> {
    try {
      
      const { data } = await apolloClient.mutate({
        mutation: CREATE_LIVEKIT_TOKEN,
        variables: {
          meetingId: options.roomName,
          identity: options.identity, // ✅ Pass unique identity to token generation
        },
      });

      const responseData = data as any;

      if (!responseData?.createLivekitToken) {
        throw new Error('Failed to get LiveKit token - no token in response');
      }

      const parsed = JSON.parse(responseData.createLivekitToken);

      return parsed;
    } catch (error: any) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  private setupRoomEventListeners() {
    if (!this._room || this.roomListenersSetup) return;
    
    this.roomListenersSetup = true;

    this._room.on(RoomEvent.Connected, () => {
      
      this.updateRoomState({ isConnected: true, connectionState: ConnectionState.Connected });
      this.emit('roomConnected', { room: this.room });
    });

    this._room.on(RoomEvent.Disconnected, (reason) => {
      this.updateRoomState({ 
        isConnected: false, 
        connectionState: ConnectionState.Disconnected,
        error: String(reason) || 'Connection lost'
      });
      this.emit('roomDisconnected', { reason });
    });

    this._room.on(RoomEvent.ParticipantConnected, (participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        return;
      }
      this.handleParticipantConnected(participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        return;
      }
      this.handleParticipantDisconnected(participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        return;
      }
      this.handleTrackSubscribed(track, publication, participant);
    });

    this._room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        return;
      }
      this.handleTrackUnsubscribed(track, publication, participant);
    });

    this._room.on(RoomEvent.ConnectionStateChanged, (state) => {
      this.handleConnectionStateChanged(state);
    });

    this._room.on(RoomEvent.TrackMuted, (publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        return;
      }
      this.handleTrackMuted(publication, participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant) {
        return;
      }
      
      this.handleTrackUnmuted(publication, participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.ParticipantMetadataChanged, (metadata, participant) => {
      this.handleParticipantMetadataChanged(metadata || '', participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.TrackPublished, async (publication, participant) => {
      // 중요 수정: 게시되면 즉시 화면 공유 트랙 자동 구독
      // 트랙이 사용 가능해지는 즉시 구독하여 10초 지연 감소
      if (publication.kind === 'video' && publication.source === Track.Source.ScreenShare) {
        try {
          // 원격 참가자의 경우 트랙을 명시적으로 구독
          if (participant instanceof RemoteParticipant && !publication.isSubscribed) {
            await publication.setSubscribed(true);
          }
        } catch (err) {
          console.warn('[LiveKitService] 화면 공유 트랙 자동 구독 실패:', err);
        }
      }
      
      this.emit('trackPublished', { publication, participant });
    });

    this._room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      this.emit('trackUnpublished', { publication, participant });
    });

    this._room.on(RoomEvent.DataReceived, (payload, participant) => {
      this.emit('dataReceived', { payload, participant });
    });
  }

  private handleParticipantConnected(participant: RemoteParticipant | LocalParticipant) {
    // CRITICAL FIX: Validate participant before processing
    if (!participant || !participant.identity) {
      return;
    }


    const liveKitParticipant: LiveKitParticipant = {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isMuted: participant.isMicrophoneEnabled === false,
      isCameraEnabled: participant.isCameraEnabled,
      isScreenSharing: participant.isScreenShareEnabled,
      isSpeaking: participant.isSpeaking,
      connectionQuality: Number(participant.connectionQuality) || 0,
    };


    // CRITICAL FIX: Only add valid participants to the map
    if (liveKitParticipant.identity && liveKitParticipant.name) {
      this.roomState.participants.set(participant.identity, liveKitParticipant);

      this.updateRoomState({});
      this.emit('participantConnected', { participant: liveKitParticipant });
    } else {
    }
  }

  private handleParticipantDisconnected(participant: RemoteParticipant | LocalParticipant) {
    this.roomState.participants.delete(participant.identity || 'unknown');
    this.updateRoomState({});
    this.emit('participantDisconnected', { participant: participant.identity || 'unknown' });
  }

  private isHandlingTrackSubscribed = false;
  private isHandlingTrackUnsubscribed = false;

  private handleTrackSubscribed(track: RemoteTrack, publication: any, participant: RemoteParticipant) {
    if (this.isHandlingTrackSubscribed) {
      return; // Prevent infinite recursion
    }
    
    // CRITICAL FIX: Prevent local audio echo - don't play back local mic audio to self
    // Check if this is the local participant by comparing with room's localParticipant
    const isLocalParticipant = this._room?.localParticipant && 
      (participant.identity === this._room.localParticipant.identity || 
       participant.sid === this._room.localParticipant.sid);
    
    if (isLocalParticipant && track.kind === 'audio') {
      return; // Don't process local audio tracks to prevent echo
    }
    
    try {
      this.isHandlingTrackSubscribed = true;
      this.emit('trackSubscribed', { track, publication, participant });
    } finally {
      this.isHandlingTrackSubscribed = false;
    }
  }

  private handleTrackUnsubscribed(track: RemoteTrack, publication: any, participant: RemoteParticipant) {
    if (this.isHandlingTrackUnsubscribed) {
      return; // Prevent infinite recursion
    }
    
    try {
      this.isHandlingTrackUnsubscribed = true;
      this.emit('trackUnsubscribed', { track, publication, participant });
    } finally {
      this.isHandlingTrackUnsubscribed = false;
    }
  }

  private handleConnectionStateChanged(state: ConnectionState) {
    // Prevent infinite recursion - only handle if state actually changed
    if (this.isHandlingEvent || this.lastConnectionState === state) {
      return;
    }
    
    try {
      this.isHandlingEvent = true;
      this.lastConnectionState = state;
      this.updateRoomState({ connectionState: state });
      this.emit('connectionStateChanged', { state });
    } finally {
      this.isHandlingEvent = false;
    }
  }

  private handleTrackMuted(publication: any, participant: RemoteParticipant | LocalParticipant) {
    const participantId = participant.identity;
    const participantData = this.roomState.participants.get(participantId);
    
    if (participantData) {
      if (publication.kind === Track.Kind.Audio) {
        participantData.isMuted = true;
      } else if (publication.kind === Track.Kind.Video) {
        participantData.isCameraEnabled = false;
      }
      
      this.roomState.participants.set(participantId, participantData);
      this.updateRoomState({});
    }

    // Update local participant state
    if (participant === this._room?.localParticipant) {
      if (publication.kind === Track.Kind.Audio) {
        this.updateRoomState({ isMuted: true });
      } else if (publication.kind === Track.Kind.Video) {
        this.updateRoomState({ isCameraEnabled: false });
      }
    }

    this.emit('trackMuted', { publication, participant });
  }

  private handleTrackUnmuted(publication: any, participant: RemoteParticipant | LocalParticipant) {
    // CRITICAL FIX: Add null checks for participant to prevent "cannot read properties of undefined" errors
    if (!participant) {
      return;
    }

    if (!participant.identity) {
      return;
    }

    const participantId = participant.identity;
    const participantData = this.roomState.participants.get(participantId);
    
    
    if (participantData) {
      if (publication.kind === Track.Kind.Audio) {
        participantData.isMuted = false;
      } else if (publication.kind === Track.Kind.Video) {
        participantData.isCameraEnabled = true;
      }
      
      this.roomState.participants.set(participantId, participantData);
      this.updateRoomState({});
    }

    // Update local participant state
    if (participant === this._room?.localParticipant) {
      if (publication.kind === Track.Kind.Audio) {
        this.updateRoomState({ isMuted: false });
      } else if (publication.kind === Track.Kind.Video) {
        this.updateRoomState({ isCameraEnabled: true });
      }
    }

    this.emit('trackUnmuted', { publication, participant });
  }

  private handleParticipantMetadataChanged(metadata: string, participant: RemoteParticipant | LocalParticipant) {
    this.emit('participantMetadataChanged', { metadata, participant });
  }

  async disconnect(): Promise<void> {
    if (this._room) {
      await this._room.disconnect();
      this._room = null;
      this.roomListenersSetup = false;
      this.lastConnectionState = null;
      
      // Reset all recursion guards
      this.isUpdatingState = false;
      this.isHandlingEvent = false;
      this.isHandlingTrackSubscribed = false;
      this.isHandlingTrackUnsubscribed = false;
      this.emitDepth = 0;
      
      this.updateRoomState({ 
        isConnected: false, 
        connectionState: ConnectionState.Disconnected,
        participants: new Map(),
        localParticipant: null
      });
      this.emit('disconnected', {});
    }
  }

  async enableCamera(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      
      // FIX: Use explicit, finite video constraints to prevent "scaleResolutionDownBy non-finite" error
      const safeVideoConstraints = {
        resolution: {
          width: 1280,
          height: 720,
          frameRate: 30,
        },
      };
      
      // Validate constraints before passing to LiveKit SDK
      if (!Number.isFinite(safeVideoConstraints.resolution.width) || 
          !Number.isFinite(safeVideoConstraints.resolution.height) ||
          safeVideoConstraints.resolution.width <= 0 ||
          safeVideoConstraints.resolution.height <= 0) {
        throw new Error('Invalid video resolution constraints');
      }
      
      // Try to enable camera with constraints
      try {
        await this._room.localParticipant.setCameraEnabled(true, safeVideoConstraints);
      } catch (cameraError: any) {
        // Try without constraints as fallback
        try {
          await this._room.localParticipant.setCameraEnabled(true);
        } catch (fallbackError) {
          throw fallbackError;
        }
      }
      
      // Read the actual state from LiveKit SDK after enable
      const actualCameraEnabled = this._room.localParticipant.isCameraEnabled;
      
      // Update state with actual value from SDK
      this.updateRoomState({ isCameraEnabled: actualCameraEnabled });
      
    } catch (error: any) {
      
      // Check if it's the specific WebRTC encoding error
      if (error?.message && error.message.includes('scaleResolutionDownBy')) {
      }
      
      throw error;
    }
  }

  async disableCamera(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      
      // Gracefully disable camera without stopping the entire stream
      await this._room.localParticipant.setCameraEnabled(false);
      
      // Read the actual state from LiveKit SDK after disable
      const actualCameraEnabled = this._room.localParticipant.isCameraEnabled;
      
      // Update state with actual value from SDK
      this.updateRoomState({ isCameraEnabled: actualCameraEnabled });
      
      
    } catch (error) {
      
      // Read the actual state even if disable fails
      const actualCameraEnabled = this._room?.localParticipant?.isCameraEnabled ?? false;
      this.updateRoomState({ isCameraEnabled: actualCameraEnabled });
      
      // Don't rethrow the error to prevent stream interruption
    }
  }

  async enableMicrophone(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      
      // Check microphone permissions first
      try {
        // Mobile browser compatibility check
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices not supported in this browser');
        }

        // Production environment check
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          // Additional production checks
          if (!window.isSecureContext && location.protocol !== 'https:') {
            throw new Error('Microphone access requires HTTPS in production');
          }
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        
        if (audioDevices.length === 0) {
          throw new Error('No microphone devices found');
        }
        
        // Test microphone access with mobile-optimized constraints
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // Mobile-specific constraints
            sampleRate: 44100,
            channelCount: 1
          } 
        });
        stream.getTracks().forEach(track => {
          track.stop(); // Stop test stream
        });
      } catch (permError: any) {
        
        // Throw specific error for better user feedback
        if (permError.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied. Please allow microphone access in your browser settings and refresh the page.');
        } else if (permError.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone device.');
        } else if (permError.name === 'NotReadableError') {
          throw new Error('Microphone is already in use by another application. Please close other apps using your microphone.');
        } else if (permError.name === 'NotSupportedError') {
          throw new Error('Microphone not supported on this device. Please use a different browser or device.');
        } else if (permError.name === 'SecurityError') {
          throw new Error('Microphone access blocked for security reasons. Please use HTTPS or localhost.');
        } else {
          throw new Error(`Microphone access failed: ${permError.message}`);
        }
      }
      
      await this._room.localParticipant.setMicrophoneEnabled(true);
      
      // Wait for track to be published
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify audio track was actually published
      const audioTracks = Array.from(this._room.localParticipant.audioTrackPublications.values());
      
      if (audioTracks.length === 0) {
        // Retry once
        await this._room.localParticipant.setMicrophoneEnabled(false);
        await new Promise(resolve => setTimeout(resolve, 300));
        await this._room.localParticipant.setMicrophoneEnabled(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const retryAudioTracks = Array.from(this._room.localParticipant.audioTrackPublications.values());
        if (retryAudioTracks.length === 0) {
          throw new Error('Failed to publish audio track. Please check your microphone settings and try again.');
        }
      } else {
      }
      
      this.updateRoomState({ isMuted: false });
    } catch (error: any) {
      this.updateRoomState({ isMuted: true });
      throw error;
    }
  }

  async disableMicrophone(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      
      // Gracefully disable microphone without stopping the entire stream
      await this._room.localParticipant.setMicrophoneEnabled(false);
      
      // Update state after successful disable
      this.updateRoomState({ isMuted: true });
      
    } catch (error) {
      
      // Even if disable fails, don't stop the entire stream
      // Just update the state to reflect the intended state
      this.updateRoomState({ isMuted: true });
      
      // Don't rethrow the error to prevent stream interruption
    }
  }

  async startScreenShare(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      
      // Check if screen sharing is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser');
      }
      
      // ✅ MOBILE FIX: Check for mobile devices and provide better error handling
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // ✅ MOBILE FIX: On mobile, screen sharing might have limitations
      // Use LiveKit's built-in screen share which handles mobile better
      try {
        await this._room.localParticipant.setScreenShareEnabled(true);
        this.updateRoomState({ isScreenSharing: true });
      } catch (screenShareError: any) {
        // ✅ MOBILE FIX: Better error handling for mobile devices
        if (isMobile && screenShareError.message?.includes('getDisplayMedia')) {
          throw new Error('Screen sharing on mobile requires a user gesture. Please tap the screen share button again.');
        }
        throw screenShareError;
      }
    } catch (error: any) {
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Screen sharing permission denied. Please allow screen sharing when prompted.');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Screen sharing is not supported in this browser or tab.');
      } else if (error.name === 'AbortError') {
        throw new Error('Screen sharing was cancelled by the user.');
      } else {
        throw new Error(`Screen sharing failed: ${error.message || 'Unknown error'}`);
      }
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      
      // ✅ FIX: Properly stop screen share by unpublishing all screen share tracks first
      // This prevents the RTCPeerConnection.removeTrack error
      const screenSharePublications = Array.from(this._room.localParticipant.videoTrackPublications.values())
        .filter(pub => {
          const source = pub.source || pub.track?.source;
          return source === Track.Source.ScreenShare;
        });
      
      // ✅ FIX: Unpublish all screen share tracks before disabling
      // This ensures proper cleanup and prevents WebRTC errors
      for (const pub of screenSharePublications) {
        if (pub.track) {
          try {
            // Use unpublishTrack instead of manual removeTrack to avoid WebRTC errors
            await this._room.localParticipant.unpublishTrack(pub.track);
          } catch (unpublishError: any) {
            // Log but continue - track might already be unpublished
            console.warn('[LiveKitService] Error unpublishing screen share track:', unpublishError);
          }
        }
      }
      
      // Wait a bit for tracks to be properly cleaned up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now disable screen share using LiveKit's method
      await this._room.localParticipant.setScreenShareEnabled(false);
      
      // Update state after successful stop
      this.updateRoomState({ isScreenSharing: false });
      
    } catch (error: any) {
      
      // Even if stop fails, don't stop the entire stream
      // Just update the state to reflect the intended state
      this.updateRoomState({ isScreenSharing: false });
      
      // ✅ FIX: Don't rethrow the error to prevent stream interruption
      // The state is already updated, so UI will reflect the change
    }
  }

  async sendData(data: Uint8Array, topic?: string): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      await this._room.localParticipant.publishData(data, { topic });
    } catch (error) {
      throw error;
    }
  }

  // Event system
  addEventListener(event: string, callback: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitDepth = 0;
  private readonly MAX_EMIT_DEPTH = 10;

  private emit(event: string, data: any): void {
    // Prevent infinite recursion in emit
    if (this.emitDepth >= this.MAX_EMIT_DEPTH) {
      return;
    }

    const listeners = this.eventListeners.get(event);
    if (listeners) {
      this.emitDepth++;
      try {
        // Create a copy of listeners to prevent modification during iteration
        const listenersCopy = [...listeners];
        listenersCopy.forEach(callback => {
          try {
            callback(data);
          } catch (error: any) {
            // Simplified error logging to prevent recursion
            if (error && typeof error.message === 'string') {
            }
          }
        });
      } finally {
        this.emitDepth--;
      }
    }
  }

  private updateRoomState(updates: Partial<LiveKitRoomState>): void {
    // Prevent infinite recursion
    if (this.isUpdatingState) {
      return;
    }
    
    try {
      this.isUpdatingState = true;
      this.roomState = { ...this.roomState, ...updates };
      this.emit('roomStateChanged', this.roomState);
    } finally {
      this.isUpdatingState = false;
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.roomState.isConnected;
  }

  get connectionState(): ConnectionState {
    return this.roomState.connectionState;
  }

  get participants(): Map<string, LiveKitParticipant> {
    return this.roomState.participants;
  }

  get localParticipant(): LiveKitParticipant | null {
    return this.roomState.localParticipant;
  }

  get isMuted(): boolean {
    return this.roomState.isMuted;
  }

  get isCameraEnabled(): boolean {
    return this.roomState.isCameraEnabled;
  }

  get isScreenSharing(): boolean {
    return this.roomState.isScreenSharing;
  }

  get error(): string | null {
    return this.roomState.error;
  }

  get room(): Room | null {
    return this._room;
  }

  get state(): LiveKitRoomState {
    return this.roomState;
  }

  get serverNumber(): number | undefined {
    return this.roomState.serverNumber;
  }
}

export default LiveKitService;
