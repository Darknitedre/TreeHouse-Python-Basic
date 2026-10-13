import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { AudioPlayer } from '../../audio/AudioPlayer';
import { Screen } from '../../components/Screen';
import { Txt } from '../../components/Txt';
import { getLecture } from '../../data/lectures';
import { getStory } from '../../data/stories';

// Used in both the Listen tab and the Study tab, so it only needs a storyId.
type Props = NativeStackScreenProps<{ Lecture: { storyId: string } }, 'Lecture'>;

export function LectureScreen({ route, navigation }: Props) {
  const story = getStory(route.params.storyId);
  const lecture = getLecture(route.params.storyId);

  useLayoutEffect(() => {
    navigation.setOptions({ title: story?.title ?? 'Listen' });
  }, [navigation, story]);

  if (!story || !lecture) {
    return (
      <Screen>
        <Txt>This lesson isn't available yet.</Txt>
      </Screen>
    );
  }

  return (
    <AudioPlayer
      sections={lecture.sections}
      header={
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Txt style={{ fontSize: 48, lineHeight: 60 }}>{story.icon}</Txt>
          <Txt variant="title" center>
            {story.title}
          </Txt>
          <Txt muted center>
            {story.passage} · Tap play to begin
          </Txt>
        </View>
      }
    />
  );
}
