/**
 * WebSocket client for real-time notifications
 */

type MessageHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private isConnecting = false;

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    this.ws = new WebSocket(`${wsUrl}/ws/notifications/?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data.data || data);
      } catch (e) {
        console.error('WebSocket message parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnecting = false;
      this.emit('disconnected', {});

      // Reconnect after 3 seconds
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, 3000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, handler: MessageHandler): () => void {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);

    // Return unsubscribe function
    return () => {
      const h = this.handlers.get(event) || [];
      const index = h.indexOf(handler);
      if (index > -1) {
        h.splice(index, 1);
        this.handlers.set(event, h);
      }
    };
  }

  private emit(event: string, data: any): void {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach((handler) => handler(data));
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  markRead(notificationId: number): void {
    this.send({ action: 'mark_read', notification_id: notificationId });
  }

  markAllRead(): void {
    this.send({ action: 'mark_all_read' });
  }
}

export const wsClient = new WebSocketClient();
