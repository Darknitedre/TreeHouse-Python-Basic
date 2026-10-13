import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Txt } from './Txt';

interface Option<T extends string> {
  value: T;
  label: string;
}

/** A row of large buttons where exactly one is selected. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Keep all options on one row (for short labels like "1x"). */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: compact ? 'nowrap' : 'wrap', gap: compact ? 6 : 8 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={{
              flexGrow: 1,
              flexBasis: compact ? 0 : undefined,
              minHeight: compact ? 48 : 52,
              minWidth: compact ? 0 : 90,
              paddingHorizontal: compact ? 4 : 12,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: selected ? colors.primary : colors.cardBorder,
              backgroundColor: selected ? colors.primarySoft : colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt bold={selected} color={selected ? colors.primary : colors.text}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
