import AsyncStorage from '@react-native-async-storage/async-storage';

// All keys the app saves on the device live here, so they're easy to find.
export const KEYS = {
  settings: 'bible.v1.settings',
  completedStories: 'bible.v1.completedStories',
} as const;

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Saving is best-effort; the app keeps working with in-memory state.
  }
}
