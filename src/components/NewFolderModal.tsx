import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function NewFolderModal({
  visible,
  onClose,
  onCreate,
  title = 'New folder',
  initialValue = '',
  submitLabel = 'Create',
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  title?: string;
  initialValue?: string;
  submitLabel?: string;
}) {
  const { theme } = useTheme();
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    if (visible) setName(initialValue);
  }, [visible, initialValue]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
          <Text style={[styles.dialogTitle, { color: theme.text }]}>{title}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Folder name"
            placeholderTextColor={theme.textMuted}
            autoFocus
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            onSubmitEditing={handleCreate}
          />
          <View style={styles.dialogActions}>
            <Pressable onPress={onClose} style={styles.dialogButton}>
              <Text style={{ color: theme.textMuted }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleCreate} style={styles.dialogButton}>
              <Text style={{ color: theme.accent, fontWeight: '700' }}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 20,
  },
  dialogButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
});
