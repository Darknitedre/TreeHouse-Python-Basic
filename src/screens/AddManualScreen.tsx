import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useVaultStore } from '@/store/useVaultStore';
import { TagInput } from '@/components/TagInput';
import { FolderPicker } from '@/components/FolderPicker';
import { ReminderSheet, ReminderChoice } from '@/components/ReminderSheet';
import { CategoryChip } from '@/components/CategoryChip';
import { categorize } from '@/services/categorize';
import { detectPlatform, platformLabel } from '@/services/platformDetect';
import { RootStackParamList } from '@/navigation/types';
import { DEFAULT_CATEGORIES } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddManual'>;

export function AddManualScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const addItem = useVaultStore((s) => s.addItem);

  const [url, setUrl] = useState(route.params?.prefillUrl ?? '');
  const [imageUri, setImageUri] = useState<string | null>(route.params?.prefillImageUri ?? null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [reminder, setReminder] = useState<ReminderChoice>({ preset: 'none' });
  const [saving, setSaving] = useState(false);

  const platform = detectPlatform(url || null);
  const effectiveCategory = category ?? categorize(`${title} ${note}`);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!url.trim() && !imageUri) {
      Alert.alert('Nothing to save', 'Paste a link or add a screenshot first.');
      return;
    }
    setSaving(true);
    try {
      const { duplicateOf } = await addItem({
        url: url.trim() || null,
        localImageUri: imageUri,
        title,
        note,
        category: effectiveCategory,
        tags,
        folderId,
        reminder,
      });
      if (duplicateOf) {
        Alert.alert('Heads up', 'Looks like you already saved this link — kept both, marked as a duplicate.');
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.header, { color: theme.text }]}>Save something</Text>

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
          ) : (
            <Pressable
              onPress={pickImage}
              style={[styles.imagePickerBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.textMuted }}>Add a screenshot or photo</Text>
            </Pressable>
          )}
          {imageUri && (
            <Pressable onPress={() => setImageUri(null)} style={{ marginTop: 6 }}>
              <Text style={{ color: theme.danger, fontSize: 13 }}>Remove image</Text>
            </Pressable>
          )}

          <Text style={[styles.label, { color: theme.textMuted }]}>Link</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="Paste an Instagram, TikTok, or Facebook link"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
          />
          {url.trim().length > 0 && (
            <Text style={[styles.hint, { color: theme.textMuted }]}>Detected: {platformLabel(platform)}</Text>
          )}

          <Text style={[styles.label, { color: theme.textMuted }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Give it a short title (optional)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Why I saved this</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="A quick note to your future self"
            placeholderTextColor={theme.textMuted}
            multiline
            style={[
              styles.input,
              styles.textArea,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt },
            ]}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Category</Text>
          <View style={styles.chipRow}>
            {DEFAULT_CATEGORIES.map((c) => (
              <CategoryChip key={c} label={c} selected={effectiveCategory === c} onPress={() => setCategory(c)} />
            ))}
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>Tags</Text>
          <TagInput tags={tags} onChange={setTags} />

          <Text style={[styles.label, { color: theme.textMuted }]}>Folder</Text>
          <FolderPicker selectedFolderId={folderId} onSelect={setFolderId} />

          <Text style={[styles.label, { color: theme.textMuted }]}>Reminder</Text>
          <ReminderSheet value={reminder} onChange={setReminder} />

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save to SaveVault'}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={{ alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: theme.textMuted }}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  header: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  hint: { fontSize: 12, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  imagePickerBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: 200, borderRadius: 12 },
  saveButton: { marginTop: 28, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
