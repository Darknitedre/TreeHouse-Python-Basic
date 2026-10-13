import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { ComponentProps, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { LibraryScreen } from '../screens/study/LibraryScreen';
import { StoryScreen } from '../screens/study/StoryScreen';
import { useTheme } from '../theme/ThemeProvider';
import { SettingsButton } from './SettingsButton';
import { RootStackParamList, StudyStackParamList, TabParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const StudyStack = createNativeStackNavigator<StudyStackParamList>();

type IconName = ComponentProps<typeof Ionicons>['name'];

function useStackOptions(): NativeStackNavigationOptions {
  const { colors, fontSize } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text, fontSize: fontSize('heading') },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
    headerRight: () => <SettingsButton />,
  };
}

function StudyNavigator() {
  const options = useStackOptions();
  return (
    <StudyStack.Navigator screenOptions={options}>
      <StudyStack.Screen name="Library" component={LibraryScreen} options={{ title: 'Bible Stories' }} />
      <StudyStack.Screen name="Story" component={StoryScreen} options={{ title: '' }} />
    </StudyStack.Navigator>
  );
}

// Placeholder tabs for later phases. Each gets its own stack so the header matches.
function makeComingSoon(title: string, phase: number, icon: IconName, blurb: string) {
  const Stack = createNativeStackNavigator();
  return function ComingSoonNavigator() {
    const options = useStackOptions();
    return (
      <Stack.Navigator screenOptions={options}>
        <Stack.Screen name="ComingSoon" options={{ title }}>
          {() => <ComingSoonScreen phase={phase} icon={icon} blurb={blurb} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  };
}

const DevotionalNavigator = makeComingSoon('Devotional', 3, 'sunny-outline', 'A new devotional every day, with a streak counter, journal, and reminders.');
const ListenNavigator = makeComingSoon('Listen', 2, 'headset-outline', 'Teaching lessons read aloud for every story, with speed control.');
const PlayNavigator = makeComingSoon('Play', 4, 'trophy-outline', 'Bible trivia for family game night or over the phone.');

const TAB_ICONS: Record<keyof TabParamList, [IconName, IconName]> = {
  StudyTab: ['book', 'book-outline'],
  DevotionalTab: ['sunny', 'sunny-outline'],
  ListenTab: ['headset', 'headset-outline'],
  PlayTab: ['trophy', 'trophy-outline'],
};

function TabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
          height: 68 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 8,
        },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={26} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="StudyTab" component={StudyNavigator} options={{ title: 'Study' }} />
      <Tabs.Screen name="DevotionalTab" component={DevotionalNavigator} options={{ title: 'Devotional' }} />
      <Tabs.Screen name="ListenTab" component={ListenNavigator} options={{ title: 'Listen' }} />
      <Tabs.Screen name="PlayTab" component={PlayNavigator} options={{ title: 'Play' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { colors, isDark } = useTheme();
  const stackOptions = useStackOptions();

  const navTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.cardBorder,
      },
    };
  }, [colors, isDark]);

  return (
    <NavigationContainer theme={navTheme}>
      <Root.Navigator>
        <Root.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Root.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ ...stackOptions, headerRight: undefined, title: 'Settings', presentation: 'modal' }}
        />
      </Root.Navigator>
    </NavigationContainer>
  );
}
