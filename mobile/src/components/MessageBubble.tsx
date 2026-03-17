import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { Message } from '../store/dataStore';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const content = message.display_content;

  if (!content || content.trim() === '') return null;

  if (isUser) {
    return (
      <View style={styles.userContainer}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{content}</Text>
        </View>
        {message.sent_at && (
          <Text style={[styles.timestamp, styles.userTimestamp]}>
            {formatTime(message.sent_at)}
          </Text>
        )}
      </View>
    );
  }

  // Assistant message — full width, render markdown
  const blocks = parseMarkdown(content);

  return (
    <View style={styles.assistantContainer}>
      {blocks.map((block, i) => renderBlock(block, i))}
      {message.sent_at && (
        <Text style={[styles.timestamp, styles.assistantTimestamp]}>
          {formatTime(message.sent_at)}
        </Text>
      )}
    </View>
  );
}

// --- Markdown types ---

type Block =
  | { type: 'paragraph'; content: string }
  | { type: 'code'; content: string; language?: string }
  | { type: 'heading'; content: string; level: number }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'hr' };

function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case 'code':
      return (
        <ScrollView key={key} horizontal style={styles.codeScroll} showsHorizontalScrollIndicator={false}>
          <View style={styles.codeBlock}>
            {block.language && (
              <Text style={styles.codeLanguage}>{block.language}</Text>
            )}
            <Text style={styles.codeText}>{block.content}</Text>
          </View>
        </ScrollView>
      );
    case 'heading':
      return (
        <Text key={key} style={[styles.heading, block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3]}>
          {block.content}
        </Text>
      );
    case 'list':
      return (
        <View key={key} style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.listBullet}>
                {block.ordered ? `${i + 1}.` : '\u2022'}
              </Text>
              <Text style={styles.assistantText}>{renderInline(item)}</Text>
            </View>
          ))}
        </View>
      );
    case 'hr':
      return <View key={key} style={styles.hr} />;
    case 'paragraph':
    default:
      return (
        <Text key={key} style={styles.assistantText}>
          {renderInline(block.content)}
        </Text>
      );
  }
}

// --- Inline markdown rendering ---

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      nodes.push(
        <Text key={key++} style={styles.bold}>{match[2]}</Text>
      );
    } else if (match[3]) {
      // *italic*
      nodes.push(
        <Text key={key++} style={styles.italic}>{match[3]}</Text>
      );
    } else if (match[4]) {
      // `inline code`
      nodes.push(
        <Text key={key++} style={styles.inlineCode}>{match[4]}</Text>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

// --- Block-level markdown parser ---

function parseMarkdown(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const language = line.trimStart().slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', content: codeLines.join('\n'), language });
      i++; // skip closing ```
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', content: headingMatch[2], level: headingMatch[1].length });
      i++;
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', items, ordered: false });
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', items, ordered: true });
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].match(/^#{1,3}\s+/) &&
      !lines[i].match(/^[\s]*[-*]\s+/) &&
      !lines[i].match(/^[\s]*\d+\.\s+/) &&
      !/^---+$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', content: paraLines.join('\n') });
    }
  }

  return blocks;
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  // User messages — right-aligned bubble
  userContainer: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-end',
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: colors.userBubble,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userText: {
    color: '#fff',
    fontSize: fonts.sizes.md,
    lineHeight: 20,
  },

  // Assistant messages — full width, no bubble
  assistantContainer: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  assistantText: {
    color: colors.text,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },

  // Inline styles
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
  italic: {
    fontStyle: 'italic',
    color: colors.text,
  },
  inlineCode: {
    fontFamily: fonts.mono,
    fontSize: fonts.sizes.sm,
    backgroundColor: '#1c2129',
    color: '#e06c75',
    paddingHorizontal: 4,
    borderRadius: 3,
  },

  // Headings
  heading: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  h1: {
    fontSize: fonts.sizes.xl,
  },
  h2: {
    fontSize: fonts.sizes.lg,
  },
  h3: {
    fontSize: fonts.sizes.md,
  },

  // Code blocks
  codeScroll: {
    marginBottom: spacing.sm,
    borderRadius: 8,
  },
  codeBlock: {
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minWidth: '100%',
  },
  codeLanguage: {
    color: colors.textMuted,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs,
    fontFamily: fonts.mono,
  },
  codeText: {
    color: '#e6edf3',
    fontFamily: fonts.mono,
    fontSize: fonts.sizes.sm,
    lineHeight: 18,
  },

  // Lists
  list: {
    marginBottom: spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
  },
  listBullet: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    width: 20,
    lineHeight: 22,
  },

  // Horizontal rule
  hr: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },

  // Timestamps
  timestamp: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  userTimestamp: {
    marginRight: spacing.xs,
  },
  assistantTimestamp: {
    marginLeft: 0,
  },
});
