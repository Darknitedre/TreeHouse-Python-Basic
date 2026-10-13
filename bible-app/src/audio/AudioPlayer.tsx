import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { ComponentProps, ReactNode, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ProgressBar } from '../components/ProgressBar';
import { Segmented } from '../components/Segmented';
import { Txt } from '../components/Txt';
import { useTheme } from '../theme/ThemeProvider';
import { estimateSeconds, formatTime, TextSegment } from './segments';
import { PlayerSection } from './types';
import { SPEEDS, usePlayer } from './usePlayer';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  sections: PlayerSection[];
  /** Shown above the text (e.g. a title). */
  header?: ReactNode;
}

/**
 * A complete listening screen: the text with the current part highlighted,
 * plus play/pause, skip by section, speed, and progress.
 * Reuse it anywhere by passing a list of sections.
 */
export function AudioPlayer({ sections, header }: Props) {
  const { colors } = useTheme();
  const player = usePlayer(sections);
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  const paragraphY = useRef<Record<string, number>>({});
  const sectionY = useRef<Record<number, number>>({});

  // Pause if the person leaves this screen.
  const { pause } = player;
  useEffect(() => {
    if (!isFocused) pause();
  }, [isFocused, pause]);

  // Group segments by section and paragraph so we can draw the text.
  const layout = useMemo(() => {
    const bySection: { segment: TextSegment; index: number }[][][] = sections.map(() => []);
    player.segments.forEach((segment, index) => {
      const paragraphs = bySection[segment.sectionIndex];
      if (!paragraphs[segment.paragraph]) paragraphs[segment.paragraph] = [];
      paragraphs[segment.paragraph].push({ segment, index });
    });
    return bySection;
  }, [sections, player.segments]);

  // Keep the current paragraph in view while playing.
  const current = player.segments[player.index];
  useEffect(() => {
    if (!current || player.status === 'idle') return;
    const sy = sectionY.current[current.sectionIndex] ?? 0;
    const py = paragraphY.current[`${current.sectionIndex}-${current.paragraph}`] ?? 0;
    // At the start of a part, show its title too.
    const y = current.paragraph === 0 ? sy - 8 : sy + py - 24;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, [current, player.status]);

  const elapsed = estimateSeconds(player.doneWords, player.rate);
  const total = estimateSeconds(player.totalWords, player.rate);
  const playing = player.status === 'playing';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {header}
        {sections.map((section, s) => {
          const active = s === player.currentSection && player.status !== 'idle';
          return (
            <View
              key={section.id}
              onLayout={(e) => (sectionY.current[s] = e.nativeEvent.layout.y)}
              style={{
                marginBottom: 12,
                padding: 16,
                borderRadius: 16,
                borderWidth: active ? 3 : 1,
                borderColor: active ? colors.primary : colors.cardBorder,
                backgroundColor: active ? colors.highlight : colors.card,
              }}
            >
              <Pressable
                onPress={() => player.goToSection(s)}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${section.title}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 44 }}
              >
                <Ionicons
                  name={active && playing ? 'volume-high' : 'play-circle-outline'}
                  size={26}
                  color={colors.primary}
                />
                <Txt variant="heading" color={colors.primary} style={{ flex: 1 }}>
                  {section.title}
                </Txt>
              </Pressable>
              {layout[s].map((paragraph, p) => (
                <View
                  key={p}
                  onLayout={(e) => (paragraphY.current[`${s}-${p}`] = e.nativeEvent.layout.y)}
                  style={{ marginBottom: 12 }}
                >
                  <Txt>
                    {paragraph.map(({ segment, index }) => {
                      const isCurrent = index === player.index && player.status !== 'idle';
                      return (
                        <Text
                          key={index}
                          onPress={() => player.goToSection(s)}
                          style={
                            isCurrent
                              ? { fontWeight: '700', textDecorationLine: 'underline', textDecorationColor: colors.primary }
                              : undefined
                          }
                        >
                          {segment.text}{' '}
                        </Text>
                      );
                    })}
                  </Txt>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Controls stay docked at the bottom so they're always reachable. */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          backgroundColor: colors.card,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          gap: 8,
        }}
      >
        {player.error ? (
          <Txt variant="caption" color={colors.danger} center>
            {player.error}
          </Txt>
        ) : null}
        <ProgressBar value={player.progress} height={10} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt variant="caption" muted>
            {formatTime(elapsed)}
          </Txt>
          <Txt variant="caption" muted>
            Part {player.currentSection + 1} of {sections.length}
          </Txt>
          <Txt variant="caption" muted>
            ~{formatTime(total)}
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
          <RoundButton icon="play-skip-back" label="Previous part" onPress={player.prevSection} size={56} />
          <RoundButton
            icon={playing ? 'pause' : 'play'}
            label={playing ? 'Pause' : player.status === 'finished' ? 'Play again' : 'Play'}
            onPress={player.togglePlay}
            size={76}
            filled
          />
          <RoundButton icon="play-skip-forward" label="Next part" onPress={player.nextSection} size={56} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt variant="caption" bold>
            Speed
          </Txt>
          <View style={{ flex: 1 }}>
            <Segmented
              value={String(player.rate)}
              onChange={(v) => player.setRate(Number(v))}
              options={SPEEDS.map((s) => ({ value: String(s), label: `${s}x` }))}
              compact
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  size,
  filled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size: number;
  filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: filled ? colors.primary : colors.primarySoft,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={size * 0.45} color={filled ? colors.onPrimary : colors.primary} />
    </Pressable>
  );
}
