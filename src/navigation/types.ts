import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Tabs: undefined;
  ItemDetail: { itemId: string };
  AddManual: { prefillUrl?: string; prefillImageUri?: string } | undefined;
  FolderDetail: { folderId: string };
  Digest: undefined;
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Folders: undefined;
  Settings: undefined;
};

/** Props for a screen hosted inside the bottom tab navigator, with access to the root stack too. */
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
