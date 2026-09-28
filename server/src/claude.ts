import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { bridgeEvents } from './events/emitter';
import { insertSessionMessage } from './db/queries';

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Resolve claude CLI path at startup: symlink → real path → invoke via node
const claudeScript = realpathSync(
  execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim()
);

// Track active processes per session to prevent concurrent sends
const activeProcesses = new Map<string, ChildProcess>();

export function isSessionBusy(sessionId: string): boolean {
  return activeProcesses.has(sessionId);
}

export async function sendMessage(
  sessionId: string,
  claudeSessionId: string,
  workspacePath: string,
  message: string
): Promise<void> {
  if (activeProcesses.has(sessionId)) {
    throw new Error('A message is already being processed for this session');
  }

  const args = [
    '--resume', claudeSessionId,
    '-p', message,
    '--output-format', 'stream-json',
    '--verbose',
  ];

  console.log(`[claude] Spawning: node ${claudeScript} ${args.join(' ')}`);
  console.log(`[claude] cwd: ${workspacePath}`);

  const proc = spawn(process.execPath, [claudeScript, ...args], {
    cwd: workspacePath,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcesses.set(sessionId, proc);

  const timeout = setTimeout(() => {
    console.error(`[claude] Timeout for session ${sessionId}, killing process`);
    proc.kill('SIGTERM');
  }, TIMEOUT_MS);

  let buffer = '';
  let resultText = ''; // Final result from Claude (authoritative for DB)
  const turnId = randomUUID();

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();

    // Process complete JSON lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        handleStreamEvent(sessionId, event);
        // Capture the final result text for DB write
        if (event.type === 'result') {
          const content = extractContent(event.result);
          if (content) resultText = content;
        }
      } catch {
        // Skip non-JSON lines (e.g. warnings)
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    console.error(`[claude] stderr (${sessionId}):`, chunk.toString());
  });

  return new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      activeProcesses.delete(sessionId);

      // Emit done event
      bridgeEvents.emitBridgeEvent({
        event: 'assistant.streaming',
        data: { session_id: sessionId, content: '', done: true },
      });

      if (code === 0) {
        // Write both messages to Conductor's DB so they appear in the desktop UI
        try {
          insertSessionMessage(sessionId, 'user', message, turnId);
          if (resultText) {
            insertSessionMessage(sessionId, 'assistant', resultText, turnId);
          }
          console.log(`[claude] Wrote messages to Conductor DB for session ${sessionId}`);
        } catch (err) {
          console.error(`[claude] Failed to write messages to DB:`, err);
        }
        resolve();
      } else {
        reject(new Error(`Claude process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      activeProcesses.delete(sessionId);
      reject(err);
    });
  });
}

function handleStreamEvent(sessionId: string, event: any): void {
  // Claude's stream-json format emits various event types
  // We stream content_block_delta events to mobile in real-time
  if (event.type === 'content_block_delta') {
    const delta = event.delta?.text;
    if (delta) {
      bridgeEvents.emitBridgeEvent({
        event: 'assistant.streaming',
        data: { session_id: sessionId, content: delta, done: false },
      });
    }
  }
  // 'result' event is captured in the main stdout handler for DB write
}

function extractContent(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n') || null;
  }
  return null;
}

export function killSession(sessionId: string): void {
  const proc = activeProcesses.get(sessionId);
  if (proc) {
    proc.kill('SIGTERM');
    activeProcesses.delete(sessionId);
  }
}
