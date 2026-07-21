import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { navigationRef } from '@/navigation/navigationRef';
import { RootStackParamList, TabParamList } from '@/navigation/types';
import { HomeGridScreen } from '@/screens/HomeGridScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { FoldersScreen } from '@/screens/FoldersScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { ItemDetailScreen } from '@/screens/ItemDetailScreen';
import { AddManualScreen } from '@/screens/AddManualScreen';
import { FolderDetailScreen } from '@/screens/FolderDetailScreen';
import { DigestScreen } from '@/screens/DigestScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Home: '⊞',
  Search: '⌕',
  Folders: '▤',
  Settings: '⚙',
};

function Tabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>{TAB_ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Home" component={HomeGridScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Folders" component={FoldersScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { theme, isDark } = useTheme();

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text }}>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Save' }} />
        <Stack.Screen name="AddManual" component={AddManualScreen} options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="FolderDetail" component={FolderDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Digest" component={DigestScreen} options={{ title: 'Weekly digest' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
