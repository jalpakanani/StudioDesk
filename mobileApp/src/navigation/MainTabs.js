import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/DashboardScreen';
import ClientsScreen from '../screens/ClientsScreen';
import OrdersStack from './OrdersStack';
import FieldVisitsScreen from '../screens/FieldVisitsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import {
  TabClientsIcon,
  TabDeskIcon,
  TabFieldIcon,
  TabOrdersIcon,
  TabSettingsIcon,
} from './tabBarIcons';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 20) : insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: tabBarBottomPad,
          ...Platform.select({
            ios: {
              shadowColor: '#14121f',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
            },
            android: { elevation: 12 },
          }),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Desk',
          tabBarIcon: ({ color }) => <TabDeskIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          tabBarIcon: ({ color }) => <TabClientsIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersStack}
        options={{
          tabBarIcon: ({ color }) => <TabOrdersIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Field"
        component={FieldVisitsScreen}
        options={{
          tabBarLabel: 'Exposing',
          tabBarIcon: ({ color }) => <TabFieldIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <TabSettingsIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
