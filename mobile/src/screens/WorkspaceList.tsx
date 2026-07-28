import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts, spacing } from '../theme';
import { useDataStore, Workspace } from '../store/dataStore';
import { StatusBadge } from '../components/StatusBadge';

const SOURCE_LABEL = { bridge: 'This Mac', cloud: 'Cloud' } as const;

export function WorkspaceList() {
  const navigation = useNavigation<any>();
  const workspacesMap = useDataStore((s) => s.workspaces);
  const isLoading = useDataStore((s) => s.isLoading);
  const lastUpdated = useDataStore((s) => s.lastUpdated);
  const fetchWorkspaces = useDataStore((s) => s.fetchWorkspaces);
  const health = useDataStore((s) => s.health);

  const workspaces = useMemo(
    () =>
      Object.values(workspacesMap).sort((a, b) => {
        const at = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const bt = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        return bt - at;
      }),
    [workspacesMap]
  );

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleRefresh = useCallback(() => {
    fetchWorkspaces();
  }, []);

  const renderItem = ({ item }: { item: Workspace }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('SessionList', {
          source: item.ref.source,
          workspaceId: item.ref.id,
          workspaceName: item.name,
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.workspaceName}>{item.name}</Text>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <View style={styles.cardMeta}>
        <Text style={styles.sourceChip}>{SOURCE_LABEL[item.ref.source]}</Text>
        {item.repoName && <Text style={styles.repoName}>{item.repoName}</Text>}
      </View>

      <View style={styles.cardMeta}>
        {item.branch && <Text style={styles.branch}>{item.branch}</Text>}
        <Text style={styles.sessionCount}>
          {item.sessionCount == null ? '—' : `${item.sessionCount} session${item.sessionCount !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {item.prTitle && (
        <Text style={styles.prTitle} numberOfLines={1}>
          PR: {item.prTitle}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {(['bridge', 'cloud'] as const).map((source) => {
        const h = health[source];
        if (!h || h.reachable) return null;
        return (
          <View key={source} style={[styles.disconnectedBanner, h.fatal && styles.fatalBanner]}>
            <Text style={styles.disconnectedText}>
              {SOURCE_LABEL[source]}: {h.detail || 'Unreachable'}
              {lastUpdated ? ` · Last updated ${formatRelativeTime(lastUpdated)}` : ''}
            </Text>
          </View>
        );
      })}
      <FlatList
        data={workspaces}
        keyExtractor={(item) => `${item.ref.source}:${item.ref.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No workspaces found</Text>
              <Text style={styles.emptyHint}>
                Connect to a bridge server or Conductor Cloud in Settings
              </Text>
            </View>
          ) : null
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
  disconnectedBanner: {
    backgroundColor: colors.warning + '20',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + '40',
  },
  fatalBanner: {
    backgroundColor: colors.error + '20',
    borderBottomColor: colors.error + '40',
  },
  disconnectedText: {
    color: colors.warning,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
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
  },
  workspaceName: {
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  sourceChip: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  repoName: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  branch: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontFamily: fonts.mono,
  },
  sessionCount: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
  },
  prTitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.lg,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: fonts.sizes.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
