import { io, Socket } from 'socket.io-client';

interface PresenceConfig {
  serverUrl: string;
  token: string;
  meetingId: string;
  userId: string;
}

interface PresenceCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onHeartbeatTimeout?: () => void;
  onError?: (error: string) => void;
  onPresenceUpdate?: (data: any) => void;
}

class PresenceService {
  private socket: Socket | null = null;
  private config: PresenceConfig | null = null;
  private callbacks: PresenceCallbacks = {};
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private isActive = false;
  private lastHeartbeat: Date | null = null;

  /**
   * Initialize presence service with configuration
   */
  init(config: PresenceConfig, callbacks: PresenceCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
    
    console.log('[PRESENCE_SERVICE] Initialized with config:', {
      serverUrl: config.serverUrl,
      meetingId: config.meetingId,
      userId: config.userId,
      hasToken: !!config.token
    });
  }

  /**
   * Connect to WebSocket and start presence system
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('PresenceService not initialized. Call init() first.');
    }

    if (this.socket?.connected) {
      console.log('[PRESENCE_SERVICE] Already connected');
      return;
    }

    try {
      console.log('[PRESENCE_SERVICE] Connecting to WebSocket...');
      
      this.socket = io(`${this.config.serverUrl}/signaling`, {
        auth: {
          token: this.config.token,
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      this.setupEventListeners();
      
      // Wait for connection
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 30000);

        this.socket!.on('connect', () => {
          clearTimeout(timeout);
          console.log('[PRESENCE_SERVICE] Connected to WebSocket');
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      console.error('[PRESENCE_SERVICE] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Join a meeting and start heartbeat
   */
  async joinMeeting(): Promise<void> {
    if (!this.socket?.connected || !this.config) {
      throw new Error('Not connected to WebSocket');
    }

    try {
      console.log('[PRESENCE_SERVICE] Joining meeting:', this.config.meetingId);
      
      this.socket.emit('JOIN_MEETING', { meetingId: this.config.meetingId });
      
      // Start heartbeat system
      this.startHeartbeat();
      
      this.isActive = true;
      this.callbacks.onConnected?.();
    } catch (error) {
      console.error('[PRESENCE_SERVICE] Failed to join meeting:', error);
      throw error;
    }
  }

  /**
   * Leave meeting and stop heartbeat
   */
  async leaveMeeting(): Promise<void> {
    if (!this.socket?.connected || !this.config) {
      console.warn('[PRESENCE_SERVICE] Not connected, cannot leave meeting');
      return;
    }

    try {
      console.log('[PRESENCE_SERVICE] Leaving meeting:', this.config.meetingId);
      
      this.socket.emit('LEAVE_MEETING', { meetingId: this.config.meetingId });
      
      // Stop heartbeat system
      this.stopHeartbeat();
      
      this.isActive = false;
      this.callbacks.onDisconnected?.();
    } catch (error) {
      console.error('[PRESENCE_SERVICE] Failed to leave meeting:', error);
      throw error;
    }
  }

  /**
   * Start heartbeat system (sends heartbeat every 10 seconds)
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    console.log('[PRESENCE_SERVICE] Starting heartbeat system');
    
    // Send initial heartbeat
    this.sendHeartbeat();
    
    // Set up interval for regular heartbeats
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // 10 seconds
  }

  /**
   * Stop heartbeat system
   */
  private stopHeartbeat(): void {
    console.log('[PRESENCE_SERVICE] Stopping heartbeat system');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Send heartbeat to server
   */
  private sendHeartbeat(): void {
    if (!this.socket?.connected || !this.config) {
      console.warn('[PRESENCE_SERVICE] Cannot send heartbeat: not connected');
      return;
    }

    try {
      console.log('[PRESENCE_SERVICE] Sending heartbeat');
      this.socket.emit('HEARTBEAT', { meetingId: this.config.meetingId });
      
      // Set timeout to detect if heartbeat is not acknowledged
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
      }

      this.heartbeatTimeout = setTimeout(() => {
        console.warn('[PRESENCE_SERVICE] Heartbeat timeout - no acknowledgment received');
        this.callbacks.onHeartbeatTimeout?.();
      }, 15000); // 15 second timeout
      
    } catch (error) {
      console.error('[PRESENCE_SERVICE] Error sending heartbeat:', error);
      this.callbacks.onError?.(`Failed to send heartbeat: ${(error as Error).message}`);
    }
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('MEETING_JOIN_SUCCESS', (data) => {
      console.log('[PRESENCE_SERVICE] Meeting join successful:', data);
      this.lastHeartbeat = new Date();
      this.callbacks.onPresenceUpdate?.(data);
    });

    this.socket.on('MEETING_LEAVE_SUCCESS', (data) => {
      console.log('[PRESENCE_SERVICE] Meeting leave successful:', data);
      this.callbacks.onPresenceUpdate?.(data);
    });

    this.socket.on('HEARTBEAT_ACK', (data) => {
      console.log('[PRESENCE_SERVICE] Heartbeat acknowledged:', data);
      this.lastHeartbeat = new Date();
      
      // Clear heartbeat timeout
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = null;
      }

      this.callbacks.onPresenceUpdate?.(data);
    });

    this.socket.on('ERROR', (data) => {
      console.error('[PRESENCE_SERVICE] WebSocket error:', data);
      this.callbacks.onError?.(data.message || 'WebSocket error occurred');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[PRESENCE_SERVICE] Disconnected:', reason);
      this.stopHeartbeat();
      this.isActive = false;
      this.callbacks.onDisconnected?.();
    });

    this.socket.on('connect_error', (error) => {
      console.error('[PRESENCE_SERVICE] Connection error:', error);
      this.callbacks.onError?.(`Connection error: ${error.message}`);
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[PRESENCE_SERVICE] Disconnecting...');
    
    this.stopHeartbeat();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isActive = false;
    this.lastHeartbeat = null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isConnected: boolean;
    isActive: boolean;
    lastHeartbeat: Date | null;
  } {
    return {
      isConnected: this.socket?.connected || false,
      isActive: this.isActive,
      lastHeartbeat: this.lastHeartbeat,
    };
  }

  /**
   * Update callbacks
   */
  updateCallbacks(callbacks: Partial<PresenceCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// Export singleton instance
export const presenceService = new PresenceService();
export default presenceService;
