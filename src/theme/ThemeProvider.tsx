import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, Theme } from '@/theme/colors';
import { getSetting, setSetting } from '@/db/settingsRepo';

export type ThemeMode = 'system' | 'dark' | 'light';
const THEME_SETTING_KEY = 'themeMode';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    getSetting(THEME_SETTING_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light' || saved === 'system') setModeState(saved);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    setSetting(THEME_SETTING_KEY, next).catch(() => {});
  };

  const isDark = mode === 'system' ? systemScheme !== 'light' : mode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const value = useMemo(() => ({ theme, mode, isDark, setMode }), [theme, mode, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
