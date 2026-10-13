import { setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ProgressProvider } from './src/storage/ProgressContext';
import { SettingsProvider, useSettings } from './src/storage/SettingsContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

// Let lessons play even when the iPhone's ring/silent switch is on silent.
setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

function ThemedApp() {
  const { loaded } = useSettings();
  const { isDark } = useTheme();
  // Wait for saved settings so the app doesn't flash the wrong theme.
  if (!loaded) return null;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ThemeProvider>
          <ProgressProvider>
            <ThemedApp />
          </ProgressProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
