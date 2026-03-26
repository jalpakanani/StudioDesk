import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import SearchDeskScreen from '../screens/SearchDeskScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

/** Tabs stay 4 items; Search opens as a normal pushed screen (⌕), not a tab and not a sheet modal. */
export default function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="SearchDesk"
        component={SearchDeskScreen}
        options={{
          headerShown: true,
          title: 'Search',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.surfaceSolid },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '800', color: colors.text },
          headerShadowVisible: false,
          presentation: 'card',
        }}
      />
    </Stack.Navigator>
  );
}
