import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import dayjs from 'dayjs';
import { useTheme } from '@/theme/ThemeProvider';
import { platformColors } from '@/theme/colors';
import { platformLabel } from '@/services/platformDetect';
import { SavedItem } from '@/types';

export function SaveCard({ item, onPress }: { item: SavedItem; onPress: () => void }) {
  const { theme } = useTheme();
  const isUnopened = !item.dateOpened;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={[styles.thumbWrap, { backgroundColor: theme.surfaceAlt }]}>
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={{ color: theme.textMuted, fontSize: 28 }}>
              {platformLabel(item.platform).charAt(0)}
            </Text>
          </View>
        )}
        {isUnopened && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
        <View style={[styles.platformBadge, { backgroundColor: platformColors[item.platform] ?? theme.accent }]}>
          <Text style={styles.platformBadgeText}>{platformLabel(item.platform)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
          {item.title || item.note || 'Untitled save'}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.category, { color: theme.accent }]} numberOfLines={1}>
            {item.category}
          </Text>
          <Text style={[styles.date, { color: theme.textMuted }]}>{dayjs(item.dateSaved).format('MMM D')}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    flex: 1,
    margin: 6,
  },
  thumbWrap: {
    aspectRatio: 0.8,
    width: '100%',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  platformBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  platformBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    padding: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  category: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  date: {
    fontSize: 11,
  },
});
