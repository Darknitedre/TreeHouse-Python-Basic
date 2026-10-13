import { Ionicons } from '@expo/vector-icons';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { RootStackParamList } from './types';

/** Gear icon shown in the top-right of each tab's header. */
export function SettingsButton() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => navigation.navigate('Settings')}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={12}
      style={{ padding: 6 }}
    >
      <Ionicons name="settings-outline" size={26} color={colors.primary} />
    </Pressable>
  );
}
