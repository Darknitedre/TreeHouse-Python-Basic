import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function SectionTitle({ title, icon }: { title: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="header"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 }}
    >
      {icon ? <Ionicons name={icon} size={22} color={colors.primary} /> : null}
      <Txt variant="heading" color={colors.primary}>
        {title}
      </Txt>
    </View>
  );
}
