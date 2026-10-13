import { Text, TextProps } from 'react-native';
import { FontVariant, useTheme } from '../theme/ThemeProvider';

interface Props extends TextProps {
  variant?: FontVariant;
  muted?: boolean;
  bold?: boolean;
  color?: string;
  center?: boolean;
}

/** Themed text that follows the user's text-size and light/dark settings. */
export function Txt({ variant = 'body', muted, bold, color, center, style, ...rest }: Props) {
  const { colors, fontSize } = useTheme();
  const size = fontSize(variant);
  const isHeading = variant === 'heading' || variant === 'title' || variant === 'display';
  return (
    <Text
      style={[
        {
          fontSize: size,
          lineHeight: Math.round(size * (isHeading ? 1.25 : 1.45)),
          color: color ?? (muted ? colors.textMuted : colors.text),
          fontWeight: bold || isHeading ? '700' : '400',
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}
