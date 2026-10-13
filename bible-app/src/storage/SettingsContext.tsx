import { createContext, ReactNode, useContext, useMemo } from 'react';
import { KEYS } from './storage';
import { usePersistedState } from './usePersistedState';

export type ThemeMode = 'system' | 'light' | 'dark';
export type TextSize = 'normal' | 'large' | 'xlarge';

export interface Settings {
  themeMode: ThemeMode;
  textSize: TextSize;
}

const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  textSize: 'normal',
};

interface SettingsValue {
  settings: Settings;
  loaded: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings, loaded] = usePersistedState(KEYS.settings, DEFAULT_SETTINGS);

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      loaded,
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
    }),
    [settings, loaded, setSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
