import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OrdersListScreen from '../screens/OrdersListScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function OrdersStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surfaceSolid },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '800', color: colors.text },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="OrdersList" component={OrdersListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          headerBackTitle: 'Jobs',
          title: 'Order',
        }}
      />
    </Stack.Navigator>
  );
}
