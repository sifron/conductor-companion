import { randomUUID } from 'node:crypto';
import { getDb, getWriteDb } from './index';
import { extractDisplayContent } from './content';
import type {
  Repo,
  Workspace,
  WorkspaceResponse,
  Session,
  SessionMessage,
  MessageResponse,
} from '@conductor-companion/shared';

export function listWorkspaces(): WorkspaceResponse[] {
  const db = getDb();
  const workspaces = db
    .prepare('SELECT * FROM workspaces ORDER BY updated_at DESC')
    .all() as Workspace[];

  return workspaces.map((ws) => {
    const repo = ws.repository_id
      ? (db
          .prepare('SELECT * FROM repos WHERE id = ?')
          .get(ws.repository_id) as Repo | undefined)
      : undefined;

    const sessionCount = (
      db
        .prepare(
          'SELECT COUNT(*) as count FROM sessions WHERE workspace_id = ? AND (is_hidden IS NULL OR is_hidden = 0)'
        )
        .get(ws.id) as { count: number }
    ).count;

    let activeSessionStatus: string | null = null;
    if (ws.active_session_id) {
      const session = db
        .prepare('SELECT status FROM sessions WHERE id = ?')
        .get(ws.active_session_id) as { status: string | null } | undefined;
      activeSessionStatus = session?.status ?? null;
    }

    return {
      ...ws,
      repo_name: repo?.name ?? null,
      repo_remote_url: repo?.remote_url ?? null,
      active_session_status: activeSessionStatus,
      session_count: sessionCount,
    };
  });
}

export function getWorkspace(id: string): WorkspaceResponse | null {
  const db = getDb();
  const ws = db
    .prepare('SELECT * FROM workspaces WHERE id = ?')
    .get(id) as Workspace | undefined;

  if (!ws) return null;

  const repo = ws.repository_id
    ? (db
        .prepare('SELECT * FROM repos WHERE id = ?')
        .get(ws.repository_id) as Repo | undefined)
    : undefined;

  const sessionCount = (
    db
      .prepare(
        'SELECT COUNT(*) as count FROM sessions WHERE workspace_id = ? AND (is_hidden IS NULL OR is_hidden = 0)'
      )
      .get(ws.id) as { count: number }
  ).count;

  let activeSessionStatus: string | null = null;
  if (ws.active_session_id) {
    const session = db
      .prepare('SELECT status FROM sessions WHERE id = ?')
      .get(ws.active_session_id) as { status: string | null } | undefined;
    activeSessionStatus = session?.status ?? null;
  }

  return {
    ...ws,
    repo_name: repo?.name ?? null,
    repo_remote_url: repo?.remote_url ?? null,
    active_session_status: activeSessionStatus,
    session_count: sessionCount,
  };
}

export function listSessions(workspaceId: string): Session[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM sessions WHERE workspace_id = ? AND (is_hidden IS NULL OR is_hidden = 0) ORDER BY updated_at DESC'
    )
    .all(workspaceId) as Session[];
}

export function getSession(id: string): Session | null {
  const db = getDb();
  return (
    (db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | Session
      | undefined) ?? null
  );
}

export function listMessages(
  sessionId: string,
  limit: number,
  before?: string
): MessageResponse[] {
  const db = getDb();

  let rows: SessionMessage[];
  if (before) {
    rows = db
      .prepare(
        'SELECT * FROM session_messages WHERE session_id = ? AND rowid < (SELECT rowid FROM session_messages WHERE id = ?) ORDER BY rowid DESC LIMIT ?'
      )
      .all(sessionId, before, limit) as SessionMessage[];
  } else {
    rows = db
      .prepare(
        'SELECT * FROM session_messages WHERE session_id = ? ORDER BY rowid DESC LIMIT ?'
      )
      .all(sessionId, limit) as SessionMessage[];
  }

  return rows.map((msg) => ({
    id: msg.id,
    session_id: msg.session_id,
    role: msg.role,
    display_content: extractDisplayContent(msg.content),
    created_at: msg.created_at,
    sent_at: msg.sent_at,
    model: msg.model,
    turn_id: msg.turn_id,
  }));
}

// --- Session with workspace path (for Claude CLI) ---

export interface SessionWithPath {
  session_id: string;
  claude_session_id: string | null;
  status: string | null;
  workspace_path: string | null;
}

export function getSessionWithWorkspacePath(sessionId: string): SessionWithPath | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        s.id as session_id,
        s.claude_session_id,
        s.status,
        CASE
          WHEN r.root_path IS NOT NULL AND w.directory_name IS NOT NULL
          THEN REPLACE(r.root_path, '/repos/', '/workspaces/') || '/' || w.directory_name
          WHEN r.root_path IS NOT NULL
          THEN r.root_path
          ELSE NULL
        END as workspace_path
      FROM sessions s
      LEFT JOIN workspaces w ON s.workspace_id = w.id
      LEFT JOIN repos r ON w.repository_id = r.id
      WHERE s.id = ?`
    )
    .get(sessionId) as SessionWithPath | undefined;
  return row ?? null;
}

// --- Change detection queries ---

export function getLatestMessageRowid(): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COALESCE(MAX(rowid), 0) as max_rowid FROM session_messages')
    .get() as { max_rowid: number };
  return row.max_rowid;
}

export function getMessagesAfterRowid(afterRowid: number): SessionMessage[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM session_messages WHERE rowid > ? ORDER BY rowid ASC'
    )
    .all(afterRowid) as SessionMessage[];
}

export function getSessionsUpdatedAfter(after: string): Session[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM sessions WHERE updated_at > ? ORDER BY updated_at ASC'
    )
    .all(after) as Session[];
}

export function getWorkspacesUpdatedAfter(after: string): Workspace[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM workspaces WHERE updated_at > ? ORDER BY updated_at ASC'
    )
    .all(after) as Workspace[];
}

// --- Write operations (insert into Conductor's DB) ---

export function insertSessionMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  turnId: string,
): string {
  const db = getWriteDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO session_messages (id, session_id, role, content, created_at, sent_at, turn_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, sessionId, role, content, now, now, turnId);

  return id;
}
