// Port of server/src/db/content.ts — keep in sync; unification tracked in Phase 5
import type { MessageKind } from '@conductor-companion/shared';

export function extractDisplayContent(raw: string | null): string {
  if (!raw) return '';

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return raw;
  }

  return extractDisplayText(value);
}

function extractDisplayText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    const texts: string[] = [];
    for (const block of value) {
      if (typeof block === 'object' && block !== null && 'type' in block) {
        const b = block as Record<string, unknown>;
        switch (b.type) {
          case 'text':
            if (typeof b.text === 'string') texts.push(b.text);
            break;
          case 'tool_use': {
            const name = typeof b.name === 'string' ? b.name : 'unknown';
            texts.push(`[Tool: ${name}]`);
            break;
          }
          case 'tool_result':
            break;
        }
      }
    }
    if (texts.length > 0) return texts.join('\n');
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    if (obj.message && typeof obj.message === 'object' && obj.message !== null) {
      const msg = obj.message as Record<string, unknown>;
      if (msg.content !== undefined) {
        return extractDisplayText(msg.content);
      }
    }

    if (obj.content !== undefined) {
      return extractDisplayText(obj.content);
    }

    if (typeof obj.text === 'string') {
      return obj.text;
    }
  }

  const s = JSON.stringify(value);
  if (s.length > 200) {
    return s.slice(0, 200) + '...';
  }
  return s;
}

export interface ClassifiedContent {
  role: 'user' | 'assistant' | 'system';
  kind: MessageKind;
  text: string;
  raw?: string;
}

/**
 * Classifies an already-parsed cloud message `content` field (typed `{}` in
 * the beta OpenAPI spec) into a MessageView-shaped result. Unmodeled shapes
 * degrade to invisible (kind:'unknown', text:''), never to a wall of raw JSON.
 */
export function classifyContent(raw: unknown, fallbackRole: 'user' | 'assistant' | 'system'): ClassifiedContent {
  if (typeof raw === 'string') {
    return { role: fallbackRole, kind: 'text', text: raw };
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;

    if ((obj.type === 'assistant' || obj.type === 'user') && obj.message && typeof obj.message === 'object') {
      const msg = obj.message as Record<string, unknown>;
      const role = (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
        ? msg.role
        : fallbackRole;
      return classifyBlockContent(msg.content, role);
    }

    if (obj.type === 'system' || obj.type === 'result') {
      return { role: fallbackRole, kind: 'control', text: '' };
    }

    if (obj.type === 'error') {
      return { role: fallbackRole, kind: 'error', text: extractDisplayText(obj) };
    }
  }

  const s = JSON.stringify(raw);
  return {
    role: fallbackRole,
    kind: 'unknown',
    text: '',
    raw: s ? s.slice(0, 500) : undefined,
  };
}

function classifyBlockContent(
  content: unknown,
  role: 'user' | 'assistant' | 'system'
): ClassifiedContent {
  if (typeof content === 'string') {
    return { role, kind: 'text', text: content };
  }

  if (Array.isArray(content)) {
    const texts: string[] = [];
    let sawToolUse = false;
    let sawToolResult = false;

    for (const block of content) {
      if (typeof block === 'object' && block !== null && 'type' in block) {
        const b = block as Record<string, unknown>;
        if (b.type === 'text' && typeof b.text === 'string') {
          texts.push(b.text);
        } else if (b.type === 'tool_use') {
          sawToolUse = true;
        } else if (b.type === 'tool_result') {
          sawToolResult = true;
        }
      }
    }

    if (texts.length > 0) {
      return { role, kind: 'text', text: texts.join('\n') };
    }
    if (sawToolUse) {
      return { role, kind: 'tool', text: '' };
    }
    if (sawToolResult) {
      return { role, kind: 'control', text: '' };
    }
  }

  const s = JSON.stringify(content);
  return { role, kind: 'unknown', text: '', raw: s ? s.slice(0, 500) : undefined };
}
