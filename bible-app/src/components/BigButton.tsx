import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './Txt';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** filled = main action, outline = secondary, success = "done" state */
  kind?: 'filled' | 'outline' | 'success';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/** A large, easy-to-tap button (at least 56pt tall). */
export function BigButton({ label, onPress, icon, kind = 'filled', disabled, style, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const bg = kind === 'filled' ? colors.primary : kind === 'success' ? colors.successSoft : 'transparent';
  const fg = kind === 'filled' ? colors.onPrimary : kind === 'success' ? colors.success : colors.primary;
  const border = kind === 'outline' ? colors.primary : kind === 'success' ? colors.success : bg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        {
          minHeight: 56,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: border,
          backgroundColor: bg,
          paddingHorizontal: 20,
          paddingVertical: 12,
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        {icon ? <Ionicons name={icon} size={24} color={fg} /> : null}
        <Txt bold color={fg} style={{ flexShrink: 1 }}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}
