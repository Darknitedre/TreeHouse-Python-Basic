import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import dayjs from 'dayjs';
import { ReminderPreset, SavedItem } from '@/types';

export const NOTIFICATION_CATEGORY = {
  STALE_ITEM: 'stale-item',
  DIGEST: 'weekly-digest',
  REMINDER: 'saved-reminder',
} as const;

export const STALE_ACTIONS = {
  KEEP: 'keep',
  SNOOZE: 'snooze',
  DELETE: 'delete',
} as const;

let handlerConfigured = false;

export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function registerNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY.STALE_ITEM, [
    { identifier: STALE_ACTIONS.KEEP, buttonTitle: 'Keep' },
    { identifier: STALE_ACTIONS.SNOOZE, buttonTitle: 'Snooze' },
    { identifier: STALE_ACTIONS.DELETE, buttonTitle: 'Delete', options: { isDestructive: true } },
  ]);
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Call once, early, from the app root. Safe to call multiple times. */
export async function initNotifications(): Promise<void> {
  configureNotificationHandler();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SaveVault',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
  await registerNotificationCategories();
}

/** Resolves a reminder preset picked at save-time into an absolute Date. */
export function computeReminderDate(preset: ReminderPreset, customDate?: number): Date | null {
  const now = dayjs();
  switch (preset) {
    case 'tonight': {
      let tonight = now.hour(20).minute(0).second(0);
      if (tonight.isBefore(now)) tonight = tonight.add(1, 'day');
      return tonight.toDate();
    }
    case 'weekend': {
      let saturday = now.day(6).hour(10).minute(0).second(0);
      if (saturday.isBefore(now)) saturday = saturday.add(7, 'day');
      return saturday.toDate();
    }
    case 'custom':
      return customDate ? new Date(customDate) : null;
    case 'none':
    default:
      return null;
  }
}

export async function scheduleItemReminder(
  item: Pick<SavedItem, 'id' | 'title' | 'category'>,
  preset: ReminderPreset,
  customDate?: number
): Promise<{ reminderAt: number; notificationId: string } | null> {
  const date = computeReminderDate(preset, customDate);
  if (!date) return null;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminder from SaveVault',
      body: item.title ? `Check out: ${item.title}` : `You asked to be reminded about a ${item.category} save`,
      data: { itemId: item.id, kind: 'reminder' },
      categoryIdentifier: NOTIFICATION_CATEGORY.REMINDER,
    },
    trigger: { date },
  });

  return { reminderAt: date.getTime(), notificationId };
}

export async function cancelScheduledNotification(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

/** One recurring local notification every Sunday at 6pm; tapping it opens the real digest, computed client-side. */
export async function ensureWeeklyDigestScheduled(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const exists = scheduled.some((n) => n.content.data?.kind === 'digest');
  if (exists) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your weekly SaveVault digest',
      body: "See what you saved this week — and what you still haven't opened.",
      data: { kind: 'digest' },
      categoryIdentifier: NOTIFICATION_CATEGORY.DIGEST,
    },
    trigger: {
      weekday: 1, // Sunday (expo-notifications: 1 = Sunday)
      hour: 18,
      minute: 0,
      repeats: true,
    },
  });
}

export async function notifyStaleItem(item: Pick<SavedItem, 'id' | 'title' | 'category'>): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Still want this?',
      body: item.title || `That ${item.category} save has been sitting for a month.`,
      data: { itemId: item.id, kind: 'stale' },
      categoryIdentifier: NOTIFICATION_CATEGORY.STALE_ITEM,
    },
    trigger: null,
  });
}
