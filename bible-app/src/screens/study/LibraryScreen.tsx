import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, SectionList, View } from 'react-native';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { Txt } from '../../components/Txt';
import { stories, storiesByTestament } from '../../data/stories';
import { StudyStackParamList } from '../../navigation/types';
import { useProgress } from '../../storage/ProgressContext';
import { useTheme } from '../../theme/ThemeProvider';
import { Story } from '../../types/content';

type Props = NativeStackScreenProps<StudyStackParamList, 'Library'>;

const SECTIONS = [
  { title: 'Old Testament', data: storiesByTestament('OT') },
  { title: 'New Testament', data: storiesByTestament('NT') },
];

export function LibraryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { completedStories, isStoryComplete } = useProgress();
  const doneCount = stories.filter((s) => completedStories.includes(s.id)).length;

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      sections={SECTIONS}
      keyExtractor={(s) => s.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
          <Txt variant="heading">Your progress</Txt>
          <Txt muted style={{ marginBottom: 10 }}>
            {doneCount} of {stories.length} stories completed
          </Txt>
          <ProgressBar value={stories.length ? doneCount / stories.length : 0} />
        </Card>
      }
      renderSectionHeader={({ section }) => (
        <Txt variant="title" accessibilityRole="header" style={{ marginTop: 16, marginBottom: 10 }}>
          {section.title}
        </Txt>
      )}
      renderItem={({ item }) => (
        <StoryRow story={item} done={isStoryComplete(item.id)} onPress={() => navigation.navigate('Story', { storyId: item.id })} />
      )}
    />
  );
}

function StoryRow({ story, done, onPress }: { story: Story; done: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.title}${done ? ', completed' : ''}`}
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
      <Txt style={{ fontSize: 34, lineHeight: 42 }}>{story.icon}</Txt>
      <View style={{ flex: 1 }}>
        <Txt bold>{story.title}</Txt>
        <Txt variant="caption" muted>
          {story.passage}
        </Txt>
      </View>
      {done ? (
        <Ionicons name="checkmark-circle" size={30} color={colors.success} />
      ) : (
        <Ionicons name="chevron-forward" size={26} color={colors.textMuted} />
      )}
    </Pressable>
  );
}
