import { getDb } from '@/db/client';
import { ItemRow, rowToItem } from '@/db/rowMapping';
import { detectPlatform } from '@/services/platformDetect';
import { categorize } from '@/services/categorize';
import { generateId } from '@/utils/id';
import { hashUrl } from '@/utils/url';
import { NewSaveInput, SavedItem } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

async function upsertFts(item: SavedItem): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM items_fts WHERE id = ?', [item.id]);
  await db.runAsync(
    'INSERT INTO items_fts (id, title, note, tags, category) VALUES (?, ?, ?, ?, ?)',
    [item.id, item.title, item.note, item.tags.join(' '), item.category]
  );
}

async function deleteFts(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM items_fts WHERE id = ?', [id]);
}

export async function findByUrlHash(urlHash: string): Promise<SavedItem | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(
    "SELECT * FROM items WHERE urlHash = ? AND status != 'deleted' ORDER BY dateSaved DESC LIMIT 1",
    [urlHash]
  );
  return row ? rowToItem(row) : null;
}

export async function getById(id: string): Promise<SavedItem | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
  return row ? rowToItem(row) : null;
}

export async function createItem(
  input: NewSaveInput
): Promise<{ item: SavedItem; duplicateOf: SavedItem | null }> {
  const db = await getDb();
  const id = generateId();
  const dateSaved = Date.now();
  const platform = detectPlatform(input.url ?? null);
  const urlHash = input.url ? hashUrl(input.url) : null;

  const duplicateOf = urlHash ? await findByUrlHash(urlHash) : null;

  const title = input.title?.trim() || '';
  const note = input.note?.trim() || '';
  const category = input.category || categorize(`${title} ${note}`);
  const tags = input.tags ?? [];

  await db.runAsync(
    `INSERT INTO items
      (id, url, localImageUri, thumbnailUri, platform, title, note, category, tags, folderId,
       dateSaved, dateOpened, openCount, reminderAt, reminderNotificationId, status, duplicateOfId, urlHash, resurfacedAt, snoozedUntil)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL, 'active', ?, ?, NULL, NULL)`,
    [
      id,
      input.url ?? null,
      input.localImageUri ?? null,
      input.localImageUri ?? null,
      platform,
      title,
      note,
      category,
      JSON.stringify(tags),
      input.folderId ?? null,
      dateSaved,
      duplicateOf?.id ?? null,
      urlHash,
    ]
  );

  const item = await getById(id);
  if (!item) throw new Error('Failed to create item');
  await upsertFts(item);
  return { item, duplicateOf };
}

export async function updateItem(
  id: string,
  patch: Partial<
    Pick<SavedItem, 'title' | 'note' | 'category' | 'tags' | 'folderId' | 'thumbnailUri' | 'status'>
  >
): Promise<void> {
  const db = await getDb();
  const existing = await getById(id);
  if (!existing) return;
  const next: SavedItem = { ...existing, ...patch };

  await db.runAsync(
    `UPDATE items SET title = ?, note = ?, category = ?, tags = ?, folderId = ?, thumbnailUri = ?, status = ? WHERE id = ?`,
    [
      next.title,
      next.note,
      next.category,
      JSON.stringify(next.tags),
      next.folderId,
      next.thumbnailUri,
      next.status,
      id,
    ]
  );
  await upsertFts(next);
}

export async function setReminder(
  id: string,
  reminderAt: number | null,
  notificationId: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE items SET reminderAt = ?, reminderNotificationId = ? WHERE id = ?', [
    reminderAt,
    notificationId,
    id,
  ]);
}

export async function markOpened(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE items SET dateOpened = ?, openCount = openCount + 1, resurfacedAt = NULL WHERE id = ?',
    [Date.now(), id]
  );
}

export async function markResurfaced(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE items SET resurfacedAt = ? WHERE id = ?', [Date.now(), id]);
}

export async function snoozeItem(id: string, days = 14): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE items SET resurfacedAt = ?, snoozedUntil = ? WHERE id = ?', [
    Date.now(),
    Date.now() + days * DAY_MS,
    id,
  ]);
}

export async function hardDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
  await deleteFts(id);
}

export async function softDelete(id: string): Promise<void> {
  await updateItem(id, { status: 'deleted' });
}

export async function getAllActive(): Promise<SavedItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    "SELECT * FROM items WHERE status = 'active' ORDER BY dateSaved DESC"
  );
  return rows.map(rowToItem);
}

export async function getByFolder(folderId: string): Promise<SavedItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    "SELECT * FROM items WHERE folderId = ? AND status = 'active' ORDER BY dateSaved DESC",
    [folderId]
  );
  return rows.map(rowToItem);
}

export interface SearchFilters {
  platform?: string;
  category?: string;
  folderId?: string;
  dateFrom?: number;
  dateTo?: number;
}

function buildFtsQuery(query: string): string {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/["*]/g, ''))
    .filter(Boolean)
    .map((t) => `${t}*`);
  return tokens.join(' OR ');
}

export async function searchItems(query: string, filters: SearchFilters = {}): Promise<SavedItem[]> {
  const db = await getDb();
  const clauses: string[] = ["status = 'active'"];
  const params: (string | number)[] = [];

  let idFilter: string[] | null = null;
  const trimmed = query.trim();
  if (trimmed) {
    const ftsQuery = buildFtsQuery(trimmed);
    if (ftsQuery) {
      const matches = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM items_fts WHERE items_fts MATCH ? ORDER BY rank',
        [ftsQuery]
      );
      idFilter = matches.map((m) => m.id);
      if (idFilter.length === 0) return [];
    }
  }

  if (filters.platform) {
    clauses.push('platform = ?');
    params.push(filters.platform);
  }
  if (filters.category) {
    clauses.push('category = ?');
    params.push(filters.category);
  }
  if (filters.folderId) {
    clauses.push('folderId = ?');
    params.push(filters.folderId);
  }
  if (filters.dateFrom) {
    clauses.push('dateSaved >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push('dateSaved <= ?');
    params.push(filters.dateTo);
  }
  if (idFilter) {
    clauses.push(`id IN (${idFilter.map(() => '?').join(',')})`);
    params.push(...idFilter);
  }

  const sql = `SELECT * FROM items WHERE ${clauses.join(' AND ')} ORDER BY dateSaved DESC`;
  const rows = await db.getAllAsync<ItemRow>(sql, params);
  return rows.map(rowToItem);
}

/** Saved 30+ days ago, never opened, not already flagged this week — feeds "Still want this?" */
export async function getStaleUnopened(days = 30): Promise<SavedItem[]> {
  const db = await getDb();
  const cutoff = Date.now() - days * DAY_MS;
  const resurfaceCooldown = Date.now() - 7 * DAY_MS;
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE status = 'active' AND dateOpened IS NULL AND dateSaved <= ?
       AND (resurfacedAt IS NULL OR resurfacedAt <= ?)
       AND (snoozedUntil IS NULL OR snoozedUntil <= ?)
     ORDER BY dateSaved ASC`,
    [cutoff, resurfaceCooldown, Date.now()]
  );
  return rows.map(rowToItem);
}

export async function getWeeklyDigestData(): Promise<{ savedCount: number; topUnopened: SavedItem[] }> {
  const db = await getDb();
  const weekAgo = Date.now() - 7 * DAY_MS;
  const countRow = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM items WHERE status = 'active' AND dateSaved >= ?",
    [weekAgo]
  );
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM items WHERE status = 'active' AND dateSaved >= ? AND dateOpened IS NULL
     ORDER BY dateSaved DESC LIMIT 5`,
    [weekAgo]
  );
  return { savedCount: countRow?.c ?? 0, topUnopened: rows.map(rowToItem) };
}

export async function itemsWithPendingReminders(): Promise<SavedItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    "SELECT * FROM items WHERE status = 'active' AND reminderAt IS NOT NULL ORDER BY reminderAt ASC"
  );
  return rows.map(rowToItem);
}
