import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface ConnectionState {
  host: string;
  port: number;
  token: string;
  isConnected: boolean;
  isConnecting: boolean;
  isConfigured: boolean;
  setConnection: (host: string, port: number, token: string) => Promise<void>;
  loadSaved: () => Promise<void>;
  disconnect: () => Promise<void>;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  host: '',
  port: 3847,
  token: '',
  isConnected: false,
  isConnecting: false,
  isConfigured: false,

  setConnection: async (host: string, port: number, token: string) => {
    await SecureStore.setItemAsync('bridge_host', host);
    await SecureStore.setItemAsync('bridge_port', String(port));
    await SecureStore.setItemAsync('bridge_token', token);
    set({ host, port, token, isConfigured: true });
  },

  loadSaved: async () => {
    const host = await SecureStore.getItemAsync('bridge_host');
    const port = await SecureStore.getItemAsync('bridge_port');
    const token = await SecureStore.getItemAsync('bridge_token');
    if (host && token) {
      set({
        host,
        port: port ? parseInt(port, 10) : 3847,
        token,
        isConfigured: true,
      });
    }
  },

  disconnect: async () => {
    await SecureStore.deleteItemAsync('bridge_host');
    await SecureStore.deleteItemAsync('bridge_port');
    await SecureStore.deleteItemAsync('bridge_token');
    set({
      host: '',
      port: 3847,
      token: '',
      isConnected: false,
      isConfigured: false,
    });
  },

  setConnected: (connected: boolean) => set({ isConnected: connected }),
  setConnecting: (connecting: boolean) => set({ isConnecting: connecting }),
}));
