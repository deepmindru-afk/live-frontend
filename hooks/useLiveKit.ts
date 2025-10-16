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
  const cleanupListenersRef = useRef<(() => void) | null>(null);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const setupEventListeners = useCallback(() => {
    if (!liveKitServiceRef.current) return;

    const service = liveKitServiceRef.current;

    // Define all event handlers
    const handleConnected = () => {
      console.log('🔍 [useLiveKit] handleConnected called - LiveKit connection established');
      console.log('🔍 [useLiveKit] Current state before update:', {
        isConnected,
        isConnecting,
        participantsSize: participants.size,
        participantsKeys: Array.from(participants.keys())
      });
      
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      
      console.log('🔍 [useLiveKit] handleConnected completed - state updated');
      optionsRef.current.onConnected?.(service.state);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setIsConnecting(false);
      setParticipants(new Map());
      setLocalParticipant(null);
      optionsRef.current.onDisconnected?.(service.state);
    };

    const handleRoomStateChanged = (roomState: LiveKitRoomState) => {
      setIsConnected(roomState.isConnected);
      setConnectionState(roomState.connectionState);
      setParticipants(new Map(roomState.participants));
      setLocalParticipant(roomState.localParticipant);
      setIsMuted(roomState.isMuted);
      setIsCameraEnabled(roomState.isCameraEnabled);
      setIsScreenSharing(roomState.isScreenSharing);
      setError(roomState.error);
    };

    const handleParticipantConnected = ({ participant }: { participant: LiveKitParticipant }) => {
      console.log('🔍 [useLiveKit] handleParticipantConnected called:', {
        participantIdentity: participant.identity,
        participantName: participant.name,
        currentParticipantsSize: participants.size
      });
      
      setParticipants(prev => {
        const newMap = new Map(prev.set(participant.identity, participant));
        console.log('🔍 [useLiveKit] Participants map updated:', {
          newSize: newMap.size,
          keys: Array.from(newMap.keys()),
          participants: Array.from(newMap.entries()).map(([id, p]) => ({ id, name: p.name }))
        });
        return newMap;
      });
      
      optionsRef.current.onParticipantConnected?.(participant);
    };

    const handleParticipantDisconnected = ({ participant }: { participant: string }) => {
      setParticipants(prev => {
        const newMap = new Map(prev);
        newMap.delete(participant);
        return newMap;
      });
      optionsRef.current.onParticipantDisconnected?.(participant);
    };

    // Add event listeners
    service.addEventListener('connected', handleConnected);
    service.addEventListener('disconnected', handleDisconnected);
    service.addEventListener('roomStateChanged', handleRoomStateChanged);
    service.addEventListener('participantConnected', handleParticipantConnected);
    service.addEventListener('participantDisconnected', handleParticipantDisconnected);

    const handleTrackSubscribed = ({ track, publication, participant }: any) => {
      optionsRef.current.onTrackSubscribed?.(track, publication, participant);
    };

    const handleTrackUnsubscribed = ({ track, publication, participant }: any) => {
      optionsRef.current.onTrackUnsubscribed?.(track, publication, participant);
    };

    const handleError = (error: Error) => {
      setError(error.message);
      setIsConnecting(false);
      optionsRef.current.onError?.(error);
    };

    service.addEventListener('trackSubscribed', handleTrackSubscribed);
    service.addEventListener('trackUnsubscribed', handleTrackUnsubscribed);
    service.addEventListener('error', handleError);

    // Return cleanup function
    return () => {
      service.removeEventListener('connected', handleConnected);
      service.removeEventListener('disconnected', handleDisconnected);
      service.removeEventListener('roomStateChanged', handleRoomStateChanged);
      service.removeEventListener('participantConnected', handleParticipantConnected);
      service.removeEventListener('participantDisconnected', handleParticipantDisconnected);
      service.removeEventListener('trackSubscribed', handleTrackSubscribed);
      service.removeEventListener('trackUnsubscribed', handleTrackUnsubscribed);
      service.removeEventListener('error', handleError);
    };
  }, []);

  // Initialize LiveKit service
  useEffect(() => {
    console.log('🔌 useLiveKit: Initializing LiveKit service...');
    if (!liveKitServiceRef.current) {
      console.log('🔌 useLiveKit: Creating new LiveKitService instance');
      liveKitServiceRef.current = new LiveKitService();
      cleanupListenersRef.current = setupEventListeners();
      console.log('🔌 useLiveKit: LiveKitService created and event listeners setup');
    } else {
      console.log('🔌 useLiveKit: LiveKitService already exists');
    }

    return () => {
      // Clean up event listeners first
      if (cleanupListenersRef.current) {
        cleanupListenersRef.current();
        cleanupListenersRef.current = null;
      }
      
      // Then disconnect
      if (liveKitServiceRef.current) {
        liveKitServiceRef.current.disconnect();
      }
    };
  }, [setupEventListeners]);

  const connect = useCallback(async (connectOptions?: Partial<LiveKitConnectionOptions>) => {
    console.log('🔌 useLiveKit connect called with options:', connectOptions);
    
    if (!liveKitServiceRef.current) {
      console.error('❌ LiveKit service not initialized');
      throw new Error('LiveKit service not initialized');
    }

    console.log('🔌 LiveKit service exists, starting connection...');
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
      console.log('🎤 [useLiveKit] Toggling microphone:', { isMuted, newState: !isMuted });
      
      if (isMuted) {
        await liveKitServiceRef.current.enableMicrophone();
      } else {
        await liveKitServiceRef.current.disableMicrophone();
      }
      
      console.log('✅ [useLiveKit] Microphone toggled successfully');
    } catch (err: any) {
      console.error('❌ [useLiveKit] Failed to toggle microphone:', err);
      
      // Set error state for UI feedback
      setError(err.message || 'Failed to toggle microphone');
      
      // Import and show SweetAlert error notification
      import('sweetalert2').then(({ default: Swal }) => {
        Swal.fire({
          icon: 'error',
          title: 'Microphone Error',
          text: err.message || 'Failed to toggle microphone. Please check your microphone permissions and try again.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc3545'
        });
      });
      
      throw err; // Re-throw so calling code knows it failed
    }
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    if (!liveKitServiceRef.current) return;

    try {
      console.log('📹 [useLiveKit] Toggling camera:', { isCameraEnabled, newState: !isCameraEnabled });
      
      if (isCameraEnabled) {
        await liveKitServiceRef.current.disableCamera();
      } else {
        await liveKitServiceRef.current.enableCamera();
      }
      
      console.log('✅ [useLiveKit] Camera toggled successfully');
    } catch (err: any) {
      console.error('❌ [useLiveKit] Failed to toggle camera:', err);
      
      // Don't set error state to prevent UI disruption
      // The service handles graceful degradation internally
      console.warn('⚠️ [useLiveKit] Camera toggle failed, but continuing operation');
    }
  }, [isCameraEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (!liveKitServiceRef.current) return;

    try {
      console.log('🖥️ [useLiveKit] Toggling screen share:', { isScreenSharing, newState: !isScreenSharing });
      
      if (isScreenSharing) {
        await liveKitServiceRef.current.stopScreenShare();
      } else {
        await liveKitServiceRef.current.startScreenShare();
      }
      
      console.log('✅ [useLiveKit] Screen share toggled successfully');
    } catch (err: any) {
      console.error('❌ [useLiveKit] Failed to toggle screen share:', err);
      
      // Don't set error state to prevent UI disruption
      // The service handles graceful degradation internally
      console.warn('⚠️ [useLiveKit] Screen share toggle failed, but continuing operation');
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

