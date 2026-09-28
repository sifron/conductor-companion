import type { Session, MessageResponse, Workspace } from './models';

export interface MessageCreatedEvent {
  event: 'message.created';
  data: MessageResponse;
}

export interface SessionUpdatedEvent {
  event: 'session.updated';
  data: Session;
}

export interface WorkspaceUpdatedEvent {
  event: 'workspace.updated';
  data: Workspace;
}

export interface HeartbeatEvent {
  event: 'heartbeat';
  data: null;
}

export interface AssistantStreamEvent {
  event: 'assistant.streaming';
  data: {
    session_id: string;
    content: string;
    done: boolean;
  };
}

export type BridgeEvent =
  | MessageCreatedEvent
  | SessionUpdatedEvent
  | WorkspaceUpdatedEvent
  | HeartbeatEvent
  | AssistantStreamEvent;
