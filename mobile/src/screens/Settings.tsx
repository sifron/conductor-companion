import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useConnectionStore } from '../store/connectionStore';
import { wsManager } from '../api/websocket';
import { bridgeClient } from '../api/client';

export function Settings() {
  const { host, port, token, isConnected, disconnect } = useConnectionStore();
  const [isTesting, setIsTesting] = useState(false);

  const handleReconnect = () => {
    wsManager.disconnect();
    wsManager.connect();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const ok = await bridgeClient.testConnection();
      Alert.alert(
        ok ? 'Connection OK' : 'Connection Failed',
        ok
          ? `Server at ${host}:${port} is reachable.`
          : `Could not reach server at ${host}:${port}. Check that the server is running.`
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the bridge server?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            wsManager.disconnect();
            disconnect();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? colors.success : colors.error },
                ]}
              />
              <Text style={styles.value}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Server</Text>
            <Text style={styles.value}>
              {host}:{port}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Token</Text>
            <Text style={styles.value} numberOfLines={1}>
              {token ? `${token.slice(0, 12)}...` : 'Not set'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>0.1.0</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.button} onPress={handleTestConnection} disabled={isTesting}>
          {isTesting ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.buttonText}>Test Connection</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleReconnect}>
          <Text style={styles.buttonText}>Reconnect</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.dangerButton} onPress={handleDisconnect}>
        <Text style={styles.dangerButtonText}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
  label: {
    fontSize: fonts.sizes.md,
    color: colors.text,
  },
  value: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttonGroup: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.accent + '20',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  buttonText: {
    color: colors.accent,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: colors.error + '20',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error + '40',
    marginTop: spacing.lg,
  },
  dangerButtonText: {
    color: colors.error,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
});
