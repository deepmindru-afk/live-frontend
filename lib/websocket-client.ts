class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private meetingId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(meetingId: string, token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return this.ws;
    }

    this.meetingId = meetingId;
    this.token = token;

    const wsUrl = `ws://localhost:3007/ws?meetingId=${encodeURIComponent(meetingId)}&token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = (event) => {
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
      }
    };

    return this.ws;
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      setTimeout(() => {
        if (this.meetingId && this.token) {
          this.connect(this.meetingId, this.token);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
    }
  }

  private handleMessage(message: any) {
    switch (message.event) {
      case 'CHAT_MESSAGE':
        this.onChatMessage?.(message);
        break;
      case 'USER_JOINED':
        this.onUserJoined?.(message);
        break;
      case 'USER_LEFT':
        this.onUserLeft?.(message);
        break;
      case 'INFO':
        break;
      default:
    }
  }

  sendChatMessage(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        event: 'CHAT_SEND',
        text: text.trim()
      };
      this.ws.send(JSON.stringify(message));
    } else {
    }
  }

  ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: 'PING' }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Event handlers
  private onChatMessage?: (message: any) => void;
  private onUserJoined?: (message: any) => void;
  private onUserLeft?: (message: any) => void;

  setOnChatMessage(callback: (message: any) => void) {
    this.onChatMessage = callback;
  }

  setOnUserJoined(callback: (message: any) => void) {
    this.onUserJoined = callback;
  }

  setOnUserLeft(callback: (message: any) => void) {
    this.onUserLeft = callback;
  }

  getConnectionState(): number | null {
    return this.ws?.readyState || null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const websocketClient = new WebSocketClient();
export default websocketClient;

