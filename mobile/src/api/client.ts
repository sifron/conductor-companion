import { useConnectionStore } from '../store/connectionStore';
import type {
  HealthResponse,
  WorkspacesResponse,
  WorkspaceDetailResponse,
  SessionsResponse,
  SessionDetailResponse,
  MessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@conductor-companion/shared';

class BridgeClient {
  private getBaseUrl(): string {
    const { bridge } = useConnectionStore.getState();
    return `http://${bridge?.host}:${bridge?.port}`;
  }

  private getHeaders(): Record<string, string> {
    const { bridge } = useConnectionStore.getState();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bridge?.token ?? ''}`,
    };
  }

  async fetch<T>(path: string): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`;
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.getBaseUrl()}/api/health`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      console.log('testConnection response:', response.status);
      return response.ok;
    } catch (e) {
      console.error('testConnection error:', e);
      return false;
    }
  }

  async getWorkspaces() {
    return this.fetch<WorkspacesResponse>('/api/workspaces');
  }

  async getWorkspace(id: string) {
    return this.fetch<WorkspaceDetailResponse>(`/api/workspaces/${id}`);
  }

  async getSessions(workspaceId: string) {
    return this.fetch<SessionsResponse>(
      `/api/workspaces/${workspaceId}/sessions`
    );
  }

  async getSession(id: string) {
    return this.fetch<SessionDetailResponse>(`/api/sessions/${id}`);
  }

  async getMessages(sessionId: string, limit = 50, before?: string) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    return this.fetch<MessagesResponse>(
      `/api/sessions/${sessionId}/messages?${params}`
    );
  }

  async sendMessage(sessionId: string, content: string): Promise<SendMessageResponse> {
    const url = `${this.getBaseUrl()}/api/sessions/${sessionId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ content } satisfies SendMessageRequest),
    });
    const body = (await response.json().catch(() => null)) as SendMessageResponse | null;
    if (!response.ok) {
      return { status: 'error', error: body?.error || `HTTP ${response.status}` };
    }
    return body ?? { status: 'error', error: 'Empty response' };
  }
}

export const bridgeClient = new BridgeClient();
