import { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectionState } from 'livekit-client';
import LiveKitService, { 
  LiveKitConnectionOptions, 
  LiveKitParticipant, 
  LiveKitRoomState 
} from '../lib/livekit-service';

export interface UseLiveKitOptions extends LiveKitConnectionOptions {
  autoConnect?: boolean;
  onConnected?: (roomState: LiveKitRoomState) => void;
  onDisconnected?: (roomState: LiveKitRoomState) => void;
  onParticipantConnected?: (participant: LiveKitParticipant) => void;
  onParticipantDisconnected?: (participantId: string) => void;
  onTrackSubscribed?: (track: any, publication: any, participant: any) => void;
  onTrackUnsubscribed?: (track: any, publication: any, participant: any) => void;
  onError?: (error: Error) => void;
}

export interface UseLiveKitReturn {
  // Connection state
  isConnected: boolean;
  connectionState: ConnectionState;
  isConnecting: boolean;
  error: string | null;
  
  // Room state
  participants: Map<string, LiveKitParticipant>;
  localParticipant: LiveKitParticipant | null;
  
  // Media state
  isMuted: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  
  // Actions
  connect: (options?: Partial<LiveKitConnectionOptions>) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  sendData: (data: Uint8Array, topic?: string) => Promise<void>;
  
  // Service instance
  liveKitService: LiveKitService | null;
}

export const useLiveKit = (options: UseLiveKitOptions = {}): UseLiveKitReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, LiveKitParticipant>>(new Map());
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const liveKitServiceRef = useRef<LiveKitService | null>(null);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialize LiveKit service
  useEffect(() => {
    if (!liveKitServiceRef.current) {
      liveKitServiceRef.current = new LiveKitService();
      setupEventListeners();
    }

    return () => {
      if (liveKitServiceRef.current) {
        liveKitServiceRef.current.disconnect();
      }
    };
  }, []);

  const setupEventListeners = useCallback(() => {
    if (!liveKitServiceRef.current) return;

    const service = liveKitServiceRef.current;

    service.addEventListener('connected', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      optionsRef.current.onConnected?.(service.state);
    });

    service.addEventListener('disconnected', () => {
      setIsConnected(false);
      setIsConnecting(false);
      setParticipants(new Map());
      setLocalParticipant(null);
      optionsRef.current.onDisconnected?.(service.state);
    });

    service.addEventListener('roomStateChanged', (roomState: LiveKitRoomState) => {
      setIsConnected(roomState.isConnected);
      setConnectionState(roomState.connectionState);
      setParticipants(new Map(roomState.participants));
      setLocalParticipant(roomState.localParticipant);
      setIsMuted(roomState.isMuted);
      setIsCameraEnabled(roomState.isCameraEnabled);
      setIsScreenSharing(roomState.isScreenSharing);
      setError(roomState.error);
    });

    service.addEventListener('participantConnected', ({ participant }: { participant: LiveKitParticipant }) => {
      setParticipants(prev => new Map(prev.set(participant.identity, participant)));
      optionsRef.current.onParticipantConnected?.(participant);
    });

    service.addEventListener('participantDisconnected', ({ participant }: { participant: string }) => {
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(participant);
        return newMap;
      });
      optionsRef.current.onParticipantDisconnected?.(participant);
    });

    service.addEventListener('trackSubscribed', ({ track, publication, participant }) => {
      optionsRef.current.onTrackSubscribed?.(track, publication, participant);
    });

    service.addEventListener('trackUnsubscribed', ({ track, publication, participant }) => {
      optionsRef.current.onTrackUnsubscribed?.(track, publication, participant);
    });

    service.addEventListener('error', (error: Error) => {
      setError(error.message);
      setIsConnecting(false);
      optionsRef.current.onError?.(error);
    });

  }, []);

  const connect = useCallback(async (connectOptions?: Partial<LiveKitConnectionOptions>) => {
    if (!liveKitServiceRef.current) {
      throw new Error('LiveKit service not initialized');
    }

    setIsConnecting(true);
    setError(null);

    try {
      const finalOptions = {
        ...optionsRef.current,
        ...connectOptions,
      };

      await liveKitServiceRef.current.connect(finalOptions);
    } catch (err: any) {
      setIsConnecting(false);
      setError(err.message);
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!liveKitServiceRef.current) return;

    try {
      await liveKitServiceRef.current.disconnect();
    } catch (err: any) {
      console.error('Failed to disconnect from LiveKit:', err);
      setError(err.message);
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!liveKitServiceRef.current) return;

    try {
      if (isMuted) {
        await liveKitServiceRef.current.enableMicrophone();
      } else {
        await liveKitServiceRef.current.disableMicrophone();
      }
    } catch (err: any) {
      console.error('Failed to toggle microphone:', err);
      setError(err.message);
    }
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!liveKitServiceRef.current) return;

    try {
      if (isCameraEnabled) {
        await liveKitServiceRef.current.disableCamera();
      } else {
        await liveKitServiceRef.current.enableCamera();
      }
    } catch (err: any) {
      console.error('Failed to toggle camera:', err);
      setError(err.message);
    }
  }, [isCameraEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!liveKitServiceRef.current) return;

    try {
      if (isScreenSharing) {
        await liveKitServiceRef.current.stopScreenShare();
      } else {
        await liveKitServiceRef.current.startScreenShare();
      }
    } catch (err: any) {
      console.error('Failed to toggle screen share:', err);
      setError(err.message);
    }
  }, [isScreenSharing]);

  const sendData = useCallback(async (data: Uint8Array, topic?: string) => {
    if (!liveKitServiceRef.current) return;

    try {
      await liveKitServiceRef.current.sendData(data, topic);
    } catch (err: any) {
      console.error('Failed to send data:', err);
      setError(err.message);
    }
  }, []);

  // Auto-connect if enabled
  useEffect(() => {
    if (options.autoConnect && liveKitServiceRef.current && !isConnected && !isConnecting) {
      connect();
    }
  }, [options.autoConnect, connect, isConnected, isConnecting]);

  return {
    // Connection state
    isConnected,
    connectionState,
    isConnecting,
    error,
    
    // Room state
    participants,
    localParticipant,
    
    // Media state
    isMuted,
    isCameraEnabled,
    isScreenSharing,
    
    // Actions
    connect,
    disconnect,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    sendData,
    
    // Service instance
    liveKitService: liveKitServiceRef.current,
  };
};

export default useLiveKit;

