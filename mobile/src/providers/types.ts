import type { EntityRef, SourceId, WorkspaceView, SessionView, MessageView } from '@conductor-companion/shared';

/**
 * Lives here rather than in `shared/` because Metro's project root is `mobile/` and
 * cannot resolve the out-of-root `@conductor-companion/shared` symlink at runtime.
 * Keeping `shared/` type-only (every import from it erases at compile time) is what
 * lets the bundle build without a custom metro.config.js. Mirrors shared/src/domain.ts.
 */
export const refKey = (r: EntityRef): string => `${r.source}:${r.id}`;

export interface ProviderHealth {
  reachable: boolean;
  detail: string | null;
  fatal: boolean;
  checkedAt: string;
}

export interface MessagePageRequest {
  limit: number;
  before?: string;
  after?: string;
}

export interface MessagePage {
  messages: MessageView[];
  hasMore: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;
}

export type SendResult =
  | { state: 'sent' }
  | { state: 'queued'; messageId: string }
  | { state: 'error'; error: string; retryable: boolean };

export interface SubscriptionScope {
  foreground: boolean;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
}

export type ProviderUpdate =
  | { kind: 'workspaces'; source: SourceId; workspaces: WorkspaceView[] }
  | { kind: 'sessions'; source: SourceId; workspaceId: string; sessions: SessionView[] }
  | { kind: 'session'; source: SourceId; session: SessionView }
  | { kind: 'messages.appended'; source: SourceId; sessionId: string; messages: MessageView[] }
  | { kind: 'assistant.delta'; source: SourceId; sessionId: string; text: string; done: boolean }
  | { kind: 'health'; source: SourceId; health: ProviderHealth };

export interface WorkspaceProvider {
  readonly source: SourceId;
  readonly label: string; // 'This Mac' / 'Conductor Cloud'
  isConfigured(): boolean;
  probe(signal?: AbortSignal): Promise<ProviderHealth>; // must not throw
  listWorkspaces(signal?: AbortSignal): Promise<WorkspaceView[]>;
  listSessions(workspaceId: string, signal?: AbortSignal): Promise<SessionView[]>;
  listMessages(sessionId: string, page: MessagePageRequest, signal?: AbortSignal): Promise<MessagePage>;
  sendMessage(sessionId: string, text: string, idempotencyKey: string): Promise<SendResult>;
  /** The ONLY update path. Provider decides push vs poll internally. */
  subscribe(scope: SubscriptionScope, sink: (u: ProviderUpdate) => void): () => void;
  cancel?(sessionId: string): Promise<void>;
}
