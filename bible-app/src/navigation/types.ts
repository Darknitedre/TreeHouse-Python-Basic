import { NavigatorScreenParams } from '@react-navigation/native';

export type StudyStackParamList = {
  Library: undefined;
  Story: { storyId: string };
  Lecture: { storyId: string };
};

export type ListenStackParamList = {
  Lectures: undefined;
  Lecture: { storyId: string };
};

export type TabParamList = {
  StudyTab: NavigatorScreenParams<StudyStackParamList>;
  DevotionalTab: undefined;
  ListenTab: NavigatorScreenParams<ListenStackParamList>;
  PlayTab: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Settings: undefined;
};
