import { create } from 'zustand';
import * as itemsRepo from '@/db/itemsRepo';
import * as foldersRepo from '@/db/foldersRepo';
import { scheduleItemReminder, cancelScheduledNotification } from '@/services/notifications';
import { Folder, NewSaveInput, SavedItem } from '@/types';

interface VaultState {
  items: SavedItem[];
  folders: Folder[];
  folderCounts: Record<string, number>;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  refreshItems: () => Promise<void>;
  refreshFolders: () => Promise<void>;
  addItem: (input: NewSaveInput) => Promise<{ item: SavedItem; duplicateOf: SavedItem | null }>;
  updateItem: (
    id: string,
    patch: Partial<Pick<SavedItem, 'title' | 'note' | 'category' | 'tags' | 'folderId'>>
  ) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  openItem: (id: string) => Promise<void>;
  setReminder: (id: string, preset: NonNullable<NewSaveInput['reminder']>['preset'], customDate?: number) => Promise<void>;
  createFolder: (name: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;
  keepStale: (id: string) => Promise<void>;
  snoozeStale: (id: string, days?: number) => Promise<void>;
  deleteStale: (id: string) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  items: [],
  folders: [],
  folderCounts: {},
  hydrated: false,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    await Promise.all([get().refreshItems(), get().refreshFolders()]);
    set({ hydrated: true, loading: false });
  },

  refreshItems: async () => {
    const items = await itemsRepo.getAllActive();
    set({ items });
  },

  refreshFolders: async () => {
    const [folders, folderCounts] = await Promise.all([
      foldersRepo.getAllFolders(),
      foldersRepo.folderItemCounts(),
    ]);
    set({ folders, folderCounts });
  },

  addItem: async (input) => {
    const { item, duplicateOf } = await itemsRepo.createItem(input);
    let finalItem = item;

    if (input.reminder && input.reminder.preset !== 'none') {
      const scheduled = await scheduleItemReminder(item, input.reminder.preset, input.reminder.date);
      if (scheduled) {
        await itemsRepo.setReminder(item.id, scheduled.reminderAt, scheduled.notificationId);
        finalItem = { ...item, reminderAt: scheduled.reminderAt, reminderNotificationId: scheduled.notificationId };
      }
    }

    await get().refreshItems();
    await get().refreshFolders();
    return { item: finalItem, duplicateOf };
  },

  updateItem: async (id, patch) => {
    await itemsRepo.updateItem(id, patch);
    await get().refreshItems();
    await get().refreshFolders();
  },

  deleteItem: async (id) => {
    const item = get().items.find((i) => i.id === id);
    await cancelScheduledNotification(item?.reminderNotificationId ?? null);
    await itemsRepo.softDelete(id);
    set({ items: get().items.filter((i) => i.id !== id) });
    await get().refreshFolders();
  },

  openItem: async (id) => {
    await itemsRepo.markOpened(id);
    set({
      items: get().items.map((i) =>
        i.id === id ? { ...i, dateOpened: Date.now(), openCount: i.openCount + 1, resurfacedAt: null } : i
      ),
    });
  },

  setReminder: async (id, preset, customDate) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    await cancelScheduledNotification(item.reminderNotificationId);
    const scheduled = preset === 'none' ? null : await scheduleItemReminder(item, preset, customDate);
    await itemsRepo.setReminder(id, scheduled?.reminderAt ?? null, scheduled?.notificationId ?? null);
    await get().refreshItems();
  },

  createFolder: async (name) => {
    const folder = await foldersRepo.createFolder(name);
    await get().refreshFolders();
    return folder;
  },

  deleteFolder: async (id) => {
    await foldersRepo.deleteFolder(id);
    await Promise.all([get().refreshFolders(), get().refreshItems()]);
  },

  keepStale: async (id) => {
    await itemsRepo.markResurfaced(id);
    await get().refreshItems();
  },

  snoozeStale: async (id, days = 14) => {
    await itemsRepo.snoozeItem(id, days);
    await get().refreshItems();
  },

  deleteStale: async (id) => {
    await get().deleteItem(id);
  },
}));
