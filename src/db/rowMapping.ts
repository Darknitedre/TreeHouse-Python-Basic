import { SavedItem } from '@/types';

/** Raw shape as stored/returned by expo-sqlite (tags is a JSON string column). */
export interface ItemRow {
  id: string;
  url: string | null;
  localImageUri: string | null;
  thumbnailUri: string | null;
  platform: string;
  title: string;
  note: string;
  category: string;
  tags: string;
  folderId: string | null;
  dateSaved: number;
  dateOpened: number | null;
  openCount: number;
  reminderAt: number | null;
  reminderNotificationId: string | null;
  status: string;
  duplicateOfId: string | null;
  urlHash: string | null;
  resurfacedAt: number | null;
  snoozedUntil: number | null;
}

export function rowToItem(row: ItemRow): SavedItem {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    url: row.url,
    localImageUri: row.localImageUri,
    thumbnailUri: row.thumbnailUri,
    platform: row.platform as SavedItem['platform'],
    title: row.title,
    note: row.note,
    category: row.category,
    tags,
    folderId: row.folderId,
    dateSaved: row.dateSaved,
    dateOpened: row.dateOpened,
    openCount: row.openCount,
    reminderAt: row.reminderAt,
    reminderNotificationId: row.reminderNotificationId,
    status: row.status as SavedItem['status'],
    duplicateOfId: row.duplicateOfId,
    urlHash: row.urlHash,
    resurfacedAt: row.resurfacedAt,
    snoozedUntil: row.snoozedUntil,
  };
}
