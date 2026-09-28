import type { BridgeEvent } from '@conductor-companion/shared';
import type { BridgeCredentials } from '../../store/connectionStore';
import type { ProviderUpdate } from '../types';
import { createBackoff } from '../backoff';
import { rawWorkspaceToView, sessionToView, messageToView } from './normalize';

/**
 * Owns the bridge WebSocket connection. Takes a sink instead of poking a
 * store directly — this inversion is what keeps `if (isCloud)` out of screens.
 */
export class BridgeSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = createBackoff();
  private closedByUser = false;

  constructor(
    private creds: BridgeCredentials,
    private sink: (u: ProviderUpdate) => void
  ) {}

  connect() {
    this.disconnect();
    this.closedByUser = false;

    const { host, port, token } = this.creds;
    const url = `ws://${host}:${port}/api/ws?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.backoff.reset();
      this.sink({
        kind: 'health',
        source: 'bridge',
        health: { reachable: true, detail: null, fatal: false, checkedAt: new Date().toISOString() },
      });
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
      this.sink({
        kind: 'health',
        source: 'bridge',
        health: { reachable: false, detail: 'Disconnected', fatal: false, checkedAt: new Date().toISOString() },
      });
      if (!this.closedByUser) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose follows; nothing else to do here.
    };
  }

  disconnect() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff.next());
  }

  private handleEvent(data: BridgeEvent) {
    switch (data.event) {
      case 'message.created':
        this.sink({
          kind: 'messages.appended',
          source: 'bridge',
          sessionId: data.data.session_id ?? '',
          messages: [messageToView(data.data, data.data.session_id ?? '')],
        });
        break;
      case 'session.updated':
        if (data.data.workspace_id) {
          this.sink({ kind: 'session', source: 'bridge', session: sessionToView(data.data, data.data.workspace_id) });
        }
        break;
      case 'workspace.updated':
        this.sink({ kind: 'workspaces', source: 'bridge', workspaces: [rawWorkspaceToView(data.data)] });
        break;
      case 'assistant.streaming':
        this.sink({
          kind: 'assistant.delta',
          source: 'bridge',
          sessionId: data.data.session_id,
          text: data.data.content,
          done: data.data.done,
        });
        break;
      case 'heartbeat':
        break;
    }
  }
}
