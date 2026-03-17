import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bridgeClient } from '../api/client';
import type {
  Workspace as SharedWorkspace,
  WorkspaceResponse,
  Session as SharedSession,
  MessageResponse,
} from '@conductor-companion/shared';

export type Workspace = WorkspaceResponse;
export type Session = SharedSession;
export type Message = MessageResponse;

interface DataState {
  workspaces: Workspace[];
  sessions: Record<string, Session[]>;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  lastUpdated: string | null;

  fetchWorkspaces: () => Promise<void>;
  fetchSessions: (workspaceId: string) => Promise<void>;
  fetchMessages: (sessionId: string, before?: string) => Promise<boolean>;
  sendMessage: (sessionId: string, content: string) => Promise<{ success: boolean; error?: string }>;

  updateWorkspace: (workspace: SharedWorkspace) => void;
  updateSession: (session: Session) => void;
  addMessage: (message: Message) => void;
  appendStreamContent: (sessionId: string, content: string, done: boolean) => void;

  loadCache: () => Promise<void>;
  saveCache: () => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  workspaces: [],
  sessions: {},
  messages: {},
  isLoading: false,
  lastUpdated: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const data = await bridgeClient.getWorkspaces();
      set({
        workspaces: data.workspaces,
        lastUpdated: new Date().toISOString(),
      });
      get().saveCache();
    } catch (e) {
      console.error('Failed to fetch workspaces:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSessions: async (workspaceId: string) => {
    try {
      const data = await bridgeClient.getSessions(workspaceId);
      set((state) => ({
        sessions: { ...state.sessions, [workspaceId]: data.sessions },
      }));
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  },

  fetchMessages: async (sessionId: string, before?: string) => {
    try {
      const data = await bridgeClient.getMessages(sessionId, 50, before);
      set((state) => {
        const existing = before ? state.messages[sessionId] || [] : [];
        // Messages come in reverse order (newest first), prepend older ones
        const combined = before
          ? [...data.messages.reverse(), ...existing]
          : data.messages.reverse();
        return {
          messages: { ...state.messages, [sessionId]: combined },
        };
      });
      return data.has_more;
    } catch (e) {
      console.error('Failed to fetch messages:', e);
      return false;
    }
  },

  sendMessage: async (sessionId: string, content: string) => {
    // Optimistically add user message to local state
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      display_content: content,
      created_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      model: null,
      turn_id: null,
    };
    get().addMessage(optimisticMsg);

    try {
      const result = await bridgeClient.sendMessage(sessionId, content);
      if (result.status === 'error') {
        return { success: false, error: result.error };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Failed to send message:', e);
      return { success: false, error: e.message || 'Failed to send message' };
    }
  },

  updateWorkspace: (workspace: SharedWorkspace) => {
    set((state) => ({
      workspaces: state.workspaces.map((ws) =>
        ws.id === workspace.id ? { ...ws, ...workspace } : ws
      ),
    }));
  },

  updateSession: (session: Session) => {
    set((state) => {
      const newSessions = { ...state.sessions };
      for (const [wsId, sessionList] of Object.entries(newSessions)) {
        newSessions[wsId] = sessionList.map((s) =>
          s.id === session.id ? { ...s, ...session } : s
        );
      }
      return { sessions: newSessions };
    });
  },

  addMessage: (message: Message) => {
    const sessionId = message.session_id;
    if (!sessionId) return;
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      // Avoid duplicates
      if (sessionMessages.some((m: Message) => m.id === message.id)) return state;
      return {
        messages: {
          ...state.messages,
          [sessionId]: [...sessionMessages, message],
        },
      };
    });
  },

  appendStreamContent: (sessionId: string, content: string, done: boolean) => {
    set((state) => {
      const sessionMessages = state.messages[sessionId] || [];
      const streamId = `streaming-${sessionId}`;
      const existingIdx = sessionMessages.findIndex((m) => m.id === streamId);

      if (done) {
        // Remove the streaming placeholder — the final message will arrive via WAL watcher
        // or is already complete in the result event
        if (existingIdx >= 0) {
          const finalMsg = sessionMessages[existingIdx];
          const updated = [...sessionMessages];
          // Replace streaming ID with a stable one so it persists
          updated[existingIdx] = { ...finalMsg, id: `stream-done-${Date.now()}` };
          return { messages: { ...state.messages, [sessionId]: updated } };
        }
        return state;
      }

      if (existingIdx >= 0) {
        // Append to existing streaming message
        const updated = [...sessionMessages];
        const existing = updated[existingIdx];
        updated[existingIdx] = {
          ...existing,
          display_content: (existing.display_content || '') + content,
        };
        return { messages: { ...state.messages, [sessionId]: updated } };
      }

      // Create new streaming assistant message
      const streamMsg: Message = {
        id: streamId,
        session_id: sessionId,
        role: 'assistant',
        display_content: content,
        created_at: new Date().toISOString(),
        sent_at: null,
        model: null,
        turn_id: null,
      };
      return {
        messages: { ...state.messages, [sessionId]: [...sessionMessages, streamMsg] },
      };
    });
  },

  loadCache: async () => {
    try {
      const cached = await AsyncStorage.getItem('companion_cache');
      if (cached) {
        const data = JSON.parse(cached);
        set({
          workspaces: data.workspaces || [],
          lastUpdated: data.lastUpdated,
        });
      }
    } catch (e) {
      // Ignore cache errors
    }
  },

  saveCache: async () => {
    try {
      const { workspaces, lastUpdated } = get();
      await AsyncStorage.setItem(
        'companion_cache',
        JSON.stringify({ workspaces, lastUpdated })
      );
    } catch (e) {
      // Ignore cache errors
    }
  },
}));
