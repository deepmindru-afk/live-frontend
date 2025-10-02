import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, LocalParticipant, ConnectionState, RoomOptions, VideoPresets } from 'livekit-client';
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
  private room: Room | null = null;
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

      // Create room instance
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoSimulcastLayers: [
            { resolution: VideoPresets.h90, encoding: { maxBitrate: 100_000 } },
            { resolution: VideoPresets.h180, encoding: { maxBitrate: 300_000 } },
            { resolution: VideoPresets.h360, encoding: { maxBitrate: 500_000 } },
          ],
        },
      });

      // Set up room event listeners
      this.setupRoomEventListeners();

      // Connect to room
      await this.room.connect(tokenResponse.wsUrl, tokenResponse.token);
      console.log('✅ LiveKit: Connected to room');

      // Initialize local participant
      const localParticipant = this.room.localParticipant;
      const localParticipantData: LiveKitParticipant = {
        identity: localParticipant.identity,
        name: localParticipant.name || options.participantName,
        isMuted: localParticipant.isMuted,
        isCameraEnabled: localParticipant.isCameraEnabled,
        isScreenSharing: localParticipant.isScreenSharing,
        isSpeaking: localParticipant.isSpeaking,
        connectionQuality: localParticipant.connectionQuality,
      };
      this.roomState.localParticipant = localParticipantData;

      // Enable media tracks
      if (options.enableCamera !== false) {
        await this.enableCamera();
      }
      if (options.enableMicrophone !== false) {
        await this.enableMicrophone();
      }

      this.updateRoomState({ isConnected: true });
      this.emit('connected', { room: this.room, options });

    } catch (error: any) {
      console.error('❌ LiveKit: Connection failed', error);
      this.updateRoomState({ error: error.message });
      this.emit('error', error);
      throw error;
    }
  }

  private async getLiveKitToken(options: LiveKitConnectionOptions): Promise<{ wsUrl: string; token: string }> {
    try {
      const { data } = await apolloClient.mutate({
        mutation: CREATE_LIVEKIT_TOKEN,
        variables: {
          input: {
            meetingId: options.roomName,
            participantName: options.participantName,
            meetingRole: options.meetingRole,
          },
        },
      });

      if (!data?.createLivekitToken) {
        throw new Error('Failed to get LiveKit token');
      }

      return JSON.parse(data.createLivekitToken);
    } catch (error: any) {
      console.error('❌ LiveKit: Token generation failed', error);
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  private setupRoomEventListeners() {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      console.log('✅ LiveKit: Room connected');
      this.updateRoomState({ isConnected: true, connectionState: ConnectionState.Connected });
      this.emit('roomConnected', { room: this.room });
    });

    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.log('🔌 LiveKit: Room disconnected', reason);
      this.updateRoomState({ 
        isConnected: false, 
        connectionState: ConnectionState.Disconnected,
        error: reason || 'Connection lost'
      });
      this.emit('roomDisconnected', { reason });
    });

    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('👤 LiveKit: Participant connected', participant.identity);
      this.handleParticipantConnected(participant);
    });

    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('👋 LiveKit: Participant disconnected', participant.identity);
      this.handleParticipantDisconnected(participant);
    });

    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('🎵 LiveKit: Track subscribed', { track, participant: participant.identity });
      this.handleTrackSubscribed(track, publication, participant);
    });

    this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('🔇 LiveKit: Track unsubscribed', { track, participant: participant.identity });
      this.handleTrackUnsubscribed(track, publication, participant);
    });

    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      console.log('🔄 LiveKit: Connection state changed', state);
      this.handleConnectionStateChanged(state);
    });

    this.room.on(RoomEvent.TrackMuted, (publication, participant) => {
      console.log('🔇 LiveKit: Track muted', { participant: participant.identity, track: publication.kind });
      this.handleTrackMuted(publication, participant);
    });

    this.room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      console.log('🔊 LiveKit: Track unmuted', { participant: participant.identity, track: publication.kind });
      this.handleTrackUnmuted(publication, participant);
    });

    this.room.on(RoomEvent.ParticipantMetadataChanged, (metadata, participant) => {
      console.log('📝 LiveKit: Participant metadata changed', { participant: participant.identity, metadata });
      this.handleParticipantMetadataChanged(metadata, participant);
    });

    this.room.on(RoomEvent.TrackPublished, (publication, participant) => {
      console.log('📡 LiveKit: Track published', { participant: participant.identity, track: publication.kind });
      this.emit('trackPublished', { publication, participant });
    });

    this.room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
      console.log('📡 LiveKit: Track unpublished', { participant: participant.identity, track: publication.kind });
      this.emit('trackUnpublished', { publication, participant });
    });

    this.room.on(RoomEvent.DataReceived, (payload, participant) => {
      console.log('📨 LiveKit: Data received', { participant: participant?.identity, payload });
      this.emit('dataReceived', { payload, participant });
    });
  }

  private handleParticipantConnected(participant: RemoteParticipant) {
    const liveKitParticipant: LiveKitParticipant = {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isMuted: participant.isMuted,
      isCameraEnabled: participant.isCameraEnabled,
      isScreenSharing: participant.isScreenSharing,
      isSpeaking: participant.isSpeaking,
      connectionQuality: participant.connectionQuality,
    };

    this.roomState.participants.set(participant.identity, liveKitParticipant);
    this.updateRoomState({});
    this.emit('participantConnected', { participant: liveKitParticipant });
  }

  private handleParticipantDisconnected(participant: RemoteParticipant) {
    this.roomState.participants.delete(participant.identity);
    this.updateRoomState({});
    this.emit('participantDisconnected', { participant: participant.identity });
  }

  private handleTrackSubscribed(track: RemoteTrack, publication: any, participant: RemoteParticipant) {
    this.emit('trackSubscribed', { track, publication, participant });
  }

  private handleTrackUnsubscribed(track: RemoteTrack, publication: any, participant: RemoteParticipant) {
    this.emit('trackUnsubscribed', { track, publication, participant });
  }

  private handleConnectionStateChanged(state: ConnectionState) {
    this.updateRoomState({ connectionState: state });
    this.emit('connectionStateChanged', { state });
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
    if (participant === this.room?.localParticipant) {
      if (publication.kind === Track.Kind.Audio) {
        this.updateRoomState({ isMuted: true });
      } else if (publication.kind === Track.Kind.Video) {
        this.updateRoomState({ isCameraEnabled: false });
      }
    }

    this.emit('trackMuted', { publication, participant });
  }

  private handleTrackUnmuted(publication: any, participant: RemoteParticipant | LocalParticipant) {
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
    if (participant === this.room?.localParticipant) {
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
    if (this.room) {
      console.log('🔌 LiveKit: Disconnecting...');
      await this.room.disconnect();
      this.room = null;
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
    if (!this.room) throw new Error('Not connected to room');
    
    try {
      await this.room.localParticipant.setCameraEnabled(true);
      this.updateRoomState({ isCameraEnabled: true });
      console.log('📹 LiveKit: Camera enabled');
    } catch (error) {
      console.error('❌ LiveKit: Failed to enable camera', error);
      throw error;
    }
  }

  async disableCamera(): Promise<void> {
    if (!this.room) throw new Error('Not connected to room');
    
    try {
      await this.room.localParticipant.setCameraEnabled(false);
      this.updateRoomState({ isCameraEnabled: false });
      console.log('📹 LiveKit: Camera disabled');
    } catch (error) {
      console.error('❌ LiveKit: Failed to disable camera', error);
      throw error;
    }
  }

  async enableMicrophone(): Promise<void> {
    if (!this.room) throw new Error('Not connected to room');
    
    try {
      await this.room.localParticipant.setMicrophoneEnabled(true);
      this.updateRoomState({ isMuted: false });
      console.log('🎤 LiveKit: Microphone enabled');
    } catch (error) {
      console.error('❌ LiveKit: Failed to enable microphone', error);
      throw error;
    }
  }

  async disableMicrophone(): Promise<void> {
    if (!this.room) throw new Error('Not connected to room');
    
    try {
      await this.room.localParticipant.setMicrophoneEnabled(false);
      this.updateRoomState({ isMuted: true });
      console.log('🎤 LiveKit: Microphone disabled');
    } catch (error) {
      console.error('❌ LiveKit: Failed to disable microphone', error);
      throw error;
    }
  }

  async startScreenShare(): Promise<void> {
    if (!this.room) throw new Error('Not connected to room');
    
    try {
      await this.room.localParticipant.setScreenShareEnabled(true);
      this.updateRoomState({ isScreenSharing: true });
      console.log('🖥️ LiveKit: Screen sharing started');
    } catch (error) {
      console.error('❌ LiveKit: Failed to start screen share', error);
      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    if (!this.room) throw new Error('Not connected to room');
    
    try {
      await this.room.localParticipant.setScreenShareEnabled(false);
      this.updateRoomState({ isScreenSharing: false });
      console.log('🖥️ LiveKit: Screen sharing stopped');
    } catch (error) {
      console.error('❌ LiveKit: Failed to stop screen share', error);
      throw error;
    }
  }

  async sendData(data: Uint8Array, topic?: string): Promise<void> {
    if (!this.room) throw new Error('Not connected to room');
    
    try {
      await this.room.localParticipant.publishData(data, { topic });
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

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ LiveKit: Error in event listener for ${event}`, error);
        }
      });
    }
  }

  private updateRoomState(updates: Partial<LiveKitRoomState>): void {
    this.roomState = { ...this.roomState, ...updates };
    this.emit('roomStateChanged', this.roomState);
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
    return this.room;
  }

  get state(): LiveKitRoomState {
    return this.roomState;
  }
}

export default LiveKitService;
