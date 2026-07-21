import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const cleaned = draft.trim().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned)) {
      onChange([...tags, cleaned]);
    }
    setDraft('');
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <View>
      <View style={styles.row}>
        {tags.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => removeTag(tag)}
            style={[styles.chip, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
          >
            <Text style={{ color: theme.text, fontSize: 13 }}>#{tag} ×</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commitDraft}
        onBlur={commitDraft}
        placeholder="Add a tag and press return"
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
