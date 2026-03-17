import path from 'node:path';
import chokidar from 'chokidar';
import { bridgeEvents } from './emitter';
import * as queries from '../db/queries';
import { extractDisplayContent } from '../db/content';

interface DetectorState {
  lastMessageRowid: number;
  lastSessionUpdated: string;
  lastWorkspaceUpdated: string;
}

export function startDetector(dbPath: string) {
  const state: DetectorState = {
    lastMessageRowid: queries.getLatestMessageRowid(),
    lastSessionUpdated: '',
    lastWorkspaceUpdated: '',
  };

  const parentDir = path.dirname(dbPath);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Watch the directory containing the DB for WAL file changes
  const watcher = chokidar.watch(parentDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
  });

  watcher.on('change', () => {
    // Debounce: wait 500ms after last change before checking
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      checkChanges(state);
    }, 500);
  });

  console.log(`Change detector started, watching ${parentDir}`);

  // Fallback poll every 2 seconds
  const pollInterval = setInterval(() => {
    checkChanges(state);
  }, 2000);

  // Heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    bridgeEvents.emitBridgeEvent({ event: 'heartbeat', data: null });
  }, 30000);

  return () => {
    watcher.close();
    clearInterval(pollInterval);
    clearInterval(heartbeatInterval);
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}

function checkChanges(state: DetectorState) {
  try {
    // Check for new messages — send parsed MessageResponse (with display_content)
    const messages = queries.getMessagesAfterRowid(state.lastMessageRowid);
    for (const msg of messages) {
      bridgeEvents.emitBridgeEvent({
        event: 'message.created',
        data: {
          id: msg.id,
          session_id: msg.session_id,
          role: msg.role,
          display_content: extractDisplayContent(msg.content),
          created_at: msg.created_at,
          sent_at: msg.sent_at,
          model: msg.model,
          turn_id: msg.turn_id,
        },
      });
    }
    const newRowid = queries.getLatestMessageRowid();
    if (newRowid > state.lastMessageRowid) {
      state.lastMessageRowid = newRowid;
    }

    // Check for session updates
    const sessions = queries.getSessionsUpdatedAfter(
      state.lastSessionUpdated
    );
    for (const session of sessions) {
      bridgeEvents.emitBridgeEvent({ event: 'session.updated', data: session });
      if (session.updated_at && session.updated_at > state.lastSessionUpdated) {
        state.lastSessionUpdated = session.updated_at;
      }
    }

    // Check for workspace updates
    const workspaces = queries.getWorkspacesUpdatedAfter(
      state.lastWorkspaceUpdated
    );
    for (const ws of workspaces) {
      bridgeEvents.emitBridgeEvent({ event: 'workspace.updated', data: ws });
      if (ws.updated_at && ws.updated_at > state.lastWorkspaceUpdated) {
        state.lastWorkspaceUpdated = ws.updated_at;
      }
    }
  } catch (err) {
    console.error('Change detection error:', err);
  }
}
