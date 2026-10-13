import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings, TextSize } from '../storage/SettingsContext';
import { darkPalette, lightPalette, Palette } from './colors';

const TEXT_SCALE: Record<TextSize, number> = {
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
};

// Base font sizes, before the user's text-size setting is applied.
const BASE_SIZES = {
  caption: 15,
  body: 18,
  heading: 21,
  title: 27,
  display: 34,
};

export type FontVariant = keyof typeof BASE_SIZES;

interface Theme {
  colors: Palette;
  isDark: boolean;
  fontSize: (variant: FontVariant) => number;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const systemScheme = useColorScheme();

  const theme = useMemo<Theme>(() => {
    const isDark =
      settings.themeMode === 'dark' || (settings.themeMode === 'system' && systemScheme === 'dark');
    const scale = TEXT_SCALE[settings.textSize];
    return {
      colors: isDark ? darkPalette : lightPalette,
      isDark,
      fontSize: (variant) => Math.round(BASE_SIZES[variant] * scale),
    };
  }, [settings.themeMode, settings.textSize, systemScheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
