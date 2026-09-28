/**
 * Parse the JSON content field from session_messages into human-readable display text.
 * Mirrors the Rust extract_display_text logic exactly.
 */
export function extractDisplayContent(raw: string | null): string {
  if (!raw) return '';

  // Try parsing as JSON
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    // Not JSON — return as-is (plain text message)
    return raw;
  }

  return extractDisplayText(value);
}

function extractDisplayText(value: unknown): string {
  // Handle string content directly
  if (typeof value === 'string') {
    return value;
  }

  // Handle array of content blocks (Claude API format)
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
            const name =
              typeof b.name === 'string' ? b.name : 'unknown';
            texts.push(`[Tool: ${name}]`);
            break;
          }
          case 'tool_result':
            // Skip tool results
            break;
        }
      }
    }
    if (texts.length > 0) return texts.join('\n');
  }

  // Handle object with nested message content
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;

    // Check for message.content pattern
    if (obj.message && typeof obj.message === 'object' && obj.message !== null) {
      const msg = obj.message as Record<string, unknown>;
      if (msg.content !== undefined) {
        return extractDisplayText(msg.content);
      }
    }

    // Check for direct content field
    if (obj.content !== undefined) {
      return extractDisplayText(obj.content);
    }

    // Check for text field
    if (typeof obj.text === 'string') {
      return obj.text;
    }
  }

  // Fallback: return truncated JSON
  const s = JSON.stringify(value);
  if (s.length > 200) {
    return s.slice(0, 200) + '...';
  }
  return s;
}
