import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { ShareIntentProvider } from 'expo-share-intent';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { RootNavigator } from '@/navigation/RootNavigator';
import { navigate, navigationRef } from '@/navigation/navigationRef';
import { usePendingShareIntent } from '@/services/shareIntent';
import { useVaultStore } from '@/store/useVaultStore';
import { initNotifications, STALE_ACTIONS } from '@/services/notifications';
import { runBackgroundChecks } from '@/services/backgroundChecks';
import * as itemsRepo from '@/db/itemsRepo';

function AppContent() {
  const { isDark } = useTheme();
  const hydrate = useVaultStore((s) => s.hydrate);
  const keepStale = useVaultStore((s) => s.keepStale);
  const snoozeStale = useVaultStore((s) => s.snoozeStale);
  const deleteStale = useVaultStore((s) => s.deleteStale);
  const { pending, resetShareIntent } = usePendingShareIntent();

  useEffect(() => {
    initNotifications();
    hydrate();
    runBackgroundChecks();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runBackgroundChecks();
    });
    return () => sub.remove();
  }, [hydrate]);

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as { itemId?: string; kind?: string };
      const actionId = response.actionIdentifier;

      if (data.kind === 'stale' && data.itemId) {
        if (actionId === STALE_ACTIONS.SNOOZE) {
          await snoozeStale(data.itemId);
          return;
        }
        if (actionId === STALE_ACTIONS.DELETE) {
          await deleteStale(data.itemId);
          return;
        }
        if (actionId === STALE_ACTIONS.KEEP) {
          await keepStale(data.itemId);
          return;
        }
        navigate('ItemDetail', { itemId: data.itemId });
        return;
      }

      if (data.kind === 'reminder' && data.itemId) {
        await itemsRepo.markResurfaced(data.itemId).catch(() => {});
        navigate('ItemDetail', { itemId: data.itemId });
        return;
      }

      if (data.kind === 'digest') {
        navigate('Digest', undefined);
      }
    });

    return () => responseSub.remove();
  }, [keepStale, snoozeStale, deleteStale]);

  useEffect(() => {
    if (!pending || !navigationRef.isReady()) return;
    navigate('AddManual', { prefillUrl: pending.url ?? undefined, prefillImageUri: pending.imageUri ?? undefined });
    resetShareIntent();
  }, [pending, resetShareIntent]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ShareIntentProvider options={{ debug: __DEV__ }}>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}
