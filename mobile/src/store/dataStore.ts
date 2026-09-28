import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EntityRef, WorkspaceView, SessionView, MessageView, SourceId } from '@conductor-companion/shared';
import { providers, configuredProviders } from '../providers/registry';
import { refKey } from '../providers/types';
import type { ProviderHealth, ProviderUpdate } from '../providers/types';
import { newIdempotencyKey } from '../providers/cloud/provider';

export type Workspace = WorkspaceView;
export type Session = SessionView;
export type Message = MessageView;

interface DataState {
  workspaces: Record<string, WorkspaceView>; // key = refKey
  sessions: Record<string, SessionView[]>; // key = refKey(workspaceRef)
  messages: Record<string, MessageView[]>; // key = refKey(sessionRef)
  health: Record<SourceId, ProviderHealth | null>;
  isLoading: boolean;
  lastUpdated: string | null;

  fetchWorkspaces: () => Promise<void>;
  fetchSessions: (workspaceRef: EntityRef) => Promise<void>;
  fetchMessages: (sessionRef: EntityRef, before?: string) => Promise<boolean>;
  sendMessage: (sessionRef: EntityRef, text: string) => Promise<{ success: boolean; error?: string }>;

  applyUpdate: (u: ProviderUpdate) => void;

  loadCache: () => Promise<void>;
  saveCache: () => Promise<void>;
}

const EMPTY_HEALTH: Record<SourceId, ProviderHealth | null> = { bridge: null, cloud: null };

export const useDataStore = create<DataState>((set, get) => ({
  workspaces: {},
  sessions: {},
  messages: {},
  health: EMPTY_HEALTH,
  isLoading: false,
  lastUpdated: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true });
    try {
      await Promise.all(
        configuredProviders().map(async (provider) => {
          try {
            const workspaces = await provider.listWorkspaces();
            get().applyUpdate({ kind: 'workspaces', source: provider.source, workspaces });
          } catch (e) {
            console.error(`Failed to fetch ${provider.source} workspaces:`, e);
          }
        })
      );
      set({ lastUpdated: new Date().toISOString() });
      get().saveCache();
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSessions: async (workspaceRef: EntityRef) => {
    const provider = providers[workspaceRef.source];
    try {
      const sessions = await provider.listSessions(workspaceRef.id);
      get().applyUpdate({ kind: 'sessions', source: workspaceRef.source, workspaceId: workspaceRef.id, sessions });
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  },

  fetchMessages: async (sessionRef: EntityRef, before?: string) => {
    const provider = providers[sessionRef.source];
    try {
      const page = await provider.listMessages(sessionRef.id, { limit: 50, before });
      set((state) => {
        const key = refKey(sessionRef);
        const existing = before ? state.messages[key] || [] : [];
        const merged = before ? [...page.messages, ...existing] : page.messages;
        return { messages: { ...state.messages, [key]: dedupeMessages(merged) } };
      });
      return page.hasMore;
    } catch (e) {
      console.error('Failed to fetch messages:', e);
      return false;
    }
  },

  sendMessage: async (sessionRef: EntityRef, text: string) => {
    const provider = providers[sessionRef.source];
    const idempotencyKey = newIdempotencyKey();

    const optimistic: MessageView = {
      ref: { source: sessionRef.source, id: idempotencyKey },
      sessionRef,
      role: 'user',
      kind: 'text',
      text,
      createdAt: new Date().toISOString(),
      model: null,
      pending: 'sending',
    };
    get().applyUpdate({ kind: 'messages.appended', source: sessionRef.source, sessionId: sessionRef.id, messages: [optimistic] });

    try {
      const result = await provider.sendMessage(sessionRef.id, text, idempotencyKey);
      if (result.state === 'error') {
        set((state) => {
          const key = refKey(sessionRef);
          const list = state.messages[key] || [];
          return {
            messages: {
              ...state.messages,
              [key]: list.map((m) => (m.ref.id === idempotencyKey ? { ...m, pending: 'failed' } : m)),
            },
          };
        });
        return { success: false, error: result.error };
      }
      set((state) => {
        const key = refKey(sessionRef);
        const list = state.messages[key] || [];
        return {
          messages: {
            ...state.messages,
            [key]: list.map((m) => (m.ref.id === idempotencyKey ? { ...m, pending: undefined } : m)),
          },
        };
      });
      return { success: true };
    } catch (e: any) {
      set((state) => {
        const key = refKey(sessionRef);
        const list = state.messages[key] || [];
        return {
          messages: {
            ...state.messages,
            [key]: list.map((m) => (m.ref.id === idempotencyKey ? { ...m, pending: 'failed' } : m)),
          },
        };
      });
      return { success: false, error: e.message || 'Failed to send message' };
    }
  },

  applyUpdate: (u: ProviderUpdate) => {
    switch (u.kind) {
      case 'workspaces': {
        set((state) => {
          const workspaces = { ...state.workspaces };
          for (const ws of u.workspaces) workspaces[refKey(ws.ref)] = ws;
          return { workspaces };
        });
        break;
      }
      case 'sessions': {
        set((state) => ({
          sessions: { ...state.sessions, [refKey({ source: u.source, id: u.workspaceId })]: u.sessions },
        }));
        break;
      }
      case 'session': {
        set((state) => {
          const key = refKey(u.session.workspaceRef);
          const list = state.sessions[key] || [];
          const idx = list.findIndex((s) => s.ref.id === u.session.ref.id);
          const updated = idx >= 0 ? list.map((s, i) => (i === idx ? u.session : s)) : [...list, u.session];
          return { sessions: { ...state.sessions, [key]: updated } };
        });
        break;
      }
      case 'messages.appended': {
        set((state) => {
          const key = refKey({ source: u.source, id: u.sessionId });
          const existing = state.messages[key] || [];
          const merged = dedupeMessages([...existing, ...u.messages]);
          return { messages: { ...state.messages, [key]: merged } };
        });
        break;
      }
      case 'assistant.delta': {
        set((state) => {
          const key = refKey({ source: u.source, id: u.sessionId });
          const existing = state.messages[key] || [];
          const streamId = `streaming-${u.sessionId}`;
          const idx = existing.findIndex((m) => m.ref.id === streamId);

          if (u.done) {
            if (idx >= 0) {
              const updated = [...existing];
              updated[idx] = { ...updated[idx], ref: { source: u.source, id: `stream-done-${streamId}` } };
              return { messages: { ...state.messages, [key]: updated } };
            }
            return state;
          }

          if (idx >= 0) {
            const updated = [...existing];
            updated[idx] = { ...updated[idx], text: updated[idx].text + u.text };
            return { messages: { ...state.messages, [key]: updated } };
          }

          const streamMsg: MessageView = {
            ref: { source: u.source, id: streamId },
            sessionRef: { source: u.source, id: u.sessionId },
            role: 'assistant',
            kind: 'text',
            text: u.text,
            createdAt: new Date().toISOString(),
            model: null,
          };
          return { messages: { ...state.messages, [key]: [...existing, streamMsg] } };
        });
        break;
      }
      case 'health': {
        set((state) => ({ health: { ...state.health, [u.source]: u.health } }));
        break;
      }
    }
  },

  loadCache: async () => {
    try {
      const cached = await AsyncStorage.getItem('companion_cache');
      if (cached) {
        const data = JSON.parse(cached);
        set({
          workspaces: data.workspaces || {},
          lastUpdated: data.lastUpdated,
        });
      }
    } catch {
      // Ignore cache errors
    }
  },

  saveCache: async () => {
    try {
      const { workspaces, lastUpdated } = get();
      await AsyncStorage.setItem('companion_cache', JSON.stringify({ workspaces, lastUpdated }));
    } catch {
      // Ignore cache errors
    }
  },
}));

/** A stream placeholder gets renamed on `done` rather than removed — the
 * real message arrives with a different id, so dedupe by (session, text,
 * approx time) would be wrong. Dedupe by ref id only. */
function dedupeMessages(messages: MessageView[]): MessageView[] {
  const seen = new Set<string>();
  const out: MessageView[] = [];
  for (const m of messages) {
    const key = refKey(m.ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}
