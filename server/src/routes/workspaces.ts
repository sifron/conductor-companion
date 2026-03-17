import { Hono } from 'hono';
import * as queries from '../db/queries';

export function workspaceRoutes() {
  const app = new Hono();

  app.get('/api/workspaces', (c) => {
    const workspaces = queries.listWorkspaces();
    return c.json({ workspaces });
  });

  app.get('/api/workspaces/:id', (c) => {
    const id = c.req.param('id');
    const workspace = queries.getWorkspace(id);
    if (!workspace) {
      return c.json({ error: 'Not found' }, 404);
    }
    return c.json({ workspace });
  });

  return app;
}
