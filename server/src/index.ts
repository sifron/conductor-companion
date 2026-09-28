import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import fs from 'node:fs';
import os from 'node:os';
import dgram from 'node:dgram';

import { loadOrCreateConfig } from './config';
import { authMiddleware } from './middleware/auth';
import { openDatabase } from './db/index';
import { healthRoutes } from './routes/health';
import { workspaceRoutes } from './routes/workspaces';
import { sessionRoutes } from './routes/sessions';
import { setupRoutes } from './routes/setup';
import { startDetector } from './events/detector';
import { setupWebSocket } from './ws';

function getLocalIp(): string {
  try {
    const socket = dgram.createSocket('udp4');
    socket.connect(80, '8.8.8.8');
    const addr = socket.address() as { address: string };
    socket.close();
    return addr.address;
  } catch {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) return addr.address;
      }
    }
    return 'localhost';
  }
}

const config = loadOrCreateConfig();

// Validate DB exists
if (!fs.existsSync(config.conductor_db_path)) {
  console.error(
    `Conductor database not found at ${config.conductor_db_path}`
  );
  console.error(
    'Make sure Conductor is installed and has been run at least once.'
  );
  process.exit(1);
}

// Open database
openDatabase(config.conductor_db_path);

// Start change detector
startDetector(config.conductor_db_path);

// Build Hono app
const app = new Hono();

app.use('*', cors());
app.use('*', authMiddleware(config.auth_token));

app.route('/', healthRoutes(config));
app.route('/', workspaceRoutes());
app.route('/', sessionRoutes());
app.route('/', setupRoutes(config));

// Start server
const server = serve(
  {
    fetch: app.fetch,
    hostname: config.bind_address,
    port: config.port,
  },
  (info) => {
    const ip = getLocalIp();
    console.log('========================================');
    console.log(`  Conductor Companion Server v0.1.0`);
    console.log(`  Local:  http://localhost:${config.port}`);
    console.log(`  LAN:    http://${ip}:${config.port}`);
    console.log(`  Setup:  http://${ip}:${config.port}/setup`);
    console.log(`  Passcode: ${config.auth_token}`);
    console.log('========================================');
  }
);

// Attach WebSocket to the HTTP server
setupWebSocket(server as any, config);
