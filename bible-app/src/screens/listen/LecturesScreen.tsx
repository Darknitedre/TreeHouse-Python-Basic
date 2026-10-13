import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, SectionList, View } from 'react-native';
import { estimateSeconds, countWords } from '../../audio/segments';
import { Txt } from '../../components/Txt';
import { getLecture } from '../../data/lectures';
import { storiesByTestament } from '../../data/stories';
import { ListenStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { Story } from '../../types/content';

type Props = NativeStackScreenProps<ListenStackParamList, 'Lectures'>;

function minutes(story: Story): number {
  const lecture = getLecture(story.id);
  if (!lecture) return 0;
  const words = lecture.sections.reduce((sum, s) => sum + countWords(s.text), 0);
  return Math.round(estimateSeconds(words) / 60);
}

const withLecture = (stories: Story[]) => stories.filter((s) => getLecture(s.id));

const SECTIONS = [
  { title: 'Old Testament', data: withLecture(storiesByTestament('OT')) },
  { title: 'New Testament', data: withLecture(storiesByTestament('NT')) },
];

export function LecturesScreen({ navigation }: Props) {
  const { colors } = useTheme();
  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      sections={SECTIONS}
      keyExtractor={(s) => s.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <Txt muted style={{ marginBottom: 4 }}>
          Sit back and listen to a short teaching on each story. The words appear on screen as they are read.
        </Txt>
      }
      renderSectionHeader={({ section }) => (
        <Txt variant="title" accessibilityRole="header" style={{ marginTop: 16, marginBottom: 10 }}>
          {section.title}
        </Txt>
      )}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate('Lecture', { storyId: item.id })}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, about ${minutes(item)} minutes`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            minHeight: 72,
            padding: 14,
            marginBottom: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            backgroundColor: colors.card,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Txt style={{ fontSize: 34, lineHeight: 42 }}>{item.icon}</Txt>
          <View style={{ flex: 1 }}>
            <Txt bold>{item.title}</Txt>
            <Txt variant="caption" muted>
              About {minutes(item)} minutes
            </Txt>
          </View>
          <Ionicons name="play-circle" size={40} color={colors.primary} />
        </Pressable>
      )}
    />
  );
}
