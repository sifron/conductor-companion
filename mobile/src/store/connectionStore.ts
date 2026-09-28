import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface BridgeCredentials {
  host: string;
  port: number;
  token: string;
}

export interface CloudIdentity {
  userId: string;
  email: string;
  organizationId: string;
}

export interface CloudCredentials {
  apiKey: string;
  identity: CloudIdentity | null;
}

interface ConnectionState {
  bridge: BridgeCredentials | null;
  cloud: CloudCredentials | null;

  isConfigured: boolean; // bridgeConfigured || cloudConfigured
  bridgeConfigured: boolean;
  cloudConfigured: boolean;

  setBridge: (host: string, port: number, token: string) => Promise<void>;
  clearBridge: () => Promise<void>;

  setCloud: (apiKey: string, identity: CloudIdentity) => Promise<void>;
  clearCloud: () => Promise<void>;

  loadSaved: () => Promise<void>;
}

function deriveConfigured(state: { bridge: BridgeCredentials | null; cloud: CloudCredentials | null }) {
  const bridgeConfigured = state.bridge !== null;
  const cloudConfigured = state.cloud !== null;
  return { bridgeConfigured, cloudConfigured, isConfigured: bridgeConfigured || cloudConfigured };
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  bridge: null,
  cloud: null,
  isConfigured: false,
  bridgeConfigured: false,
  cloudConfigured: false,

  setBridge: async (host: string, port: number, token: string) => {
    await SecureStore.setItemAsync('bridge_host', host);
    await SecureStore.setItemAsync('bridge_port', String(port));
    await SecureStore.setItemAsync('bridge_token', token);
    const bridge = { host, port, token };
    set({ bridge, ...deriveConfigured({ bridge, cloud: get().cloud }) });
  },

  clearBridge: async () => {
    await SecureStore.deleteItemAsync('bridge_host');
    await SecureStore.deleteItemAsync('bridge_port');
    await SecureStore.deleteItemAsync('bridge_token');
    set({ bridge: null, ...deriveConfigured({ bridge: null, cloud: get().cloud }) });
  },

  setCloud: async (apiKey: string, identity: CloudIdentity) => {
    await SecureStore.setItemAsync('cloud_api_key', apiKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    // Identity is display metadata, not a secret — plain AsyncStorage.
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('cloud_identity', JSON.stringify(identity));
    const cloud = { apiKey, identity };
    set({ cloud, ...deriveConfigured({ bridge: get().bridge, cloud }) });
  },

  clearCloud: async () => {
    await SecureStore.deleteItemAsync('cloud_api_key');
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.removeItem('cloud_identity');
    set({ cloud: null, ...deriveConfigured({ bridge: get().bridge, cloud: null }) });
  },

  loadSaved: async () => {
    const host = await SecureStore.getItemAsync('bridge_host');
    const port = await SecureStore.getItemAsync('bridge_port');
    const token = await SecureStore.getItemAsync('bridge_token');
    const bridge = host && token ? { host, port: port ? parseInt(port, 10) : 3847, token } : null;

    const apiKey = await SecureStore.getItemAsync('cloud_api_key');
    let cloud: CloudCredentials | null = null;
    if (apiKey) {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const identityRaw = await AsyncStorage.getItem('cloud_identity');
      const identity = identityRaw ? (JSON.parse(identityRaw) as CloudIdentity) : null;
      cloud = { apiKey, identity };
    }

    set({ bridge, cloud, ...deriveConfigured({ bridge, cloud }) });
  },
}));
