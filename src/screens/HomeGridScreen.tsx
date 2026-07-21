import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { useVaultStore } from '@/store/useVaultStore';
import { Grid } from '@/components/Grid';
import { TabScreenProps } from '@/navigation/types';

type Props = TabScreenProps<'Home'>;

export function HomeGridScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const items = useVaultStore((s) => s.items);
  const refreshItems = useVaultStore((s) => s.refreshItems);

  useFocusEffect(
    useCallback(() => {
      refreshItems();
    }, [refreshItems])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>SaveVault</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{items.length} saved</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('AddManual', undefined)}
          style={[styles.addButton, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.addButtonText}>+ Save</Text>
        </Pressable>
      </View>

      <Grid
        items={items}
        onPressItem={(item) => navigation.navigate('ItemDetail', { itemId: item.id })}
        emptyLabel="Nothing saved yet. Share a reel, post, or screenshot into SaveVault, or tap + Save."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
