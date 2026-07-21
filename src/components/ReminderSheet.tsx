import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useTheme } from '@/theme/ThemeProvider';
import { ReminderPreset } from '@/types';

export interface ReminderChoice {
  preset: ReminderPreset;
  date?: number;
}

export function ReminderSheet({
  value,
  onChange,
}: {
  value: ReminderChoice;
  onChange: (choice: ReminderChoice) => void;
}) {
  const { theme } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const options: { preset: ReminderPreset; label: string }[] = [
    { preset: 'none', label: 'No reminder' },
    { preset: 'tonight', label: 'Remind me tonight' },
    { preset: 'weekend', label: 'This weekend' },
    { preset: 'custom', label: 'Pick a date' },
  ];

  return (
    <View>
      <View style={styles.row}>
        {options.map((opt) => {
          const selected = value.preset === opt.preset;
          return (
            <Pressable
              key={opt.preset}
              onPress={() => {
                if (opt.preset === 'custom') {
                  setShowPicker(true);
                  onChange({ preset: 'custom', date: value.date ?? Date.now() + 3600_000 });
                } else {
                  onChange({ preset: opt.preset });
                }
              }}
              style={[
                styles.chip,
                { backgroundColor: selected ? theme.accent : theme.chipBg, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value.preset === 'custom' && value.date && (
        <Pressable onPress={() => setShowPicker(true)}>
          <Text style={{ color: theme.accent, marginTop: 4 }}>
            {dayjs(value.date).format('MMM D, YYYY [at] h:mm A')}
          </Text>
        </Pressable>
      )}

      {showPicker && (
        <DateTimePicker
          value={new Date(value.date ?? Date.now() + 3600_000)}
          mode="datetime"
          minimumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowPicker(Platform.OS === 'ios');
            if (event.type === 'dismissed') return;
            if (selectedDate) onChange({ preset: 'custom', date: selectedDate.getTime() });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
});
