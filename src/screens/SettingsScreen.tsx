import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, ThemeMode } from '@/theme/ThemeProvider';
import { useVaultStore } from '@/store/useVaultStore';
import { requestNotificationPermissions } from '@/services/notifications';
import { runBackgroundChecks } from '@/services/backgroundChecks';
import { TabScreenProps } from '@/navigation/types';

type Props = TabScreenProps<'Settings'>;

const MODES: { mode: ThemeMode; label: string }[] = [
  { mode: 'dark', label: 'Dark' },
  { mode: 'light', label: 'Light' },
  { mode: 'system', label: 'System' },
];

export function SettingsScreen({ navigation }: Props) {
  const { theme, mode, setMode } = useTheme();
  const items = useVaultStore((s) => s.items);
  const folders = useVaultStore((s) => s.folders);
  const [checking, setChecking] = useState(false);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermissions();
    Alert.alert(granted ? 'Notifications enabled' : 'Not enabled', granted ? 'Reminders and digests will now notify you.' : 'You can enable this later from your phone settings.');
  };

  const handleRunDigestCheck = async () => {
    setChecking(true);
    try {
      const { staleNotified } = await runBackgroundChecks();
      Alert.alert('Checked', `${staleNotified} forgotten save(s) resurfaced.`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Stats</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.text }}>{items.length} saves · {folders.length} folders</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Appearance</Text>
        <View style={styles.row}>
          {MODES.map((m) => (
            <Pressable
              key={m.mode}
              onPress={() => setMode(m.mode)}
              style={[
                styles.chip,
                { backgroundColor: mode === m.mode ? theme.accent : theme.chipBg, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: mode === m.mode ? '#fff' : theme.text, fontWeight: '600' }}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Notifications</Text>
        <Pressable onPress={handleEnableNotifications} style={[styles.button, { borderColor: theme.border }]}>
          <Text style={{ color: theme.text }}>Enable reminders & weekly digest</Text>
        </Pressable>
        <Pressable
          onPress={handleRunDigestCheck}
          disabled={checking}
          style={[styles.button, { borderColor: theme.border, opacity: checking ? 0.6 : 1 }]}
        >
          <Text style={{ color: theme.text }}>{checking ? 'Checking…' : 'Check for forgotten saves now'}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Digest')} style={[styles.button, { borderColor: theme.border }]}>
          <Text style={{ color: theme.text }}>View this week's digest</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>About</Text>
        <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 20 }}>
          SaveVault stores links and your own screenshots — never scraped or downloaded video files —
          so it stays on the right side of Instagram, TikTok, and Facebook's terms of service.
          {'\n\n'}
          v1 (this build): share-sheet saving, folders/tags, full-text search, and reminders.
          {'\n'}
          v2 (planned): real AI categorization + content descriptions, natural-language "ask my
          saves", and a true background-scheduled weekly digest. See README for details.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginRight: 8 },
  button: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
});
