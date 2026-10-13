import { Alert } from 'react-native';
import { BigButton } from '../../components/BigButton';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionTitle } from '../../components/SectionTitle';
import { Segmented } from '../../components/Segmented';
import { Txt } from '../../components/Txt';
import { useProgress } from '../../storage/ProgressContext';
import { TextSize, ThemeMode, useSettings } from '../../storage/SettingsContext';

export function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { resetStoryProgress } = useProgress();

  const confirmReset = () =>
    Alert.alert('Reset study progress?', 'This un-marks every story you have completed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetStoryProgress },
    ]);

  return (
    <Screen>
      <SectionTitle title="Appearance" icon="contrast-outline" />
      <Card>
        <Segmented<ThemeMode>
          value={settings.themeMode}
          onChange={(themeMode) => updateSettings({ themeMode })}
          options={[
            { value: 'system', label: 'Automatic' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Txt variant="caption" muted style={{ marginTop: 10 }}>
          Automatic follows your phone's setting.
        </Txt>
      </Card>

      <SectionTitle title="Text size" icon="text-outline" />
      <Card>
        <Segmented<TextSize>
          value={settings.textSize}
          onChange={(textSize) => updateSettings({ textSize })}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'large', label: 'Large' },
            { value: 'xlarge', label: 'Largest' },
          ]}
        />
        <Txt style={{ marginTop: 12 }}>
          "Thy word is a lamp unto my feet, and a light unto my path." — Psalm 119:105
        </Txt>
      </Card>

      <SectionTitle title="Progress" icon="refresh-outline" />
      <BigButton label="Reset study progress" icon="trash-outline" kind="outline" onPress={confirmReset} />

      <Txt variant="caption" muted center style={{ marginTop: 24 }}>
        Scripture quotations are from the King James Version (public domain).
      </Txt>
    </Screen>
  );
}
