import { NavigatorScreenParams } from '@react-navigation/native';

export type StudyStackParamList = {
  Library: undefined;
  Story: { storyId: string };
};

export type TabParamList = {
  StudyTab: NavigatorScreenParams<StudyStackParamList>;
  DevotionalTab: undefined;
  ListenTab: undefined;
  PlayTab: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Settings: undefined;
};
