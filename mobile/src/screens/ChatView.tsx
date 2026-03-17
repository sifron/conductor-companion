import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, fonts, spacing } from '../theme';
import { useDataStore, Message } from '../store/dataStore';
import { MessageBubble } from '../components/MessageBubble';
import { StatusBadge } from '../components/StatusBadge';

const EMPTY_MESSAGES: Message[] = [];

export function ChatView() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { sessionId, sessionTitle } = route.params;

  const messagesMap = useDataStore((s) => s.messages);
  const messages = messagesMap[sessionId] || EMPTY_MESSAGES;
  const sessionsMap = useDataStore((s) => s.sessions);
  const session = useMemo(() => {
    for (const list of Object.values(sessionsMap)) {
      const found = list.find((s) => s.id === sessionId);
      if (found) return found;
    }
    return null;
  }, [sessionsMap, sessionId]);
  const fetchMessages = useDataStore((s) => s.fetchMessages);
  const sendMessage = useDataStore((s) => s.sendMessage);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: sessionTitle || 'Chat' });
    fetchMessages(sessionId).then((more) => {
      setHasMore(more);
      setInitialLoad(false);
    });
  }, [sessionId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldestMessage = messages[0];
    const more = await fetchMessages(sessionId, oldestMessage?.id);
    setHasMore(more);
    setLoadingMore(false);
  }, [hasMore, loadingMore, messages, sessionId]);

  // Filter to only show meaningful user/assistant text messages
  const visibleMessages = messages.filter((m) => {
    if (m.role !== 'user' && m.role !== 'assistant') return false;
    const c = m.display_content;
    if (!c || c.trim() === '') return false;
    // Skip tool use/result messages
    if (c.startsWith('[Tool:')) return false;
    // Skip raw JSON (tool results that weren't parsed)
    if (c.startsWith('{"type":"result"') || c.startsWith('[{"tool_use_id"')) return false;
    if (c.startsWith('{') && c.length < 300) {
      try { JSON.parse(c); return false; } catch {}
    }
    return true;
  });

  const isWorking = session?.status === 'working';

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    const result = await sendMessage(sessionId, text);
    setSending(false);

    if (!result.success) {
      Alert.alert('Send Failed', result.error || 'Could not send message');
      setInputText(text); // Restore text on failure
    }
  }, [inputText, sending, sessionId, sendMessage]);

  const renderItem = ({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  );

  if (initialLoad) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {session && (
        <View style={styles.statusBar}>
          <StatusBadge status={session.status} size="sm" />
          {session.model && (
            <Text style={styles.modelText}>{session.model}</Text>
          )}
          {session.context_used_percent != null && (
            <Text style={styles.contextText}>
              {Math.round(session.context_used_percent)}% context
            </Text>
          )}
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.messageList}
        inverted={false}
        ListHeaderComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={styles.loadingMore}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No messages yet</Text>
          </View>
        }
      />
      <View style={styles.inputBar}>
        {isWorking && (
          <View style={styles.busyBanner}>
            <ActivityIndicator size="small" color={colors.warning} />
            <Text style={styles.busyText}>Session is working...</Text>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={isWorking ? 'Session is busy...' : 'Send a message...'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={10000}
            editable={!isWorking && !sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending || isWorking) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || isWorking}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modelText: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  contextText: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  messageList: {
    paddingVertical: spacing.md,
  },
  loadingMore: {
    paddingVertical: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    paddingVertical: spacing.xxl,
    textAlign: 'center',
  },
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  busyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  busyText: {
    color: colors.warning,
    fontSize: fonts.sizes.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fonts.sizes.md,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: fonts.sizes.md,
  },
});
