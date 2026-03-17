import { Hono } from 'hono';
import * as queries from '../db/queries';
import { sendMessage, isSessionBusy } from '../claude';
import type { SendMessageRequest, SendMessageResponse } from '@conductor-companion/shared';

export function sessionRoutes() {
  const app = new Hono();

  app.get('/api/workspaces/:workspaceId/sessions', (c) => {
    const workspaceId = c.req.param('workspaceId');
    const sessions = queries.listSessions(workspaceId);
    return c.json({ sessions });
  });

  app.get('/api/sessions/:id', (c) => {
    const id = c.req.param('id');
    const session = queries.getSession(id);
    if (!session) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ session });
  });

  app.get('/api/sessions/:id/messages', (c) => {
    const id = c.req.param('id');
    const limit = Math.min(Number(c.req.query('limit') || 50), 200);
    const before = c.req.query('before');
    const messages = queries.listMessages(id, limit, before || undefined);
    return c.json({
      messages,
      has_more: messages.length === limit,
    });
  });

  app.post('/api/sessions/:id/messages', async (c) => {
    const id = c.req.param('id');

    const body = await c.req.json<SendMessageRequest>();
    if (!body.content || body.content.trim() === '') {
      return c.json<SendMessageResponse>({ status: 'error', error: 'Message content is required' }, 400);
    }

    // Look up session with workspace path
    const sessionInfo = queries.getSessionWithWorkspacePath(id);
    if (!sessionInfo) {
      return c.json<SendMessageResponse>({ status: 'error', error: 'Session not found' }, 404);
    }

    if (!sessionInfo.claude_session_id) {
      return c.json<SendMessageResponse>({ status: 'error', error: 'Session has no Claude session ID' }, 400);
    }

    if (!sessionInfo.workspace_path) {
      return c.json<SendMessageResponse>({ status: 'error', error: 'Could not determine workspace path' }, 400);
    }

    // Check if session is busy (either in DB or we have an active process)
    if (sessionInfo.status === 'working') {
      return c.json<SendMessageResponse>({ status: 'error', error: 'Session is currently working' }, 409);
    }

    if (isSessionBusy(id)) {
      return c.json<SendMessageResponse>({ status: 'error', error: 'A message is already being processed' }, 409);
    }

    // Fire and forget — the Claude process runs in the background
    // and emits events via WebSocket as it streams
    console.log(`[sessions] Sending message to session ${id} (claude: ${sessionInfo.claude_session_id})`);
    sendMessage(id, sessionInfo.claude_session_id, sessionInfo.workspace_path, body.content.trim())
      .then(() => console.log(`[sessions] Claude process completed for session ${id}`))
      .catch((err) => console.error(`[sessions] Claude process failed for session ${id}:`, err));

    return c.json<SendMessageResponse>({ status: 'sent' });
  });

  return app;
}
