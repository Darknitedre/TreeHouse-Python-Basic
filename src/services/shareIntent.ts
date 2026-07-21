import { useShareIntentContext } from 'expo-share-intent';

export interface PendingShare {
  url: string | null;
  imageUri: string | null;
  text: string | null;
}

/**
 * Normalizes whatever the OS share sheet handed us (a webpage URL from Instagram/TikTok/
 * Facebook's "Copy Link"/"Share" action, plain text containing a link, or an image file for
 * screenshots) into the shape AddManual/QuickSave expects. Wrap the app root in
 * `ShareIntentProvider` (see App.tsx) for this to receive anything.
 */
export function usePendingShareIntent() {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntentContext();

  const pending: PendingShare | null = hasShareIntent
    ? {
        url: shareIntent.webUrl ?? extractUrlFromText(shareIntent.text ?? null),
        imageUri: shareIntent.files?.[0]?.path ?? null,
        text: shareIntent.text ?? null,
      }
    : null;

  return { pending, resetShareIntent, error };
}

function extractUrlFromText(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/\S+/i);
  return match ? match[0] : null;
}
