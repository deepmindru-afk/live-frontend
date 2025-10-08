import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, LocalParticipant, ConnectionState, RoomOptions } from 'livekit-client';
import { apolloClient } from '../apollo/client';
import { CREATE_LIVEKIT_TOKEN } from '../apollo/livekit/mutations';

export interface LiveKitConnectionOptions {
  roomName: string;
  participantName: string;
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
      console.log('🔌 LiveKit: Starting connection...', options);

      // Get LiveKit token from backend
      const tokenResponse = await this.getLiveKitToken(options);
      console.log('🎫 LiveKit: Token received', { hasToken: !!tokenResponse.token });

      // Create room instance with safe, validated video encoding configuration
      // FIX: Prevent "scaleResolutionDownBy non-finite value" error in RTCPeerConnection.addTransceiver
      // This error occurs when VideoPresets or browser calculations produce NaN/Infinity values
      this._room = new Room({
        adaptiveStream: true,
        dynacast: true,
        
        // Explicit video capture settings to prevent invalid calculations
        videoCaptureDefaults: {
          resolution: {
            width: 1280,  // Explicit width instead of preset to avoid calculation errors
            height: 720,
            frameRate: 30,
          },
        },
        
        publishDefaults: {
          // Explicit video encoding parameters - no simulcast to avoid scale calculation errors
          videoEncoding: {
            maxBitrate: 1_500_000,
            maxFramerate: 30,
          },
          
          // CRITICAL FIX: Do NOT use videoSimulcastLayers to avoid scaleResolutionDownBy calculation
          // LiveKit SDK can calculate invalid scale values from VideoPresets causing WebRTC to fail
          // Instead, let the server handle adaptive streaming without client-side simulcast
          // If simulcast is needed, it will be configured server-side with validated parameters
        },
      });

      // Set up room event listeners
      this.setupRoomEventListeners();

      // Connect to room
      console.log('🔗 LiveKit: Connecting to room...', {
        wsUrl: tokenResponse.wsUrl,
        roomName: options.roomName,
        hasToken: !!tokenResponse.token,
        tokenType: typeof tokenResponse.token,
        tokenPreview: tokenResponse.token.substring(0, 50) + '...'
      });

      await this._room.connect(tokenResponse.wsUrl, tokenResponse.token);
      
      console.log('✅ LiveKit: Connected to room successfully', {
        roomName: this._room.name,
        roomState: this._room.state,
        localParticipant: this._room.localParticipant?.identity
      });
      console.log('✅ LiveKit: Connected to room');
      console.log('🔍 [LIVEKIT_SERVICE] Connection completed - checking room state:', {
        hasRoom: !!this._room,
        roomName: this._room?.name,
        numParticipants: this._room?.numParticipants || 0,
        hasLocalParticipant: !!this._room?.localParticipant,
        localParticipantIdentity: this._room?.localParticipant?.identity,
        localParticipantName: this._room?.localParticipant?.name,
        roomState: {
          isConnected: this.roomState.isConnected,
          participantsSize: this.roomState.participants.size,
          participantsKeys: Array.from(this.roomState.participants.keys())
        }
      });

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
      console.log('🎬 LiveKit: Checking initial media settings...', {
        enableCamera: options.enableCamera,
        enableMicrophone: options.enableMicrophone,
        enableScreenShare: options.enableScreenShare
      });

      if (options.enableCamera !== false) {
        console.log('📹 LiveKit: Camera was requested on connect - enabling...');
        await this.enableCamera();
      } else {
        console.log('📹 LiveKit: Camera disabled on connect');
      }

      if (options.enableMicrophone !== false) {
        console.log('🎤 LiveKit: Microphone was requested on connect - enabling...');
        await this.enableMicrophone();
      } else {
        console.log('🎤 LiveKit: Microphone disabled on connect');
      }

      // CRITICAL FIX: Add local participant to participants map
      console.log('🔍 [LIVEKIT_SERVICE] Checking room state after connection:', {
        hasRoom: !!this._room,
        hasLocalParticipant: !!this._room?.localParticipant,
        localParticipantIdentity: this._room?.localParticipant?.identity,
        numParticipants: this._room?.numParticipants || 0
      });
      
      if (this._room?.localParticipant) {
        console.log('🔍 [LIVEKIT_SERVICE] Adding local participant to participants map:', {
          identity: this._room.localParticipant.identity,
          name: this._room.localParticipant.name,
          isLocal: true
        });
        
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
          console.log('🔍 [LIVEKIT_SERVICE] Local participant added to map:', {
            size: this.roomState.participants.size,
            keys: Array.from(this.roomState.participants.keys())
          });
        } else {
          console.warn('⚠️ [LIVEKIT_SERVICE] Local participant missing identity, skipping addition');
        }
      }

      this.updateRoomState({ isConnected: true });
      console.log('✅ LiveKit: Room state updated to connected');
      this.emit('connected', { room: this.room, options });
      console.log('✅ LiveKit: Connected event emitted');

    } catch (error: any) {
      console.error('❌ LiveKit: Connection failed', error);
      this.updateRoomState({ error: error.message });
      this.emit('error', error);
      throw error;
    }
  }

  private async getLiveKitToken(options: LiveKitConnectionOptions): Promise<{ wsUrl: string; token: string }> {
    try {
      console.log('🎫 LiveKit: Requesting token for room:', options.roomName);
      
      const { data } = await apolloClient.mutate({
        mutation: CREATE_LIVEKIT_TOKEN,
        variables: {
          meetingId: options.roomName,
        },
      });

      const responseData = data as any;
      console.log('🎫 LiveKit: Received token response:', {
        hasData: !!data,
        hasToken: !!responseData?.createLivekitToken,
        tokenType: typeof responseData?.createLivekitToken,
        tokenRaw: responseData?.createLivekitToken
      });

      if (!responseData?.createLivekitToken) {
        throw new Error('Failed to get LiveKit token - no token in response');
      }

      const parsed = JSON.parse(responseData.createLivekitToken);
      console.log('🎫 LiveKit: Parsed token data:', {
        hasWsUrl: !!parsed.wsUrl,
        hasToken: !!parsed.token,
        wsUrl: parsed.wsUrl,
        tokenType: typeof parsed.token
      });

      return parsed;
    } catch (error: any) {
      console.error('❌ LiveKit: Token generation failed', error);
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  private setupRoomEventListeners() {
    if (!this._room || this.roomListenersSetup) return;
    
    this.roomListenersSetup = true;

    this._room.on(RoomEvent.Connected, () => {
      console.log('✅ LiveKit: RoomEvent.Connected fired!');
      console.log('🔍 [LIVEKIT_SERVICE] Room object structure after connection:', {
        hasRoom: !!this._room,
        roomName: this._room?.name,
        numParticipants: this._room?.numParticipants || 0,
        hasLocalParticipant: !!this._room?.localParticipant,
        localParticipantIdentity: this._room?.localParticipant?.identity,
        roomKeys: this._room ? Object.keys(this._room) : [],
        roomPrototype: this._room ? Object.getPrototypeOf(this._room) : null
      });
      
      console.log('🔍 [LIVEKIT_SERVICE] About to update room state...');
      this.updateRoomState({ isConnected: true, connectionState: ConnectionState.Connected });
      console.log('🔍 [LIVEKIT_SERVICE] Room state updated, emitting roomConnected event...');
      this.emit('roomConnected', { room: this.room });
      console.log('🔍 [LIVEKIT_SERVICE] roomConnected event emitted');
    });

    this._room.on(RoomEvent.Disconnected, (reason) => {
      console.log('🔌 LiveKit: Room disconnected', reason);
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
        console.warn('⚠️ LiveKit: ParticipantConnected event received with invalid participant');
        return;
      }
      console.log('👤 LiveKit: ParticipantConnected event fired:', {
        participantIdentity: participant.identity,
        participantName: participant.name,
        isLocal: participant.isLocal,
        roomName: this._room?.name || 'unknown',
        currentParticipantsCount: this._room?.numParticipants || 0,
        hasRoom: !!this._room,
        roomType: typeof this._room
      });
      this.handleParticipantConnected(participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        console.warn('⚠️ LiveKit: ParticipantDisconnected event received with invalid participant');
        return;
      }
      console.log('👋 LiveKit: Participant disconnected', participant.identity);
      this.handleParticipantDisconnected(participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        console.warn('⚠️ LiveKit: TrackSubscribed event received with invalid participant');
        return;
      }
      console.log('🎵 LiveKit: Track subscribed', { track, participant: participant.identity });
      this.handleTrackSubscribed(track, publication, participant);
    });

    this._room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        console.warn('⚠️ LiveKit: TrackUnsubscribed event received with invalid participant');
        return;
      }
      console.log('🔇 LiveKit: Track unsubscribed', { track, participant: participant.identity });
      this.handleTrackUnsubscribed(track, publication, participant);
    });

    this._room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('🔄 LiveKit: Connection state changed', state);
      this.handleConnectionStateChanged(state);
    });

    this._room.on(RoomEvent.TrackMuted, (publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant || !participant.identity) {
        console.warn('⚠️ LiveKit: TrackMuted event received with invalid participant');
        return;
      }
      console.log('🔇 LiveKit: Track muted', { participant: participant.identity, track: publication.kind });
      this.handleTrackMuted(publication, participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      // CRITICAL FIX: Add null checks before accessing participant properties
      if (!participant) {
        console.warn('⚠️ LiveKit: TrackUnmuted event received with undefined participant');
        return;
      }
      
      console.log('🔊 LiveKit: Track unmuted', { 
        participant: participant.identity || 'unknown', 
        track: publication?.kind || 'unknown' 
      });
      this.handleTrackUnmuted(publication, participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.ParticipantMetadataChanged, (metadata, participant) => {
      console.log('📝 LiveKit: Participant metadata changed', { participant: participant.identity || 'unknown', metadata });
      this.handleParticipantMetadataChanged(metadata || '', participant as RemoteParticipant | LocalParticipant);
    });

    this._room.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log('📡 LiveKit: Track published', { participant: participant.identity, track: publication.kind });
      this.emit('trackPublished', { publication, participant });
    });

    this._room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      console.log('📡 LiveKit: Track unpublished', { participant: participant.identity, track: publication.kind });
      this.emit('trackUnpublished', { publication, participant });
    });

    this._room.on(RoomEvent.DataReceived, (payload, participant) => {
      console.log('📨 LiveKit: Data received', { participant: participant?.identity, payload });
      this.emit('dataReceived', { payload, participant });
    });
  }

  private handleParticipantConnected(participant: RemoteParticipant | LocalParticipant) {
    // CRITICAL FIX: Validate participant before processing
    if (!participant || !participant.identity) {
      console.warn('⚠️ [LIVEKIT_SERVICE] handleParticipantConnected: Invalid participant received', {
        participant: participant,
        hasIdentity: !!participant?.identity,
        hasName: !!participant?.name
      });
      return;
    }

    console.log('🔍 [LIVEKIT_SERVICE] handleParticipantConnected called:', {
      participantIdentity: participant.identity,
      participantName: participant.name,
      isLocal: participant.isLocal,
      isMuted: participant.isMicrophoneEnabled === false,
      isCameraEnabled: participant.isCameraEnabled
    });

    const liveKitParticipant: LiveKitParticipant = {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isMuted: participant.isMicrophoneEnabled === false,
      isCameraEnabled: participant.isCameraEnabled,
      isScreenSharing: participant.isScreenShareEnabled,
      isSpeaking: participant.isSpeaking,
      connectionQuality: Number(participant.connectionQuality) || 0,
    };

    console.log('🔍 [LIVEKIT_SERVICE] Created LiveKit participant:', liveKitParticipant);

    // CRITICAL FIX: Only add valid participants to the map
    if (liveKitParticipant.identity && liveKitParticipant.name) {
      this.roomState.participants.set(participant.identity, liveKitParticipant);
      console.log('🔍 [LIVEKIT_SERVICE] Participants map after adding:', {
        size: this.roomState.participants.size,
        keys: Array.from(this.roomState.participants.keys()),
        participants: Array.from(this.roomState.participants.entries()).map(([id, p]) => ({ id, name: p.name }))
      });

      this.updateRoomState({});
      this.emit('participantConnected', { participant: liveKitParticipant });
      console.log('🔍 [LIVEKIT_SERVICE] participantConnected event emitted');
    } else {
      console.warn('⚠️ [LIVEKIT_SERVICE] Skipping participant with missing identity or name:', liveKitParticipant);
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
    
    try {
      this.isHandlingTrackSubscribed = true;
      console.log('🎵 Track subscribed event:', {
        trackKind: track.kind,
        participantIdentity: participant?.identity || 'unknown',
        hasParticipant: !!participant
      });
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
      console.warn('⚠️ LiveKit: handleTrackUnmuted called with undefined participant');
      return;
    }

    if (!participant.identity) {
      console.warn('⚠️ LiveKit: handleTrackUnmuted called with participant missing identity', {
        participant: participant,
        hasIdentity: 'identity' in participant,
        participantKeys: Object.keys(participant)
      });
      return;
    }

    const participantId = participant.identity;
    const participantData = this.roomState.participants.get(participantId);
    
    console.log('🔊 LiveKit: Track unmuted', { 
      participant: participantId, 
      track: publication?.kind || 'unknown',
      hasParticipantData: !!participantData
    });
    
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
      console.log('🔌 LiveKit: Disconnecting...');
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
      console.log('📹 LiveKit: Attempting to enable camera with validated constraints...');
      
      // FIX: Use explicit, finite video constraints to prevent "scaleResolutionDownBy non-finite" error
      // This ensures all values passed to RTCPeerConnection.addTransceiver are valid finite numbers
      const safeVideoConstraints = {
        resolution: {
          width: 1280,   // Explicit finite number - prevents NaN/Infinity calculations
          height: 720,   // Explicit finite number - prevents NaN/Infinity calculations
          frameRate: 30, // Standard frame rate - prevents division by zero
        },
      };
      
      // Validate constraints before passing to LiveKit SDK
      if (!Number.isFinite(safeVideoConstraints.resolution.width) || 
          !Number.isFinite(safeVideoConstraints.resolution.height) ||
          safeVideoConstraints.resolution.width <= 0 ||
          safeVideoConstraints.resolution.height <= 0) {
        throw new Error('Invalid video resolution constraints');
      }
      
      console.log('🎥 LiveKit: Calling setCameraEnabled with constraints:', safeVideoConstraints);
      await this._room.localParticipant.setCameraEnabled(true, safeVideoConstraints);
      
      console.log('🎥 LiveKit: setCameraEnabled completed, checking tracks...');
      const videoTrack = this._room.localParticipant.videoTrackPublications.values().next().value;
      console.log('🎥 LiveKit: Video track after enable:', {
        hasTrack: !!videoTrack,
        trackSid: videoTrack?.trackSid,
        trackKind: videoTrack?.kind,
        isSubscribed: videoTrack?.isSubscribed,
        isMuted: videoTrack?.isMuted
      });
      
      this.updateRoomState({ isCameraEnabled: true });
      console.log('✅ LiveKit: Camera enabled successfully');
    } catch (error: any) {
      console.error('❌ LiveKit: Failed to enable camera', error);
      console.error('❌ Error details:', {
        name: error?.name,
        message: error?.message,
      });
      
      // Check if it's the specific WebRTC encoding error
      if (error?.message && error.message.includes('scaleResolutionDownBy')) {
        console.error('🔍 WebRTC encoding error: scaleResolutionDownBy received non-finite value');
        console.error('🔍 This indicates the browser received NaN, Infinity, or invalid number in RTCRtpEncodingParameters');
        console.error('🔍 Possible causes: VideoPreset calculation errors, invalid track dimensions, or browser bugs');
      }
      
      throw error;
    }
  }

  async disableCamera(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      await this._room.localParticipant.setCameraEnabled(false);
      this.updateRoomState({ isCameraEnabled: false });
      console.log('📹 LiveKit: Camera disabled');
    } catch (error) {
      console.error('❌ LiveKit: Failed to disable camera', error);
      throw error;
    }
  }

  async enableMicrophone(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      await this._room.localParticipant.setMicrophoneEnabled(true);
      this.updateRoomState({ isMuted: false });
      console.log('🎤 LiveKit: Microphone enabled');
    } catch (error) {
      console.error('❌ LiveKit: Failed to enable microphone', error);
      throw error;
    }
  }

  async disableMicrophone(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      await this._room.localParticipant.setMicrophoneEnabled(false);
      this.updateRoomState({ isMuted: true });
      console.log('🎤 LiveKit: Microphone disabled');
    } catch (error) {
      console.error('❌ LiveKit: Failed to disable microphone', error);
      throw error;
    }
  }

  async startScreenShare(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      await this._room.localParticipant.setScreenShareEnabled(true);
      this.updateRoomState({ isScreenSharing: true });
      console.log('🖥️ LiveKit: Screen sharing started');
    } catch (error) {
      console.error('❌ LiveKit: Failed to start screen share', error);
      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      await this._room.localParticipant.setScreenShareEnabled(false);
      this.updateRoomState({ isScreenSharing: false });
      console.log('🖥️ LiveKit: Screen sharing stopped');
    } catch (error) {
      console.error('❌ LiveKit: Failed to stop screen share', error);
      throw error;
    }
  }

  async sendData(data: Uint8Array, topic?: string): Promise<void> {
    if (!this._room) throw new Error('Not connected to room');
    
    try {
      await this._room.localParticipant.publishData(data, { topic });
      console.log('📨 LiveKit: Data sent', { topic });
    } catch (error) {
      console.error('❌ LiveKit: Failed to send data', error);
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
      console.warn(`⚠️ LiveKit: Max emit depth (${this.MAX_EMIT_DEPTH}) reached for event: ${event}`);
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
              console.warn(`⚠️ LiveKit event error: ${event}`, error.message);
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
}

export default LiveKitService;
