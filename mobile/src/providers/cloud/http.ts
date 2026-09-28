// The only file that knows beta Conductor Cloud API shapes.
// Base: https://api.conductor.build/v0. Every field is optional-chained;
// every projection is total and never throws — the API is beta
// ("Roundhouse public API 0.0.1") and `content` is typed `{}` in the spec.
//
// CLOUD_API_FIELDS_USED (keep this list current — a beta break should be a
// 5-minute diff against this comment):
//   /me: userId, email, organizationId
//   /projects: id, name
//   /projects/{id}/workspaces: id, name, branch, repoName, prTitle, updatedAt
//   /workspaces/{id}/status: status
//   /workspaces/{id}/sessions: id, title, model, contextUsedPercent, planMode, updatedAt
//   /sessions/{id}/status: status
//   /sessions/{id}/messages: id, role, content, createdAt, model
//   POST /sessions/{id}/messages: messageId, message
//   POST /sessions/{id}/cancel: (none)

const CLOUD_BASE = 'https://api.conductor.build/v0';
// The OpenAPI spec lists /me without the /v0 prefix every other path has —
// unresolved without a live Phase 0 spike; kept as a separate constant so
// fixing it is a one-line change.
const CLOUD_ME_URL = 'https://api.conductor.build/me';

export class CloudApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function cloudFetch<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${CLOUD_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new CloudApiError(`Cloud API ${response.status} on ${path}`, response.status);
  }
  return response.json();
}

export interface CloudIdentity {
  userId: string;
  email: string;
  organizationId: string;
}

export async function getMe(apiKey: string): Promise<CloudIdentity> {
  const data = await cloudFetch<any>(apiKey, CLOUD_ME_URL);
  return {
    userId: data?.userId ?? data?.id ?? '',
    email: data?.email ?? '',
    organizationId: data?.organizationId ?? '',
  };
}

export interface CloudProject {
  id: string;
  name: string;
}

export async function listProjects(apiKey: string): Promise<CloudProject[]> {
  const data = await cloudFetch<any>(apiKey, '/projects');
  const items = data?.data ?? data?.projects ?? [];
  return items.map((p: any) => ({ id: p?.id ?? '', name: p?.name ?? 'Untitled project' }));
}

export interface CloudWorkspace {
  id: string;
  projectId: string;
  name: string;
  branch: string | null;
  repoName: string | null;
  prTitle: string | null;
  updatedAt: string | null;
  status: string | null;
}

export async function listWorkspacesForProject(apiKey: string, projectId: string): Promise<CloudWorkspace[]> {
  const data = await cloudFetch<any>(apiKey, `/projects/${projectId}/workspaces`);
  const items = data?.data ?? data?.workspaces ?? [];
  return items.map((w: any) => ({
    id: w?.id ?? '',
    projectId,
    name: w?.name ?? w?.workspaceName ?? 'Untitled workspace',
    branch: w?.branch ?? null,
    repoName: w?.repoName ?? w?.repo_name ?? null,
    prTitle: w?.prTitle ?? w?.pr_title ?? null,
    updatedAt: w?.updatedAt ?? w?.updated_at ?? null,
    status: w?.status ?? null,
  }));
}

/** No list-all-workspaces endpoint exists — enumeration is P+1 requests.
 * Cap concurrency so we don't fan out unboundedly for large orgs. */
export async function listAllWorkspaces(apiKey: string, concurrency = 4): Promise<{ projects: CloudProject[]; workspaces: CloudWorkspace[] }> {
  const projects = await listProjects(apiKey);
  const workspaces: CloudWorkspace[] = [];
  let idx = 0;
  async function worker() {
    while (idx < projects.length) {
      const project = projects[idx++];
      try {
        const ws = await listWorkspacesForProject(apiKey, project.id);
        workspaces.push(...ws);
      } catch (e) {
        if (e instanceof CloudApiError && (e.status === 401 || e.status === 403)) throw e;
        // Skip a single failing project rather than failing the whole list.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, projects.length) }, worker));
  return { projects, workspaces };
}

export type CloudWorkspaceStatus = 'initializing' | 'ready' | 'sleeping' | 'archived' | 'deleted' | 'updating';

export async function getWorkspaceStatus(apiKey: string, workspaceId: string): Promise<CloudWorkspaceStatus | null> {
  const data = await cloudFetch<any>(apiKey, `/workspaces/${workspaceId}/status`);
  return data?.status ?? null;
}

export interface CloudSession {
  id: string;
  workspaceId: string;
  title: string | null;
  model: string | null;
  contextUsedPercent: number | null;
  planMode: boolean;
  updatedAt: string | null;
  status: string | null;
}

export async function listSessions(apiKey: string, workspaceId: string): Promise<CloudSession[]> {
  const data = await cloudFetch<any>(apiKey, `/workspaces/${workspaceId}/sessions`);
  const items = data?.data ?? data?.sessions ?? [];
  return items.map((s: any) => ({
    id: s?.id ?? '',
    workspaceId,
    title: s?.title ?? null,
    model: s?.model ?? null,
    contextUsedPercent: s?.contextUsedPercent ?? s?.context_used_percent ?? null,
    planMode: Boolean(s?.planMode ?? s?.plan_mode),
    updatedAt: s?.updatedAt ?? s?.updated_at ?? null,
    status: s?.status ?? null,
  }));
}

export type CloudSessionStatus = 'idle' | 'working' | 'error';

export async function getSessionStatus(apiKey: string, sessionId: string): Promise<CloudSessionStatus | null> {
  const data = await cloudFetch<any>(apiKey, `/sessions/${sessionId}/status`);
  return data?.status ?? null;
}

export interface CloudMessage {
  id: string;
  role: string | null;
  content: unknown;
  createdAt: string | null;
  model: string | null;
}

export async function listMessages(
  apiKey: string,
  sessionId: string,
  opts: { after?: string; before?: string; limit: number }
): Promise<{ messages: CloudMessage[]; hasMore: boolean }> {
  const params = new URLSearchParams({ limit: String(opts.limit) });
  if (opts.after) params.set('after', opts.after);
  if (opts.before) params.set('before', opts.before);
  const data = await cloudFetch<any>(apiKey, `/sessions/${sessionId}/messages?${params}`);
  const items = data?.data ?? data?.messages ?? [];
  return {
    messages: items.map((m: any) => ({
      id: m?.id ?? '',
      role: m?.role ?? null,
      content: m?.content,
      createdAt: m?.createdAt ?? m?.created_at ?? null,
      model: m?.model ?? null,
    })),
    hasMore: Boolean(data?.hasMore ?? data?.has_more),
  };
}

export async function sendMessage(
  apiKey: string,
  sessionId: string,
  messageId: string,
  message: string
): Promise<void> {
  await cloudFetch(apiKey, `/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ messageId, message }),
  });
}

export async function cancelSession(apiKey: string, sessionId: string): Promise<void> {
  await cloudFetch(apiKey, `/sessions/${sessionId}/cancel`, { method: 'POST' });
}
