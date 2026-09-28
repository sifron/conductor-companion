import type { WorkspaceResponse, Session, MessageResponse } from './models';

export interface HealthResponse {
  status: string;
  version: string;
  conductor_db_exists: boolean;
  conductor_db_last_modified: string | null;
  conductor_running: boolean;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceResponse[];
}

export interface WorkspaceDetailResponse {
  workspace: WorkspaceResponse;
}

export interface SessionsResponse {
  sessions: Session[];
}

export interface SessionDetailResponse {
  session: Session;
}

export interface MessagesResponse {
  messages: MessageResponse[];
  has_more: boolean;
}

export interface SendMessageRequest {
  content: string;
}

export interface SendMessageResponse {
  status: 'sent' | 'error';
  error?: string;
}
