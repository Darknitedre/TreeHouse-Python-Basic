export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'web' | 'manual';

export type ReminderPreset = 'tonight' | 'weekend' | 'custom' | 'none';

export type ItemStatus = 'active' | 'snoozed' | 'archived' | 'deleted';

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface SavedItem {
  id: string;
  url: string | null;
  /** Local file URI for manually uploaded screenshots/photos. */
  localImageUri: string | null;
  /** Cached local thumbnail (downloaded preview or the screenshot itself). */
  thumbnailUri: string | null;
  platform: Platform;
  title: string;
  note: string;
  category: string;
  tags: string[];
  folderId: string | null;
  dateSaved: number;
  dateOpened: number | null;
  openCount: number;
  reminderAt: number | null;
  reminderNotificationId: string | null;
  status: ItemStatus;
  duplicateOfId: string | null;
  urlHash: string | null;
  resurfacedAt: number | null;
  snoozedUntil: number | null;
}

export interface NewSaveInput {
  url?: string | null;
  localImageUri?: string | null;
  title?: string;
  note?: string;
  category?: string;
  tags?: string[];
  folderId?: string | null;
  reminder?: { preset: ReminderPreset; date?: number };
}

export const DEFAULT_CATEGORIES = [
  'Recipes',
  'Fitness',
  'Business/Marketing',
  'Faith',
  'Cars',
  'Travel',
  'Funny',
  'Uncategorized',
] as const;
