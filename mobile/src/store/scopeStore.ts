import { create } from 'zustand';
import type { EntityRef } from '@conductor-companion/shared';

interface ScopeState {
  activeWorkspaceRef: EntityRef | null;
  activeSessionRef: EntityRef | null;
  setActiveSession: (workspaceRef: EntityRef, sessionRef: EntityRef) => void;
  clearActiveSession: () => void;
}

/** Tracks which workspace/session ChatView is currently mounted on, so the
 * cloud poller can run its tight active-session tier only while it matters. */
export const useScopeStore = create<ScopeState>((set) => ({
  activeWorkspaceRef: null,
  activeSessionRef: null,
  setActiveSession: (workspaceRef, sessionRef) => set({ activeWorkspaceRef: workspaceRef, activeSessionRef: sessionRef }),
  clearActiveSession: () => set({ activeWorkspaceRef: null, activeSessionRef: null }),
}));
