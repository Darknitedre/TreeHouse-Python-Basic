import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useVaultStore } from '@/store/useVaultStore';
import { Grid } from '@/components/Grid';
import { NewFolderModal } from '@/components/NewFolderModal';
import { renameFolder } from '@/db/foldersRepo';
import { getByFolder } from '@/db/itemsRepo';
import { RootStackParamList } from '@/navigation/types';
import { SavedItem } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FolderDetail'>;

export function FolderDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { folderId } = route.params;
  const folder = useVaultStore((s) => s.folders.find((f) => f.id === folderId));
  const deleteFolder = useVaultStore((s) => s.deleteFolder);
  const refreshFolders = useVaultStore((s) => s.refreshFolders);
  const items = useVaultStore((s) => s.items);
  const [folderItems, setFolderItems] = useState<SavedItem[]>([]);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    getByFolder(folderId).then(setFolderItems);
  }, [folderId, items]);

  const handleDelete = () => {
    Alert.alert('Delete folder?', 'Saves inside will move to "No folder".', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFolder(folderId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => setRenaming(true)} style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{folder?.name ?? 'Folder'}</Text>
        </Pressable>
        <Pressable onPress={handleDelete}>
          <Text style={{ color: theme.danger, fontWeight: '700' }}>Delete</Text>
        </Pressable>
      </View>

      <NewFolderModal
        visible={renaming}
        onClose={() => setRenaming(false)}
        title="Rename folder"
        initialValue={folder?.name ?? ''}
        submitLabel="Save"
        onCreate={async (name) => {
          await renameFolder(folderId, name);
          await refreshFolders();
          setRenaming(false);
        }}
      />

      <Grid
        items={folderItems}
        onPressItem={(item) => navigation.navigate('ItemDetail', { itemId: item.id })}
        emptyLabel="No saves in this folder yet."
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
    paddingBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '800' },
});
