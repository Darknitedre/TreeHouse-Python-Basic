import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigate<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    // @ts-expect-error — react-navigation's overload resolution struggles with a generic RouteName here.
    navigationRef.navigate(name, params);
  }
}
