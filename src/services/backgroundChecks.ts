import * as itemsRepo from '@/db/itemsRepo';
import { ensureWeeklyDigestScheduled, notifyStaleItem } from '@/services/notifications';

const MAX_STALE_NOTIFICATIONS_PER_RUN = 3;

/**
 * Runs on app foreground/launch (see App.tsx). In a managed Expo app there's no reliable way
 * to run this at 6pm on a specific Sunday in the background without EAS + a dev/prod build
 * running `expo-background-fetch` (documented in README "v2 roadmap"). For the MVP we do the
 * next best thing: check every time the user opens the app, plus a standing weekly local
 * notification that deep-links back in.
 */
export async function runBackgroundChecks(): Promise<{ staleNotified: number }> {
  await ensureWeeklyDigestScheduled();

  const stale = await itemsRepo.getStaleUnopened(30);
  const toNotify = stale.slice(0, MAX_STALE_NOTIFICATIONS_PER_RUN);

  for (const item of toNotify) {
    await notifyStaleItem(item);
    await itemsRepo.markResurfaced(item.id);
  }

  return { staleNotified: toNotify.length };
}
