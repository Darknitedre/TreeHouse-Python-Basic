import { getDb } from '@/db/client';
import { generateId } from '@/utils/id';
import { Folder } from '@/types';

const FOLDER_COLORS = ['#7C5CFF', '#4ADE80', '#FF8A5C', '#5CC8FF', '#FF5C9C', '#FFD65C'];

export async function createFolder(name: string, color?: string): Promise<Folder> {
  const db = await getDb();
  const id = generateId();
  const createdAt = Date.now();
  const resolvedColor = color ?? FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];
  await db.runAsync('INSERT INTO folders (id, name, color, createdAt) VALUES (?, ?, ?, ?)', [
    id,
    name.trim(),
    resolvedColor,
    createdAt,
  ]);
  return { id, name: name.trim(), color: resolvedColor, createdAt };
}

export async function getAllFolders(): Promise<Folder[]> {
  const db = await getDb();
  return db.getAllAsync<Folder>('SELECT * FROM folders ORDER BY name ASC');
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE folders SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE items SET folderId = NULL WHERE folderId = ?', [id]);
  await db.runAsync('DELETE FROM folders WHERE id = ?', [id]);
}

export async function folderItemCounts(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ folderId: string; c: number }>(
    "SELECT folderId, COUNT(*) as c FROM items WHERE status = 'active' AND folderId IS NOT NULL GROUP BY folderId"
  );
  return Object.fromEntries(rows.map((r) => [r.folderId, r.c]));
}
