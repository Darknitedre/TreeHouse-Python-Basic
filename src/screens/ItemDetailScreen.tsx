import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import dayjs from 'dayjs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useVaultStore } from '@/store/useVaultStore';
import { TagInput } from '@/components/TagInput';
import { FolderPicker } from '@/components/FolderPicker';
import { ReminderSheet, ReminderChoice } from '@/components/ReminderSheet';
import { CategoryChip } from '@/components/CategoryChip';
import { platformLabel } from '@/services/platformDetect';
import { RootStackParamList } from '@/navigation/types';
import { DEFAULT_CATEGORIES } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { itemId } = route.params;
  const item = useVaultStore((s) => s.items.find((i) => i.id === itemId));
  const updateItem = useVaultStore((s) => s.updateItem);
  const deleteItem = useVaultStore((s) => s.deleteItem);
  const openItem = useVaultStore((s) => s.openItem);
  const setReminder = useVaultStore((s) => s.setReminder);

  const [note, setNote] = useState(item?.note ?? '');
  const [title, setTitle] = useState(item?.title ?? '');

  useEffect(() => {
    if (item) {
      setNote(item.note);
      setTitle(item.title);
    }
  }, [item?.id]);

  const reminderChoice: ReminderChoice = useMemo(
    () => ({ preset: item?.reminderAt ? 'custom' : 'none', date: item?.reminderAt ?? undefined }),
    [item?.reminderAt]
  );

  if (!item) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textMuted, padding: 24 }}>This save no longer exists.</Text>
      </SafeAreaView>
    );
  }

  const handleOpenLink = async () => {
    await openItem(item.id);
    if (item.url) {
      const supported = await Linking.canOpenURL(item.url);
      if (supported) Linking.openURL(item.url);
    }
  };

  const commitTextEdits = () => {
    if (title !== item.title || note !== item.note) {
      updateItem(item.id, { title, note });
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete this save?', 'This removes it from SaveVault.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteItem(item.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onScrollEndDrag={commitTextEdits}>
        {item.thumbnailUri && <Image source={{ uri: item.thumbnailUri }} style={styles.preview} contentFit="cover" />}

        <View style={styles.metaRow}>
          <Text style={[styles.platform, { color: theme.accent }]}>{platformLabel(item.platform)}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>
            Saved {dayjs(item.dateSaved).format('MMM D, YYYY')}
          </Text>
        </View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={commitTextEdits}
          placeholder="Untitled save"
          placeholderTextColor={theme.textMuted}
          style={[styles.titleInput, { color: theme.text }]}
        />

        {item.url && (
          <Pressable onPress={handleOpenLink} style={[styles.openButton, { backgroundColor: theme.accent }]}>
            <Text style={styles.openButtonText}>Open original ↗</Text>
          </Pressable>
        )}
        {item.dateOpened && (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>
            Opened {item.openCount}× · last {dayjs(item.dateOpened).format('MMM D, h:mm A')}
          </Text>
        )}

        <Text style={[styles.label, { color: theme.textMuted }]}>Why I saved this</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={commitTextEdits}
          placeholder="Add a note"
          placeholderTextColor={theme.textMuted}
          multiline
          style={[styles.noteInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Category</Text>
        <View style={styles.chipRow}>
          {DEFAULT_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={c}
              selected={item.category === c}
              onPress={() => updateItem(item.id, { category: c })}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>Tags</Text>
        <TagInput tags={item.tags} onChange={(tags) => updateItem(item.id, { tags })} />

        <Text style={[styles.label, { color: theme.textMuted }]}>Folder</Text>
        <FolderPicker selectedFolderId={item.folderId} onSelect={(folderId) => updateItem(item.id, { folderId })} />

        <Text style={[styles.label, { color: theme.textMuted }]}>Reminder</Text>
        <ReminderSheet
          value={reminderChoice}
          onChange={(choice) => setReminder(item.id, choice.preset, choice.date)}
        />

        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={{ color: theme.danger, fontWeight: '700' }}>Delete save</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  preview: { width: '100%', height: 260, borderRadius: 14, marginBottom: 12 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  platform: { fontWeight: '700', fontSize: 13 },
  titleInput: { fontSize: 22, fontWeight: '800', marginTop: 10, padding: 0 },
  openButton: { marginTop: 14, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  openButtonText: { color: '#fff', fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 20, marginBottom: 6 },
  noteInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  deleteButton: { marginTop: 32, alignItems: 'center', paddingVertical: 12 },
});
