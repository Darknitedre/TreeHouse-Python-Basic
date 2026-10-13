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
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
              minHeight: 52,
              minWidth: 90,
              paddingHorizontal: 12,
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
