import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useConnectionStore } from '../store/connectionStore';
import { useDataStore } from '../store/dataStore';
import { bridgeClient } from '../api/client';
import { getMe, CloudApiError } from '../providers/cloud/http';

export function Settings() {
  const { bridge, cloud, clearBridge, clearCloud, setCloud } = useConnectionStore();
  const health = useDataStore((s) => s.health);
  const [isTesting, setIsTesting] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);

  const bridgeHealth = health.bridge;

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const ok = await bridgeClient.testConnection();
      Alert.alert(
        ok ? 'Connection OK' : 'Connection Failed',
        ok
          ? `Server at ${bridge?.host}:${bridge?.port} is reachable.`
          : `Could not reach server at ${bridge?.host}:${bridge?.port}. Check that the server is running.`
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnectBridge = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the bridge server?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => clearBridge() },
      ]
    );
  };

  const handleSaveCloudKey = async () => {
    const key = keyInput.trim();
    if (!key) return;
    setValidatingKey(true);
    try {
      const identity = await getMe(key);
      await setCloud(key, identity);
      setKeyInput('');
    } catch (e) {
      const detail = e instanceof CloudApiError && (e.status === 401 || e.status === 403)
        ? 'Key was rejected — check that it is valid and not revoked.'
        : 'Could not validate the key. Check your connection and try again.';
      Alert.alert('Invalid API Key', detail);
    } finally {
      setValidatingKey(false);
    }
  };

  const handleRemoveCloudKey = () => {
    Alert.alert(
      'Remove Key',
      'Removing the key here stops this phone from using it. To revoke it everywhere, delete it in the web console.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Key', style: 'destructive', onPress: () => clearCloud() },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Mac (Bridge)</Text>
        {bridge ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: bridgeHealth?.reachable ? colors.success : colors.error },
                  ]}
                />
                <Text style={styles.value}>{bridgeHealth?.reachable ? 'Connected' : 'Disconnected'}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Server</Text>
              <Text style={styles.value}>{bridge.host}:{bridge.port}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Token</Text>
              <Text style={styles.value} numberOfLines={1}>{bridge.token.slice(0, 12)}...</Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.emptyCardText}>Not connected. Set up a bridge server to reach workspaces on this Mac.</Text>
          </View>
        )}

        {bridge && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.button} onPress={handleTestConnection} disabled={isTesting}>
              {isTesting ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.buttonText}>Test Connection</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={handleDisconnectBridge}>
              <Text style={styles.dangerButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conductor Cloud</Text>
        {cloud ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Key</Text>
                <Text style={styles.value}>...{cloud.apiKey.slice(-4)}</Text>
              </View>
              {cloud.identity?.email && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Account</Text>
                    <Text style={styles.value}>{cloud.identity.email}</Text>
                  </View>
                </>
              )}
              {cloud.identity?.organizationId && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.label}>Org</Text>
                    <Text style={styles.value}>{cloud.identity.organizationId}</Text>
                  </View>
                </>
              )}
            </View>
            <TouchableOpacity style={styles.dangerButton} onPress={handleRemoveCloudKey}>
              <Text style={styles.dangerButtonText}>Remove Key</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.hint}>
              Paste an organization-scoped API key to read and send messages to Conductor Cloud
              workspaces, even with this Mac asleep. The key can read every transcript in every
              project in the org and run agents as you — use a dedicated named key
              (e.g. "companion-iphone") so it can be revoked without collateral damage.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Paste your Cloud API key"
              placeholderTextColor={colors.textMuted}
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.button, (!keyInput.trim() || validatingKey) && styles.buttonDisabled]}
              onPress={handleSaveCloudKey}
              disabled={!keyInput.trim() || validatingKey}
            >
              {validatingKey ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={styles.buttonText}>Save Key</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://app.conductor.build/users/api-keys')}>
              <Text style={styles.link}>Manage keys at app.conductor.build →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>0.2.0</Text>
          </View>
        </View>
      </View>
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
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyCardText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
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
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.accent + '20',
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  buttonDisabled: {
    opacity: 0.5,
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
    marginTop: spacing.sm,
  },
  dangerButtonText: {
    color: colors.error,
    fontSize: fonts.sizes.md,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.text,
    fontSize: fonts.sizes.md,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    lineHeight: 18,
  },
  link: {
    color: colors.accent,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
