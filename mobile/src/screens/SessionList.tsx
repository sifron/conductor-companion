import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, fonts, spacing } from '../theme';
import { useDataStore, Session } from '../store/dataStore';
import { StatusBadge } from '../components/StatusBadge';

const EMPTY_SESSIONS: Session[] = [];

export function SessionList() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { workspaceId, workspaceName } = route.params;

  const sessionsMap = useDataStore((s) => s.sessions);
  const sessions = sessionsMap[workspaceId] || EMPTY_SESSIONS;
  const fetchSessions = useDataStore((s) => s.fetchSessions);

  useEffect(() => {
    navigation.setOptions({ title: workspaceName || 'Sessions' });
    fetchSessions(workspaceId);
  }, [workspaceId]);

  const renderItem = ({ item }: { item: Session }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('ChatView', {
          sessionId: item.id,
          sessionTitle: item.title || 'Chat',
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title || 'Untitled Session'}
        </Text>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <View style={styles.meta}>
        <Text style={styles.model}>{item.model || 'unknown'}</Text>
        {item.permission_mode === 'plan' && (
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>Plan Mode</Text>
          </View>
        )}
        {item.context_used_percent != null && (
          <Text style={styles.context}>
            {Math.round(item.context_used_percent)}% context
          </Text>
        )}
      </View>

      {item.last_user_message_at && (
        <Text style={styles.time}>
          Last activity: {formatRelativeTime(item.last_user_message_at)}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No sessions</Text>
          </View>
        }
      />
    </View>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  model: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  planBadge: {
    backgroundColor: colors.warning + '30',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  planBadgeText: {
    color: colors.warning,
    fontSize: fonts.sizes.sm,
    fontWeight: '500',
  },
  context: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
  },
  time: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.lg,
  },
});
