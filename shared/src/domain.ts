export type SourceId = 'bridge' | 'cloud';

export interface EntityRef {
  source: SourceId;
  id: string;
}

export const refKey = (r: EntityRef): string => `${r.source}:${r.id}`;

export type EntityStatus =
  | 'working'
  | 'idle'
  | 'error'
  | 'initializing'
  | 'sleeping'
  | 'archived'
  | 'unknown';

export interface Capabilities {
  canSendMessage: boolean;
  canCancel: boolean;
  streams: boolean;
}

export interface WorkspaceView {
  ref: EntityRef;
  name: string; // never null: workspace_name ?? directory_name ?? id.slice(0,8)
  repoName: string | null;
  branch: string | null;
  status: EntityStatus;
  sessionCount: number | null; // null = unknown; cloud cannot cheaply count
  prTitle: string | null;
  updatedAt: string | null; // normalized ISO 8601
  deepLink: string | null; // cloud only
  isRemote: boolean;
  capabilities: Capabilities;
}

export interface SessionView {
  ref: EntityRef;
  workspaceRef: EntityRef;
  title: string;
  status: EntityStatus;
  model: string | null;
  contextUsedPercent: number | null;
  planMode: boolean;
  lastActivityAt: string | null;
  capabilities: Capabilities;
}

export type MessageKind = 'text' | 'tool' | 'control' | 'error' | 'unknown';

export interface MessageView {
  ref: EntityRef;
  sessionRef: EntityRef;
  role: 'user' | 'assistant' | 'system';
  kind: MessageKind;
  text: string; // '' is legal — render nothing
  createdAt: string | null;
  model: string | null;
  raw?: string; // only when kind === 'unknown'
  pending?: 'sending' | 'queued' | 'failed';
}
