import { Hono } from 'hono';
import { html } from 'hono/html';
import QRCode from 'qrcode';
import os from 'node:os';
import dgram from 'node:dgram';
import type { Config } from '../config';

export function setupRoutes(config: Config) {
  const app = new Hono();

  app.get('/setup', async (c) => {
    const localIp = getLocalIp() || 'localhost';

    const connectionInfo = JSON.stringify({
      host: localIp,
      port: config.port,
      token: config.auth_token,
    });

    let qrSvg: string;
    try {
      qrSvg = await QRCode.toString(connectionInfo, { type: 'svg' });
    } catch {
      qrSvg = '<p>Failed to generate QR code</p>';
    }

    return c.html(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Conductor Companion Setup</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
        }
        .container {
            text-align: center;
            max-width: 500px;
            padding: 2rem;
        }
        h1 {
            color: #fff;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: #888;
            margin-bottom: 2rem;
        }
        .qr-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            display: inline-block;
            margin: 1rem 0;
        }
        .qr-container svg {
            width: 256px;
            height: 256px;
        }
        .info {
            background: #16213e;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
            text-align: left;
            font-family: monospace;
            font-size: 0.9rem;
        }
        .info .label {
            color: #888;
            font-size: 0.8rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Conductor Companion</h1>
        <p class="subtitle">Scan this QR code with the mobile app to connect</p>
        <div class="qr-container">
            ${qrSvg}
        </div>
        <div class="info">
            <div class="label">Server Address</div>
            <div>${localIp}:${config.port}</div>
            <br>
            <div class="label">Passcode</div>
            <div>${config.auth_token}</div>
        </div>
    </div>
</body>
</html>`);
  });

  return app;
}

function getLocalIp(): string | null {
  try {
    const socket = dgram.createSocket('udp4');
    socket.connect(80, '8.8.8.8');
    const address = socket.address() as { address: string };
    socket.close();
    return address.address;
  } catch {
    // Fallback: scan network interfaces
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
      if (!iface) continue;
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
    return null;
  }
}
