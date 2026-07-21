import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Grid } from '@/components/Grid';
import { getWeeklyDigestData } from '@/db/itemsRepo';
import { RootStackParamList } from '@/navigation/types';
import { SavedItem } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Digest'>;

export function DigestScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [savedCount, setSavedCount] = useState(0);
  const [topUnopened, setTopUnopened] = useState<SavedItem[]>([]);

  useEffect(() => {
    getWeeklyDigestData().then(({ savedCount, topUnopened }) => {
      setSavedCount(savedCount);
      setTopUnopened(topUnopened);
    });
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>This week</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          You saved {savedCount} item{savedCount === 1 ? '' : 's'} — here{topUnopened.length ? "'s" : ' are'} the top{' '}
          {topUnopened.length} you haven't opened
        </Text>
      </View>
      <Grid
        items={topUnopened}
        onPressItem={(item) => navigation.navigate('ItemDetail', { itemId: item.id })}
        emptyLabel="You're all caught up — nothing unopened this week."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
});
