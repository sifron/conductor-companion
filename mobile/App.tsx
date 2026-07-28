import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, AppState, AppStateStatus } from 'react-native';
import { useConnectionStore } from './src/store/connectionStore';
import { useDataStore } from './src/store/dataStore';
import { useScopeStore } from './src/store/scopeStore';
import { configuredProviders } from './src/providers/registry';
import { AppNavigator } from './src/navigation';
import { ConnectionSetup } from './src/screens/ConnectionSetup';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme';

const BACKGROUND_GRACE_MS = 20_000;

export default function App() {
  const [loading, setLoading] = useState(true);
  const isConfigured = useConnectionStore((s) => s.isConfigured);
  const loadSaved = useConnectionStore((s) => s.loadSaved);
  const loadCache = useDataStore((s) => s.loadCache);
  const fetchWorkspaces = useDataStore((s) => s.fetchWorkspaces);
  const applyUpdate = useDataStore((s) => s.applyUpdate);
  const activeWorkspaceRef = useScopeStore((s) => s.activeWorkspaceRef);
  const activeSessionRef = useScopeStore((s) => s.activeSessionRef);

  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function init() {
      await loadSaved();
      await loadCache();
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        if (graceTimer.current) {
          clearTimeout(graceTimer.current);
          graceTimer.current = null;
        }
        setForeground(true);
        fetchWorkspaces();
      } else if (!graceTimer.current) {
        graceTimer.current = setTimeout(() => {
          graceTimer.current = null;
          setForeground(false);
        }, BACKGROUND_GRACE_MS);
      }
    });
    return () => sub.remove();
  }, []);

  // Subscribe every configured provider whenever foreground or active
  // workspace/session scope changes. No screen can tell which source it's
  // talking to — this is the only place that wires providers to the store.
  useEffect(() => {
    if (!isConfigured) return;

    const unsubs = configuredProviders().map((provider) =>
      provider.subscribe(
        {
          foreground,
          activeWorkspaceId: activeWorkspaceRef?.source === provider.source ? activeWorkspaceRef.id : null,
          activeSessionId: activeSessionRef?.source === provider.source ? activeSessionRef.id : null,
        },
        applyUpdate
      )
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [isConfigured, foreground, activeWorkspaceRef?.source, activeWorkspaceRef?.id, activeSessionRef?.source, activeSessionRef?.id]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
        <StatusBar style="light" />
      </View>
    );
  }

  if (!isConfigured) {
    return (
      <>
        <ConnectionSetup />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <ErrorBoundary>
      <AppNavigator />
      <StatusBar style="light" />
    </ErrorBoundary>
  );
}
