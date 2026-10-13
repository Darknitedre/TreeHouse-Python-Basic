import { useCallback, useEffect, useRef, useState } from 'react';
import { loadJSON, saveJSON } from './storage';

/**
 * Like useState, but the value is loaded from and saved to the device.
 * `loaded` is false until the saved value has been read.
 */
export function usePersistedState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const fallbackRef = useRef(fallback);

  useEffect(() => {
    let active = true;
    loadJSON<T>(key, fallbackRef.current).then((saved) => {
      if (!active) return;
      // Merge objects so new settings fields get their defaults.
      const merged =
        isPlainObject(saved) && isPlainObject(fallbackRef.current)
          ? ({ ...fallbackRef.current, ...saved } as T)
          : saved;
      setValue(merged);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        saveJSON(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update, loaded] as const;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
