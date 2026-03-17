import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors, fonts } from '../theme';

import { WorkspaceList } from '../screens/WorkspaceList';
import { SessionList } from '../screens/SessionList';
import { ChatView } from '../screens/ChatView';
import { Settings } from '../screens/Settings';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '600' as const },
};

function WorkspacesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="WorkspaceList"
        component={WorkspaceList}
        options={{ title: 'Workspaces' }}
      />
      <Stack.Screen
        name="SessionList"
        component={SessionList}
        options={{ title: 'Sessions' }}
      />
      <Stack.Screen
        name="ChatView"
        component={ChatView}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="SettingsScreen"
        component={Settings}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
        }}
      >
        <Tab.Screen
          name="Workspaces"
          component={WorkspacesStack}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 20 }}>{'\u25A0'}</Text>
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsStack}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 20 }}>{'\u2699'}</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
