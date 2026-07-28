import type { ProviderUpdate, SubscriptionScope } from '../types';
import { createBackoff } from '../backoff';
import * as api from './http';
import { cloudWorkspaceToView, cloudSessionToView, cloudMessageToView } from './normalize';

const WORKSPACE_LIST_INTERVAL_MS = 60_000;
const ACTIVE_STATUS_WORKING_MS = 5_000;
const ACTIVE_STATUS_IDLE_MS = 15_000;
const ACK_GRACE_MS = 45_000;

type Ack = 'none' | 'awaiting' | 'confirmed' | 'timeout';

interface SessionAckState {
  ack: Ack;
  sentAt: number;
}

/**
 * Drives all cloud polling. Tiers driven by SubscriptionScope: a cheap
 * workspace-list tick while foreground, and a tight active-session tick only
 * while a ChatView is mounted on a cloud session. Foreground-only — no
 * background fetch exists for a bare Expo app.
 */
export class CloudPoller {
  private backoff = createBackoff();
  private stopped = false;
  private fatal = false;

  private workspaceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeTimer: ReturnType<typeof setTimeout> | null = null;

  private inFlightWorkspaces = false;
  private inFlightActive = false;

  private newestCursor: Map<string, string> = new Map();
  private ackState: Map<string, SessionAckState> = new Map();

  constructor(
    private apiKey: string,
    private sink: (u: ProviderUpdate) => void
  ) {}

  start(scope: SubscriptionScope) {
    this.stop();
    this.stopped = false;
    if (!scope.foreground) return;

    this.tickWorkspaces();
    if (scope.activeSessionId) {
      this.tickActive(scope.activeWorkspaceId, scope.activeSessionId);
    }
  }

  stop() {
    this.stopped = true;
    if (this.workspaceTimer) clearTimeout(this.workspaceTimer);
    if (this.activeTimer) clearTimeout(this.activeTimer);
    this.workspaceTimer = null;
    this.activeTimer = null;
  }

  /** Called right after a successful send so the idle/working latch masks
   * the just-queued prompt still reporting `idle`. */
  noteSend(sessionId: string) {
    this.ackState.set(sessionId, { ack: 'awaiting', sentAt: Date.now() });
  }

  private scheduleWorkspaces(delayMs: number) {
    if (this.stopped || this.fatal) return;
    this.workspaceTimer = setTimeout(() => this.tickWorkspaces(), delayMs);
  }

  private scheduleActive(workspaceId: string | null, sessionId: string, delayMs: number) {
    if (this.stopped || this.fatal) return;
    this.activeTimer = setTimeout(() => this.tickActive(workspaceId, sessionId), delayMs);
  }

  private async tickWorkspaces() {
    if (this.inFlightWorkspaces) {
      this.scheduleWorkspaces(WORKSPACE_LIST_INTERVAL_MS);
      return;
    }
    this.inFlightWorkspaces = true;
    try {
      const { workspaces } = await api.listAllWorkspaces(this.apiKey);
      this.sink({ kind: 'workspaces', source: 'cloud', workspaces: workspaces.map(cloudWorkspaceToView) });
      this.sink({
        kind: 'health',
        source: 'cloud',
        health: { reachable: true, detail: null, fatal: false, checkedAt: new Date().toISOString() },
      });
      this.backoff.reset();
      this.scheduleWorkspaces(WORKSPACE_LIST_INTERVAL_MS);
    } catch (e) {
      this.handleError(e, () => this.scheduleWorkspaces(this.backoff.next()));
    } finally {
      this.inFlightWorkspaces = false;
    }
  }

  private async tickActive(workspaceId: string | null, sessionId: string) {
    if (this.inFlightActive) {
      this.scheduleActive(workspaceId, sessionId, ACTIVE_STATUS_IDLE_MS);
      return;
    }
    this.inFlightActive = true;
    try {
      const rawStatus = await api.getSessionStatus(this.apiKey, sessionId);
      const status = this.applyAckLatch(sessionId, rawStatus);

      if (workspaceId) {
        this.sink({
          kind: 'session',
          source: 'cloud',
          session: cloudSessionToView({
            id: sessionId,
            workspaceId,
            title: null,
            model: null,
            contextUsedPercent: null,
            planMode: false,
            updatedAt: new Date().toISOString(),
            status,
          }),
        });
      }

      if (status === 'working' || !this.newestCursor.has(sessionId)) {
        const after = this.newestCursor.get(sessionId);
        const page = await api.listMessages(this.apiKey, sessionId, { after, limit: 200 });
        if (page.messages.length > 0) {
          this.newestCursor.set(sessionId, page.messages[page.messages.length - 1].id);
          this.sink({
            kind: 'messages.appended',
            source: 'cloud',
            sessionId,
            messages: page.messages.map((m) => cloudMessageToView(m, sessionId)),
          });
        }
      }

      this.backoff.reset();
      const interval = status === 'working' ? ACTIVE_STATUS_WORKING_MS : ACTIVE_STATUS_IDLE_MS;
      this.scheduleActive(workspaceId, sessionId, interval);
    } catch (e) {
      this.handleError(e, () => this.scheduleActive(workspaceId, sessionId, this.backoff.next()));
    } finally {
      this.inFlightActive = false;
    }
  }

  private applyAckLatch(sessionId: string, rawStatus: api.CloudSessionStatus | null): api.CloudSessionStatus | null {
    const state = this.ackState.get(sessionId);
    if (!state || state.ack === 'none') return rawStatus;

    if (state.ack === 'awaiting') {
      if (rawStatus === 'working') {
        state.ack = 'confirmed';
      } else if (Date.now() - state.sentAt < ACK_GRACE_MS) {
        return 'working'; // deliberate — mask a just-queued prompt still reporting idle
      } else {
        state.ack = 'timeout';
      }
    }

    if (state.ack === 'confirmed' && rawStatus === 'idle') {
      state.ack = 'none';
      this.ackState.delete(sessionId);
    }

    return rawStatus;
  }

  /** Restarts the active-session tier when ChatView mounts/unmounts on a
   * different session, without touching the workspace-list tier. */
  setActive(workspaceId: string | null, sessionId: string | null) {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (sessionId && !this.stopped && !this.fatal) {
      this.tickActive(workspaceId, sessionId);
    }
  }

  private handleError(e: unknown, retry: () => void) {
    if (e instanceof api.CloudApiError && (e.status === 401 || e.status === 403)) {
      this.fatal = true;
      this.stop();
      this.sink({
        kind: 'health',
        source: 'cloud',
        health: { reachable: false, detail: 'API key rejected', fatal: true, checkedAt: new Date().toISOString() },
      });
      return;
    }
    this.sink({
      kind: 'health',
      source: 'cloud',
      health: {
        reachable: false,
        detail: e instanceof Error ? e.message : 'Cloud request failed',
        fatal: false,
        checkedAt: new Date().toISOString(),
      },
    });
    retry();
  }
}
