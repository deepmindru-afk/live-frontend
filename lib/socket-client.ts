import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.token = token;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3007';
    this.socket = io(backendUrl, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      forceNew: true,
    });

    this.socket.on('connect', () => {
    });

    this.socket.on('disconnect', (reason) => {
    });

    this.socket.on('connect_error', (error) => {
    });

    this.socket.on('error', (error) => {
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
      this.socket.emit('JOIN_ROOM', { meetingId, roomName: meetingId });
    } else {
    }
  }

  leaveRoom(meetingId: string) {
    if (this.socket) {
      this.socket.emit('LEAVE_ROOM', { roomName: meetingId });
    }
  }

  sendChatMessage(meetingId: string, message: string, replyToMessageId?: string) {
    if (this.socket) {
      this.socket.emit('CHAT_SEND', {
        roomName: meetingId,
        message,
        replyToMessageId,
      });
    } else {
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
