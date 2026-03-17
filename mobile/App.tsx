import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useConnectionStore } from './src/store/connectionStore';
import { useDataStore } from './src/store/dataStore';
import { wsManager } from './src/api/websocket';
import { AppNavigator } from './src/navigation';
import { ConnectionSetup } from './src/screens/ConnectionSetup';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { colors } from './src/theme';

export default function App() {
  const [loading, setLoading] = useState(true);
  const isConfigured = useConnectionStore((s) => s.isConfigured);
  const loadSaved = useConnectionStore((s) => s.loadSaved);
  const loadCache = useDataStore((s) => s.loadCache);

  useEffect(() => {
    async function init() {
      await loadSaved();
      await loadCache();
      setLoading(false);
    }
    init();
  }, []);

  // Connect WebSocket when configured
  useEffect(() => {
    if (isConfigured) {
      wsManager.connect();
      return () => wsManager.disconnect();
    }
  }, [isConfigured]);

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
