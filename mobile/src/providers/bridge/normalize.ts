import type {
  Workspace,
  WorkspaceResponse,
  Session,
  MessageResponse,
  WorkspaceView,
  SessionView,
  MessageView,
  MessageKind,
  EntityStatus,
} from '@conductor-companion/shared';

const BRIDGE_CAPS = { canSendMessage: true, canCancel: false, streams: true };

function toEntityStatus(status: string | null): EntityStatus {
  switch (status) {
    case 'working':
    case 'idle':
    case 'error':
      return status;
    default:
      return 'unknown';
  }
}

export function workspaceToView(ws: WorkspaceResponse): WorkspaceView {
  return {
    ref: { source: 'bridge', id: ws.id },
    name: ws.workspace_name ?? ws.directory_name ?? ws.id.slice(0, 8),
    repoName: ws.repo_name,
    branch: ws.branch,
    status: toEntityStatus(ws.active_session_status ?? ws.derived_status),
    sessionCount: ws.session_count,
    prTitle: ws.pr_title,
    updatedAt: ws.updated_at,
    deepLink: null,
    isRemote: false,
    capabilities: BRIDGE_CAPS,
  };
}

/** Raw `workspace.updated` events lack the joined fields WorkspaceResponse
 * has (repo, session count) — the periodic fetchWorkspaces() refresh
 * reconciles those; this keeps status/name updates from being dropped. */
export function rawWorkspaceToView(ws: Workspace): WorkspaceView {
  return {
    ref: { source: 'bridge', id: ws.id },
    name: ws.workspace_name ?? ws.directory_name ?? ws.id.slice(0, 8),
    repoName: null,
    branch: ws.branch,
    status: toEntityStatus(ws.derived_status),
    sessionCount: null,
    prTitle: ws.pr_title,
    updatedAt: ws.updated_at,
    deepLink: null,
    isRemote: false,
    capabilities: BRIDGE_CAPS,
  };
}

export function sessionToView(s: Session, workspaceId: string): SessionView {
  return {
    ref: { source: 'bridge', id: s.id },
    workspaceRef: { source: 'bridge', id: workspaceId },
    title: s.title ?? 'Untitled Session',
    status: toEntityStatus(s.status),
    model: s.model,
    contextUsedPercent: s.context_used_percent,
    planMode: s.permission_mode === 'plan',
    lastActivityAt: s.last_user_message_at ?? s.updated_at,
    capabilities: BRIDGE_CAPS,
  };
}

const TOOL_RESULT_PREFIXES = ['[{"tool_use_id"', '[{"type":"tool_result"'];

function classifyBridgeText(content: string): { kind: MessageKind; text: string } {
  const trimmed = content.trim();
  if (trimmed === '') return { kind: 'control', text: '' };
  if (trimmed.startsWith('[Tool:')) return { kind: 'tool', text: '' };
  if (TOOL_RESULT_PREFIXES.some((p) => trimmed.startsWith(p))) return { kind: 'control', text: '' };
  if (trimmed.startsWith('{"type":"result"')) return { kind: 'control', text: '' };
  if (trimmed.startsWith('{') && trimmed.length < 300) {
    try {
      JSON.parse(trimmed);
      return { kind: 'control', text: '' };
    } catch {
      // not JSON, fall through as text
    }
  }
  return { kind: 'text', text: content };
}

export function messageToView(m: MessageResponse, sessionId: string): MessageView {
  const role = m.role === 'user' || m.role === 'assistant' || m.role === 'system' ? m.role : 'assistant';
  const { kind, text } = classifyBridgeText(m.display_content);
  return {
    ref: { source: 'bridge', id: m.id },
    sessionRef: { source: 'bridge', id: sessionId },
    role,
    kind,
    text,
    createdAt: m.sent_at ?? m.created_at,
    model: m.model,
  };
}
