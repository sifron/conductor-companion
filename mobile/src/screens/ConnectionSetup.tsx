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
} from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { useConnectionStore } from '../store/connectionStore';
import { bridgeClient } from '../api/client';

export function ConnectionSetup() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3847');
  const [token, setToken] = useState('');
  const [testing, setTesting] = useState(false);

  const setConnection = useConnectionStore((s) => s.setConnection);

  const handleConnect = async () => {
    if (!host.trim() || !token.trim()) {
      Alert.alert('Error', 'Please enter both server address and auth token');
      return;
    }

    setTesting(true);

    // Temporarily set connection to test
    await setConnection(host.trim(), parseInt(port, 10) || 3847, token.trim());

    const ok = await bridgeClient.testConnection();
    if (ok) {
      // Connection saved, navigation will handle the rest
    } else {
      Alert.alert(
        'Connection Failed',
        'Could not connect to the bridge server. Check the address and token.'
      );
      await useConnectionStore.getState().disconnect();
    }

    setTesting(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Conductor Companion</Text>
        <Text style={styles.subtitle}>
          Connect to your bridge server to get started
        </Text>

        <View style={styles.form}>
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
            style={[styles.button, testing && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Run the bridge server on your computer and visit{'\n'}
            http://localhost:3847/setup for connection details
          </Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
});
