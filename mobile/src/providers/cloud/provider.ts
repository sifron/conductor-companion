import { useConnectionStore } from '../../store/connectionStore';
import type { WorkspaceProvider, ProviderHealth, MessagePageRequest, MessagePage, SendResult, SubscriptionScope, ProviderUpdate } from '../types';
import * as api from './http';
import { cloudWorkspaceToView, cloudSessionToView, cloudMessageToView } from './normalize';
import { CloudPoller } from './poller';

class CloudProvider implements WorkspaceProvider {
  readonly source = 'cloud' as const;
  readonly label = 'Conductor Cloud';

  private poller: CloudPoller | null = null;

  private apiKey(): string | null {
    return useConnectionStore.getState().cloud?.apiKey ?? null;
  }

  isConfigured(): boolean {
    return useConnectionStore.getState().cloudConfigured;
  }

  async probe(): Promise<ProviderHealth> {
    const key = this.apiKey();
    if (!key) {
      return { reachable: false, detail: 'No API key configured', fatal: false, checkedAt: new Date().toISOString() };
    }
    try {
      await api.getMe(key);
      return { reachable: true, detail: null, fatal: false, checkedAt: new Date().toISOString() };
    } catch (e) {
      const fatal = e instanceof api.CloudApiError && (e.status === 401 || e.status === 403);
      return {
        reachable: false,
        detail: e instanceof Error ? e.message : 'Cloud unreachable',
        fatal,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async listWorkspaces(): Promise<import('@conductor-companion/shared').WorkspaceView[]> {
    const key = this.apiKey();
    if (!key) return [];
    const { workspaces } = await api.listAllWorkspaces(key);
    return workspaces.map(cloudWorkspaceToView);
  }

  async listSessions(workspaceId: string): Promise<import('@conductor-companion/shared').SessionView[]> {
    const key = this.apiKey();
    if (!key) return [];
    const sessions = await api.listSessions(key, workspaceId);
    return sessions.map(cloudSessionToView);
  }

  async listMessages(sessionId: string, page: MessagePageRequest): Promise<MessagePage> {
    const key = this.apiKey();
    if (!key) return { messages: [], hasMore: false, oldestCursor: null, newestCursor: null };

    // Initial load: page forward until exhausted, keep the tail. `offset`
    // direction is unspecified by the beta spec, so `after` is the only
    // cursor we trust going forward.
    let messages: import('@conductor-companion/shared').MessageView[] = [];
    let after: string | undefined;
    for (let i = 0; i < 20; i++) {
      const batch = await api.listMessages(key, sessionId, { after, limit: page.limit });
      const views = batch.messages.map((m) => cloudMessageToView(m, sessionId));
      messages = messages.concat(views);
      if (!batch.hasMore || views.length === 0) break;
      after = views[views.length - 1].ref.id;
    }
    const tail = messages.slice(-200);

    return {
      messages: tail,
      hasMore: false, // cloud has no reliable backward pagination in v1 — load-older is a no-op
      oldestCursor: tail[0]?.ref.id ?? null,
      newestCursor: tail[tail.length - 1]?.ref.id ?? null,
    };
  }

  async sendMessage(sessionId: string, text: string, idempotencyKey: string): Promise<SendResult> {
    const key = this.apiKey();
    if (!key) return { state: 'error', error: 'No API key configured', retryable: false };
    try {
      await api.sendMessage(key, sessionId, idempotencyKey, text);
      this.poller?.noteSend(sessionId);
      return { state: 'sent' };
    } catch (e) {
      return { state: 'error', error: e instanceof Error ? e.message : 'Send failed', retryable: true };
    }
  }

  async cancel(sessionId: string): Promise<void> {
    const key = this.apiKey();
    if (!key) return;
    await api.cancelSession(key, sessionId);
  }

  subscribe(scope: SubscriptionScope, sink: (u: ProviderUpdate) => void): () => void {
    const key = this.apiKey();
    if (!key) return () => {};

    this.poller = new CloudPoller(key, sink);
    this.poller.start(scope);

    return () => {
      this.poller?.stop();
      this.poller = null;
    };
  }
}

export const cloudProvider = new CloudProvider();

/** Not cryptographically secure — the idempotency key just needs to be
 * unique per send, not unguessable. Avoids an extra native-crypto dep. */
export function newIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
