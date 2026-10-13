import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** A horizontal bar. `value` is between 0 and 1. */
export function ProgressBar({ value, color, height = 14 }: { value: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{ height, borderRadius: height / 2, backgroundColor: colors.track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color ?? colors.primary, borderRadius: height / 2 }} />
    </View>
  );
}
