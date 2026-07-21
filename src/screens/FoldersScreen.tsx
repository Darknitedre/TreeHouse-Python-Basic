import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useVaultStore } from '@/store/useVaultStore';
import { NewFolderModal } from '@/components/NewFolderModal';
import { TabScreenProps } from '@/navigation/types';
import { Folder } from '@/types';

type Props = TabScreenProps<'Folders'>;

export function FoldersScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const folders = useVaultStore((s) => s.folders);
  const folderCounts = useVaultStore((s) => s.folderCounts);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);
  const createFolder = useVaultStore((s) => s.createFolder);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshFolders();
    }, [refreshFolders])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Folders</Text>
        <Pressable onPress={() => setModalVisible(true)} style={[styles.addButton, { backgroundColor: theme.accent }]}>
          <Text style={styles.addButtonText}>+ New</Text>
        </Pressable>
      </View>

      <NewFolderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreate={async (name) => {
          await createFolder(name);
          setModalVisible(false);
        }}
      />

      <FlatList
        data={folders}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={{ color: theme.textMuted, paddingHorizontal: 16, marginTop: 24 }}>
            No folders yet. Create one to group your saves.
          </Text>
        }
        renderItem={({ item }: { item: Folder }) => (
          <Pressable
            onPress={() => navigation.navigate('FolderDetail', { folderId: item.id })}
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            <Text style={[styles.rowLabel, { color: theme.text }]}>{item.name}</Text>
            <Text style={{ color: theme.textMuted }}>{folderCounts[item.id] ?? 0}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { fontSize: 22, fontWeight: '800' },
  addButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  addButtonText: { color: '#fff', fontWeight: '700' },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});
