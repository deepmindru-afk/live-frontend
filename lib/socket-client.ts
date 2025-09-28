import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.token = token;
    this.socket = io('http://localhost:3007', {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      forceNew: true,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to Socket.IO server with ID:', this.socket?.id);
      console.log('🔌 Socket connected status:', this.socket?.connected);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Socket.IO server. Reason:', reason);
      console.log('🔌 Socket connected status:', this.socket?.connected);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 Socket.IO connection error:', error);
      console.log('🔌 Socket connected status:', this.socket?.connected);
    });

    this.socket.on('error', (error) => {
      console.error('🔌 Socket.IO error:', error);
      console.log('🔌 Socket connected status:', this.socket?.connected);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Chat methods
  joinRoom(meetingId: string) {
    if (this.socket) {
      console.log('🔌 Joining room:', meetingId);
      this.socket.emit('JOIN_ROOM', { meetingId, roomName: meetingId });
    } else {
      console.error('❌ Socket not connected, cannot join room');
    }
  }

  leaveRoom(meetingId: string) {
    if (this.socket) {
      console.log('🔌 Leaving room:', meetingId);
      this.socket.emit('LEAVE_ROOM', { roomName: meetingId });
    }
  }

  sendChatMessage(meetingId: string, message: string, replyToMessageId?: string) {
    if (this.socket) {
      console.log('📤 Sending chat message:', { meetingId, message, replyToMessageId });
      this.socket.emit('CHAT_SEND', {
        roomName: meetingId,
        message,
        replyToMessageId,
      });
    } else {
      console.error('❌ Socket not connected, cannot send message');
    }
  }

  onChatMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('CHAT_MESSAGE', callback);
    }
  }

  onChatMessageSent(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.on('CHAT_MESSAGE_SENT', callback);
    }
  }

  onError(callback: (error: any) => void) {
    if (this.socket) {
      this.socket.on('ERROR', callback);
    }
  }

  offChatMessage(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.off('CHAT_MESSAGE', callback);
    }
  }

  offChatMessageSent(callback: (message: any) => void) {
    if (this.socket) {
      this.socket.off('CHAT_MESSAGE_SENT', callback);
    }
  }

  offError(callback: (error: any) => void) {
    if (this.socket) {
      this.socket.off('ERROR', callback);
    }
  }
}

// Export singleton instance
export const socketClient = new SocketClient();
export default socketClient;
