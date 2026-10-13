import { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** A scrolling page with the app background and comfortable padding. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { colors } = useTheme();
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {children}
    </ScrollView>
  );
}
