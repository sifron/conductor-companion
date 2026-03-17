import React, { useEffect, useCallback } from 'react';
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
import { useConnectionStore } from '../store/connectionStore';
import { StatusBadge } from '../components/StatusBadge';

export function WorkspaceList() {
  const navigation = useNavigation<any>();
  const workspaces = useDataStore((s) => s.workspaces);
  const isLoading = useDataStore((s) => s.isLoading);
  const lastUpdated = useDataStore((s) => s.lastUpdated);
  const fetchWorkspaces = useDataStore((s) => s.fetchWorkspaces);
  const isConnected = useConnectionStore((s) => s.isConnected);

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
          workspaceId: item.id,
          workspaceName: item.directory_name,
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.workspaceName}>{item.directory_name}</Text>
        <StatusBadge status={item.active_session_status || item.derived_status} size="sm" />
      </View>

      {item.repo_name && (
        <Text style={styles.repoName}>{item.repo_name}</Text>
      )}

      <View style={styles.cardMeta}>
        <Text style={styles.branch}>{item.branch}</Text>
        <Text style={styles.sessionCount}>
          {item.session_count} session{item.session_count !== 1 ? 's' : ''}
        </Text>
      </View>

      {item.pr_title && (
        <Text style={styles.prTitle} numberOfLines={1}>
          PR: {item.pr_title}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {!isConnected && (
        <View style={styles.disconnectedBanner}>
          <Text style={styles.disconnectedText}>
            Disconnected{lastUpdated ? ` \u00b7 Last updated ${formatRelativeTime(lastUpdated)}` : ''}
          </Text>
        </View>
      )}
      <FlatList
        data={workspaces}
        keyExtractor={(item) => item.id}
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
                Make sure Conductor is running with active workspaces
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
  repoName: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
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
