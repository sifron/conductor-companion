import { bridgeClient } from '../../api/client';
import { useConnectionStore } from '../../store/connectionStore';
import type { WorkspaceProvider, ProviderHealth, MessagePageRequest, MessagePage, SendResult, SubscriptionScope, ProviderUpdate } from '../types';
import { BridgeSocket } from './socket';
import { workspaceToView, sessionToView, messageToView } from './normalize';

class BridgeProvider implements WorkspaceProvider {
  readonly source = 'bridge' as const;
  readonly label = 'This Mac';

  private socket: BridgeSocket | null = null;

  isConfigured(): boolean {
    return useConnectionStore.getState().bridgeConfigured;
  }

  async probe(signal?: AbortSignal): Promise<ProviderHealth> {
    const reachable = await bridgeClient.testConnection();
    return {
      reachable,
      detail: reachable ? null : 'Could not reach bridge server',
      fatal: false,
      checkedAt: new Date().toISOString(),
    };
  }

  async listWorkspaces(): Promise<import('@conductor-companion/shared').WorkspaceView[]> {
    const { workspaces } = await bridgeClient.getWorkspaces();
    const cloudConfigured = useConnectionStore.getState().cloudConfigured;
    // Ownership routing: when cloud is configured, cloud rows are owned by
    // CloudProvider — drop them here so there's no dedupe/merge needed.
    const owned = cloudConfigured ? workspaces.filter((w) => !w.sandbox_provider) : workspaces;
    return owned.map(workspaceToView);
  }

  async listSessions(workspaceId: string): Promise<import('@conductor-companion/shared').SessionView[]> {
    const { sessions } = await bridgeClient.getSessions(workspaceId);
    return sessions.map((s) => sessionToView(s, workspaceId));
  }

  async listMessages(sessionId: string, page: MessagePageRequest): Promise<MessagePage> {
    const data = await bridgeClient.getMessages(sessionId, page.limit, page.before);
    const messages = [...data.messages].reverse().map((m) => messageToView(m, sessionId));
    return {
      messages,
      hasMore: data.has_more,
      oldestCursor: messages[0]?.ref.id ?? null,
      newestCursor: messages[messages.length - 1]?.ref.id ?? null,
    };
  }

  async sendMessage(sessionId: string, text: string): Promise<SendResult> {
    const result = await bridgeClient.sendMessage(sessionId, text);
    if (result.status === 'error') {
      return { state: 'error', error: result.error || 'Send failed', retryable: true };
    }
    return { state: 'sent' };
  }

  subscribe(scope: SubscriptionScope, sink: (u: ProviderUpdate) => void): () => void {
    const { bridge } = useConnectionStore.getState();
    if (!bridge || !scope.foreground) {
      return () => {};
    }

    this.socket = new BridgeSocket(bridge, sink);
    this.socket.connect();

    return () => {
      this.socket?.disconnect();
      this.socket = null;
    };
  }
}

export const bridgeProvider = new BridgeProvider();
