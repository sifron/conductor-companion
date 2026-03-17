import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import { bridgeEvents } from './events/emitter';
import type { Config } from './config';

export function setupWebSocket(server: Server, config: Config) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests manually
  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    if (url.pathname !== '/api/ws') {
      socket.destroy();
      return;
    }

    // Authenticate via query param
    const token = url.searchParams.get('token');
    if (token !== config.auth_token) {
      console.warn('WebSocket connection rejected: invalid token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    // Forward bridge events to this client
    const unsubscribe = bridgeEvents.onBridgeEvent((event) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      unsubscribe();
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      unsubscribe();
    });
  });

  return wss;
}
