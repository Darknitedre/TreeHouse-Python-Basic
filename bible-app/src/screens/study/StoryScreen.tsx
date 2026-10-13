import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BigButton } from '../../components/BigButton';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { SectionTitle } from '../../components/SectionTitle';
import { Txt } from '../../components/Txt';
import { getStory } from '../../data/stories';
import { StudyStackParamList } from '../../navigation/types';
import { useProgress } from '../../storage/ProgressContext';
import { useTheme } from '../../theme/ThemeProvider';
import { ReviewQuestion } from '../../types/content';

type Props = NativeStackScreenProps<StudyStackParamList, 'Story'>;

export function StoryScreen({ route, navigation }: Props) {
  const story = getStory(route.params.storyId);
  const { colors } = useTheme();
  const { isStoryComplete, toggleStoryComplete } = useProgress();

  useLayoutEffect(() => {
    navigation.setOptions({ title: story?.title ?? '' });
  }, [navigation, story]);

  if (!story) {
    return (
      <Screen>
        <Txt>Story not found.</Txt>
      </Screen>
    );
  }

  const done = isStoryComplete(story.id);

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Txt style={{ fontSize: 56, lineHeight: 68 }}>{story.icon}</Txt>
        <Txt variant="title" center>
          {story.title}
        </Txt>
        <Txt muted center>
          {story.testament === 'OT' ? 'Old Testament' : 'New Testament'} · {story.passage}
        </Txt>
      </View>

      <SectionTitle title="Summary" icon="document-text-outline" />
      <Card>
        <Txt>{story.summary}</Txt>
      </Card>

      <SectionTitle title="Key Scriptures" icon="book-outline" />
      {story.scriptures.map((s) => (
        <Card key={s.ref} style={{ borderLeftWidth: 5, borderLeftColor: colors.primary }}>
          <Txt bold color={colors.primary} style={{ marginBottom: 4 }}>
            {s.ref}
          </Txt>
          <Txt style={{ fontStyle: 'italic' }}>{s.text}</Txt>
        </Card>
      ))}

      <SectionTitle title="Main Characters" icon="people-outline" />
      <Card>
        {story.characters.map((c, i) => (
          <View key={c.name} style={{ marginTop: i === 0 ? 0 : 12 }}>
            <Txt bold>{c.name}</Txt>
            <Txt muted>{c.description}</Txt>
          </View>
        ))}
      </Card>

      <SectionTitle title="The Lesson" icon="bulb-outline" />
      <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
        <Txt>{story.lesson}</Txt>
      </Card>

      <SectionTitle title="Review Questions" icon="help-circle-outline" />
      <Txt variant="caption" muted style={{ marginBottom: 8 }}>
        Think about each question, then tap to see the answer.
      </Txt>
      {story.reviewQuestions.map((q, i) => (
        <QuestionCard key={q.question} index={i + 1} item={q} />
      ))}

      <View style={{ marginTop: 16 }}>
        <BigButton
          label={done ? 'Completed! (tap to undo)' : 'Mark as completed'}
          icon={done ? 'checkmark-circle' : 'checkmark-circle-outline'}
          kind={done ? 'success' : 'filled'}
          onPress={() => toggleStoryComplete(story.id)}
        />
      </View>
    </Screen>
  );
}

function QuestionCard({ index, item }: { index: number; item: ReviewQuestion }) {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityHint={open ? 'Hides the answer' : 'Shows the answer'}
    >
      <Card>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Txt bold color={colors.primary}>
            {index}.
          </Txt>
          <Txt bold style={{ flex: 1 }}>
            {item.question}
          </Txt>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textMuted} />
        </View>
        {open ? (
          <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.successSoft }}>
            <Txt>{item.answer}</Txt>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}
