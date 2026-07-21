import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.chipBg,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: selected ? '#fff' : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
