import { useConnectionStore } from '../store/connectionStore';
import { useDataStore } from '../store/dataStore';
import type { BridgeEvent } from '@conductor-companion/shared';

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  connect() {
    const { host, port, token, isConfigured } = useConnectionStore.getState();
    if (!isConfigured) return;

    this.disconnect();

    const url = `ws://${host}:${port}/api/ws?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      useConnectionStore.getState().setConnected(true);
      this.reconnectDelay = 1000;
      // Refresh data on (re)connect
      useDataStore.getState().fetchWorkspaces();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as BridgeEvent;
        this.handleEvent(data);
      } catch (e) {
        console.warn('Failed to parse WebSocket message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      useConnectionStore.getState().setConnected(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.warn('WebSocket error:', error);
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    useConnectionStore.getState().setConnected(false);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        this.maxReconnectDelay
      );
      this.connect();
    }, this.reconnectDelay);
  }

  private handleEvent(data: BridgeEvent) {
    const store = useDataStore.getState();

    switch (data.event) {
      case 'message.created':
        store.addMessage(data.data);
        break;
      case 'session.updated':
        store.updateSession(data.data);
        break;
      case 'workspace.updated':
        store.updateWorkspace(data.data);
        break;
      case 'assistant.streaming':
        store.appendStreamContent(data.data.session_id, data.data.content, data.data.done);
        break;
      case 'heartbeat':
        // Connection alive
        break;
    }
  }
}

export const wsManager = new WebSocketManager();
