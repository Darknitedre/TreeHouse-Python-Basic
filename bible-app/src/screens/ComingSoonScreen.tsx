import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { View } from 'react-native';
import { Txt } from '../components/Txt';
import { useTheme } from '../theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function ComingSoonScreen({ phase, icon, blurb }: { phase: number; icon: IconName; blurb: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, backgroundColor: colors.background }}>
      <Ionicons name={icon} size={72} color={colors.primary} />
      <Txt variant="title" center>
        Coming soon
      </Txt>
      <Txt center muted>
        {blurb}
      </Txt>
      <Txt variant="caption" center muted>
        (Phase {phase})
      </Txt>
    </View>
  );
}
