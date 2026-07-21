import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { SaveCard } from '@/components/SaveCard';
import { SavedItem } from '@/types';

export function Grid({
  items,
  onPressItem,
  emptyLabel,
}: {
  items: SavedItem[];
  onPressItem: (item: SavedItem) => void;
  emptyLabel?: string;
}) {
  const { theme } = useTheme();

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>
          {emptyLabel ?? 'Nothing saved here yet.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <SaveCard item={item} onPress={() => onPressItem(item)} />}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 6,
    paddingBottom: 96,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
