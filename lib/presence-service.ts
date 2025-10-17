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
    
  }

  /**
   * Connect to WebSocket and start presence system
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('PresenceService not initialized. Call init() first.');
    }

    if (this.socket?.connected) {
      return;
    }

    try {
      
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
          resolve();
        });

        this.socket!.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
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
      
      this.socket.emit('JOIN_MEETING', { meetingId: this.config.meetingId });
      
      // Start heartbeat system
      this.startHeartbeat();
      
      this.isActive = true;
      this.callbacks.onConnected?.();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Leave meeting and stop heartbeat
   */
  async leaveMeeting(): Promise<void> {
    if (!this.socket?.connected || !this.config) {
      return;
    }

    try {
      
      this.socket.emit('LEAVE_MEETING', { meetingId: this.config.meetingId });
      
      // Stop heartbeat system
      this.stopHeartbeat();
      
      this.isActive = false;
      this.callbacks.onDisconnected?.();
    } catch (error) {
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
      return;
    }

    try {
      this.socket.emit('HEARTBEAT', { meetingId: this.config.meetingId });
      
      // Set timeout to detect if heartbeat is not acknowledged
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
      }

      this.heartbeatTimeout = setTimeout(() => {
        this.callbacks.onHeartbeatTimeout?.();
      }, 15000); // 15 second timeout
      
    } catch (error) {
      this.callbacks.onError?.(`Failed to send heartbeat: ${(error as Error).message}`);
    }
  }

  /**
   * Set up WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('MEETING_JOIN_SUCCESS', (data) => {
      this.lastHeartbeat = new Date();
      this.callbacks.onPresenceUpdate?.(data);
    });

    this.socket.on('MEETING_LEAVE_SUCCESS', (data) => {
      this.callbacks.onPresenceUpdate?.(data);
    });

    this.socket.on('HEARTBEAT_ACK', (data) => {
      this.lastHeartbeat = new Date();
      
      // Clear heartbeat timeout
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = null;
      }

      this.callbacks.onPresenceUpdate?.(data);
    });

    this.socket.on('ERROR', (data) => {
      this.callbacks.onError?.(data.message || 'WebSocket error occurred');
    });

    this.socket.on('disconnect', (reason) => {
      this.stopHeartbeat();
      this.isActive = false;
      this.callbacks.onDisconnected?.();
    });

    this.socket.on('connect_error', (error) => {
      this.callbacks.onError?.(`Connection error: ${error.message}`);
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    
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
