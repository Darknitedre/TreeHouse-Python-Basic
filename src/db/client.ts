import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  url TEXT,
  localImageUri TEXT,
  thumbnailUri TEXT,
  platform TEXT NOT NULL DEFAULT 'manual',
  title TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Uncategorized',
  tags TEXT NOT NULL DEFAULT '[]',
  folderId TEXT,
  dateSaved INTEGER NOT NULL,
  dateOpened INTEGER,
  openCount INTEGER NOT NULL DEFAULT 0,
  reminderAt INTEGER,
  reminderNotificationId TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  duplicateOfId TEXT,
  urlHash TEXT,
  resurfacedAt INTEGER,
  snoozedUntil INTEGER
);

CREATE INDEX IF NOT EXISTS idx_items_urlHash ON items(urlHash);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_folder ON items(folderId);
CREATE INDEX IF NOT EXISTS idx_items_dateSaved ON items(dateSaved);

CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  id UNINDEXED, title, note, tags, category
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(SCHEMA_SQL);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('savevault.db').then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}
