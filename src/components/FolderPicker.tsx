import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useVaultStore } from '@/store/useVaultStore';
import { NewFolderModal } from '@/components/NewFolderModal';
import { Folder } from '@/types';

export function FolderPicker({
  selectedFolderId,
  onSelect,
}: {
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}) {
  const { theme } = useTheme();
  const folders = useVaultStore((s) => s.folders);
  const createFolder = useVaultStore((s) => s.createFolder);
  const [modalVisible, setModalVisible] = useState(false);

  const handleCreate = async (name: string) => {
    const folder = await createFolder(name);
    setModalVisible(false);
    onSelect(folder.id);
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <FolderChip label="No folder" selected={!selectedFolderId} onPress={() => onSelect(null)} theme={theme} />
        {folders.map((f: Folder) => (
          <FolderChip
            key={f.id}
            label={f.name}
            color={f.color}
            selected={selectedFolderId === f.id}
            onPress={() => onSelect(f.id)}
            theme={theme}
          />
        ))}
        <FolderChip label="+ New folder" onPress={() => setModalVisible(true)} theme={theme} />
      </ScrollView>

      <NewFolderModal visible={modalVisible} onClose={() => setModalVisible(false)} onCreate={handleCreate} />
    </View>
  );
}

function FolderChip({
  label,
  color,
  selected,
  onPress,
  theme,
}: {
  label: string;
  color?: string;
  selected?: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? theme.accent : theme.chipBg, borderColor: color ?? theme.border },
      ]}
    >
      <Text style={{ color: selected ? '#fff' : theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    marginRight: 8,
  },
});
