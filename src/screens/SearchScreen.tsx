import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Grid } from '@/components/Grid';
import { CategoryChip } from '@/components/CategoryChip';
import { searchItems } from '@/db/itemsRepo';
import { extractSearchKeywords } from '@/services/askMySaves';
import { platformLabel } from '@/services/platformDetect';
import { DEFAULT_CATEGORIES, Platform as PlatformSource, SavedItem } from '@/types';
import { TabScreenProps } from '@/navigation/types';

type Props = TabScreenProps<'Search'>;

const PLATFORMS: PlatformSource[] = ['instagram', 'tiktok', 'facebook', 'youtube', 'web', 'manual'];

export function SearchScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PlatformSource | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<SavedItem[]>([]);

  const effectiveQuery = useMemo(() => {
    const words = query.trim().split(/\s+/).filter(Boolean);
    // Treat anything with 4+ words as a natural-language "ask my saves" style question.
    return words.length >= 4 ? extractSearchKeywords(query) : query;
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    searchItems(effectiveQuery, {
      platform: platform ?? undefined,
      category: category ?? undefined,
    }).then((res) => {
      if (!cancelled) setResults(res);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveQuery, platform, category]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Search</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder='Try "that jerk chicken recipe from last month"'
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {PLATFORMS.map((p) => (
            <CategoryChip
              key={p}
              label={platformLabel(p)}
              selected={platform === p}
              onPress={() => setPlatform(platform === p ? null : p)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {DEFAULT_CATEGORIES.map((c) => (
            <CategoryChip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
          ))}
        </ScrollView>
      </View>

      <Grid
        items={results}
        onPressItem={(item) => navigation.navigate('ItemDetail', { itemId: item.id })}
        emptyLabel={query ? 'No saves match that yet.' : 'Search titles, notes, tags, and categories.'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  filterRow: { marginTop: 10 },
});
