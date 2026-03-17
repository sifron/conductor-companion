import type { MiddlewareHandler } from 'hono';

export function authMiddleware(authToken: string): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path;

    // Exempt public endpoints
    if (path === '/api/health' || path === '/setup') {
      return next();
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice(7);
    if (token !== authToken) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return next();
  };
}
