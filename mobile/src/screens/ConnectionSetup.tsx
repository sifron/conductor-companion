import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useConnectionStore } from '../store/connectionStore';
import { bridgeClient } from '../api/client';
import { getMe, CloudApiError } from '../providers/cloud/http';

// Both halves are independently skippable — filling in either one flips
// isConfigured and App.tsx swaps to the main navigator. There's no "next"
// step to force through; the other half is always reachable later from
// Settings.
export function ConnectionSetup() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3847');
  const [token, setToken] = useState('');
  const [testingBridge, setTestingBridge] = useState(false);

  const [cloudKey, setCloudKey] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);

  const setBridge = useConnectionStore((s) => s.setBridge);
  const setCloud = useConnectionStore((s) => s.setCloud);

  const handleConnectBridge = async () => {
    if (!host.trim() || !token.trim()) {
      Alert.alert('Error', 'Please enter both server address and auth token');
      return;
    }

    setTestingBridge(true);
    await setBridge(host.trim(), parseInt(port, 10) || 3847, token.trim());

    const ok = await bridgeClient.testConnection();
    if (!ok) {
      Alert.alert('Connection Failed', 'Could not connect to the bridge server. Check the address and token.');
      await useConnectionStore.getState().clearBridge();
    }
    setTestingBridge(false);
  };

  const handleSaveCloudKey = async () => {
    const key = cloudKey.trim();
    if (!key) return;
    setValidatingKey(true);
    try {
      const identity = await getMe(key);
      await setCloud(key, identity);
    } catch (e) {
      const detail =
        e instanceof CloudApiError && (e.status === 401 || e.status === 403)
          ? 'Key was rejected — check that it is valid and not revoked.'
          : 'Could not validate the key. Check your connection and try again.';
      Alert.alert('Invalid API Key', detail);
    } finally {
      setValidatingKey(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Conductor Companion</Text>
        <Text style={styles.subtitle}>Connect to a bridge server, Conductor Cloud, or both</Text>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>This Mac (Bridge)</Text>
          <Text style={styles.label}>Server Address</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.1.x"
            placeholderTextColor={colors.textMuted}
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>Port</Text>
          <TextInput
            style={styles.input}
            placeholder="3847"
            placeholderTextColor={colors.textMuted}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Auth Token</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste your auth token"
            placeholderTextColor={colors.textMuted}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, testingBridge && styles.buttonDisabled]}
            onPress={handleConnectBridge}
            disabled={testingBridge}
          >
            {testingBridge ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Connect Bridge</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Run the bridge server on your computer and visit{'\n'}
            http://localhost:3847/setup for connection details
          </Text>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Conductor Cloud</Text>
          <Text style={styles.label}>Cloud API Key</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste your Cloud API key"
            placeholderTextColor={colors.textMuted}
            value={cloudKey}
            onChangeText={setCloudKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, (!cloudKey.trim() || validatingKey) && styles.buttonDisabled]}
            onPress={handleSaveCloudKey}
            disabled={!cloudKey.trim() || validatingKey}
          >
            {validatingKey ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Connect Cloud</Text>}
          </TouchableOpacity>

          <Text style={styles.hint}>Works with your Mac asleep — but no live streaming, ~5s status updates.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  title: {
    fontSize: fonts.sizes.title,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  form: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.text,
    fontSize: fonts.sizes.md,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: fonts.sizes.lg,
    fontWeight: '600',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fonts.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xxl,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: fonts.sizes.sm,
  },
});
