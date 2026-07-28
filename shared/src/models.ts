export interface Repo {
  id: string;
  remote_url: string | null;
  name: string | null;
  root_path: string | null;
  default_branch: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Workspace {
  id: string;
  repository_id: string | null;
  directory_name: string | null;
  branch: string | null;
  state: string | null;
  active_session_id: string | null;
  unread: number | null;
  derived_status: string | null;
  pr_title: string | null;
  pr_description: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  pinned_at: string | null;
  workspace_path: string | null;
  sandbox_provider: string | null;
  hosting_server_url: string | null;
  workspace_name: string | null;
}

export interface WorkspaceResponse extends Workspace {
  repo_name: string | null;
  repo_remote_url: string | null;
  active_session_status: string | null;
  session_count: number;
  origin?: 'desktop' | 'cloud';
}

export interface Session {
  id: string;
  workspace_id: string | null;
  status: string | null;
  claude_session_id: string | null;
  model: string | null;
  permission_mode: string | null;
  title: string | null;
  context_used_percent: number | null;
  thinking_enabled: number | null;
  fast_mode: number | null;
  is_compacting: number | null;
  is_hidden: number | null;
  last_user_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SessionMessage {
  id: string;
  session_id: string | null;
  role: string | null;
  content: string | null;
  created_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  model: string | null;
  turn_id: string | null;
}

export interface MessageResponse {
  id: string;
  session_id: string | null;
  role: string | null;
  display_content: string;
  created_at: string | null;
  sent_at: string | null;
  model: string | null;
  turn_id: string | null;
}
