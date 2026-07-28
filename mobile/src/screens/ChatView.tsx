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
import { refKey } from '../providers/types';
import { colors, fonts, spacing } from '../theme';
import { useDataStore, Message } from '../store/dataStore';
import { useScopeStore } from '../store/scopeStore';
import { MessageBubble } from '../components/MessageBubble';
import { StatusBadge } from '../components/StatusBadge';

const EMPTY_MESSAGES: Message[] = [];

export function ChatView() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { source, workspaceId, sessionId, sessionTitle } = route.params;
  const workspaceRef = useMemo(() => ({ source, id: workspaceId }), [source, workspaceId]);
  const sessionRef = useMemo(() => ({ source, id: sessionId }), [source, sessionId]);

  const messagesMap = useDataStore((s) => s.messages);
  const messages = messagesMap[refKey(sessionRef)] || EMPTY_MESSAGES;
  const sessionsMap = useDataStore((s) => s.sessions);
  const session = useMemo(
    () => (sessionsMap[refKey(workspaceRef)] || []).find((s) => s.ref.id === sessionId) ?? null,
    [sessionsMap, workspaceRef, sessionId]
  );
  const fetchMessages = useDataStore((s) => s.fetchMessages);
  const sendMessage = useDataStore((s) => s.sendMessage);
  const setActiveSession = useScopeStore((s) => s.setActiveSession);
  const clearActiveSession = useScopeStore((s) => s.clearActiveSession);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: sessionTitle || 'Chat' });
    setActiveSession(workspaceRef, sessionRef);
    fetchMessages(sessionRef).then((more) => {
      setHasMore(more);
      setInitialLoad(false);
    });
    return () => clearActiveSession();
  }, [source, workspaceId, sessionId]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldestMessage = messages[0];
    const more = await fetchMessages(sessionRef, oldestMessage?.ref.id);
    setHasMore(more);
    setLoadingMore(false);
  }, [hasMore, loadingMore, messages, sessionRef]);

  const visibleMessages = messages.filter((m) => (m.kind === 'text' && m.text.trim()) || m.kind === 'unknown');

  const isWorking = session?.status === 'working';
  const canSend = session?.capabilities.canSendMessage ?? true;

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    const result = await sendMessage(sessionRef, text);
    setSending(false);

    if (!result.success) {
      Alert.alert('Send Failed', result.error || 'Could not send message');
      setInputText(text); // Restore text on failure
    }
  }, [inputText, sending, sessionRef, sendMessage]);

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
          {session.contextUsedPercent != null && (
            <Text style={styles.contextText}>
              {Math.round(session.contextUsedPercent)}% context
            </Text>
          )}
          {!session.capabilities.streams && (
            <Text style={styles.contextText}>· no live streaming</Text>
          )}
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={visibleMessages}
        keyExtractor={(item) => refKey(item.ref)}
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
            placeholder={
              !canSend ? "Sending isn't supported here" : isWorking ? 'Session is busy...' : 'Send a message...'
            }
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={10000}
            editable={canSend && !isWorking && !sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || sending || isWorking || !canSend) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending || isWorking || !canSend}
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
