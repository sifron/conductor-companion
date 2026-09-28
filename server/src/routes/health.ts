import { Hono } from 'hono';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import type { Config } from '../config';
import type { HealthResponse } from '@conductor-companion/shared';

export function healthRoutes(config: Config) {
  const app = new Hono();

  app.get('/api/health', (c) => {
    console.log('Health check requested from', c.req.header('user-agent'));
    const dbExists = fs.existsSync(config.conductor_db_path);

    let dbLastModified: string | null = null;
    if (dbExists) {
      try {
        const stat = fs.statSync(config.conductor_db_path);
        dbLastModified = stat.mtime.toISOString();
      } catch {
        // ignore
      }
    }

    const conductorRunning = isConductorRunning();

    const response: HealthResponse = {
      status: 'ok',
      version: '0.1.0',
      conductor_db_exists: dbExists,
      conductor_db_last_modified: dbLastModified,
      conductor_running: conductorRunning,
    };

    return c.json(response);
  });

  return app;
}

function isConductorRunning(): boolean {
  try {
    const output = execSync('pgrep -fi conductor', {
      encoding: 'utf-8',
      timeout: 2000,
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}
