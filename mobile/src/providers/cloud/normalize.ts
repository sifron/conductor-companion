import type { WorkspaceView, SessionView, MessageView, EntityStatus, Capabilities } from '@conductor-companion/shared';
import { classifyContent } from '../../api/content';
import type { CloudWorkspace, CloudSession, CloudMessage } from './http';

const CLOUD_CAPS: Capabilities = { canSendMessage: true, canCancel: true, streams: false };

function toEntityStatus(status: string | null): EntityStatus {
  switch (status) {
    case 'working':
    case 'idle':
    case 'error':
    case 'initializing':
    case 'sleeping':
    case 'archived':
      return status;
    case 'updating':
      return 'working';
    case 'deleted':
      return 'archived';
    default:
      return 'unknown';
  }
}

export function cloudWorkspaceToView(ws: CloudWorkspace): WorkspaceView {
  return {
    ref: { source: 'cloud', id: ws.id },
    name: ws.name,
    repoName: ws.repoName,
    branch: ws.branch,
    status: toEntityStatus(ws.status),
    sessionCount: null, // cloud cannot cheaply count
    prTitle: ws.prTitle,
    updatedAt: ws.updatedAt,
    deepLink: `https://app.conductor.build/workspaces/${ws.id}`,
    isRemote: true,
    capabilities: CLOUD_CAPS,
  };
}

export function cloudSessionToView(s: CloudSession): SessionView {
  return {
    ref: { source: 'cloud', id: s.id },
    workspaceRef: { source: 'cloud', id: s.workspaceId },
    title: s.title ?? 'Untitled Session',
    status: toEntityStatus(s.status),
    model: s.model,
    contextUsedPercent: s.contextUsedPercent,
    planMode: s.planMode,
    lastActivityAt: s.updatedAt,
    capabilities: CLOUD_CAPS,
  };
}

export function cloudMessageToView(m: CloudMessage, sessionId: string): MessageView {
  const fallbackRole = m.role === 'user' || m.role === 'assistant' || m.role === 'system' ? m.role : 'assistant';
  const classified = classifyContent(m.content, fallbackRole);
  return {
    ref: { source: 'cloud', id: m.id },
    sessionRef: { source: 'cloud', id: sessionId },
    role: classified.role,
    kind: classified.kind,
    text: classified.text,
    createdAt: m.createdAt,
    model: m.model,
    raw: classified.raw,
  };
}
