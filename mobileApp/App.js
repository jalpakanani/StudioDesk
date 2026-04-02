import './src/firebase/init';
import './src/i18n';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { StudioProvider, useStudio } from './src/context/StudioContext';
import { ConfirmProvider } from './src/context/ConfirmContext';
import { isFirebaseConfigured } from './src/firebase/init';
import LoginScreen from './src/screens/LoginScreen';
import RootStack from './src/navigation/RootStack';
import { useReminderNotificationsMobile } from './src/hooks/useReminderNotificationsMobile';
import { colors } from './src/theme';
import { loadSavedLanguage } from './src/i18n';

function ReminderNotificationsBridge() {
  const { orders, fieldVisits, clientById } = useStudio();
  useReminderNotificationsMobile(orders, fieldVisits ?? [], clientById);
  return null;
}

const navTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.tabBarBg,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.warn,
  },
};

function ConfigMissing() {
  return (
    <SafeAreaView style={styles.center} edges={['top', 'bottom', 'left', 'right']}>
      <Text style={styles.title}>Configure Firebase</Text>
      <Text style={styles.body}>
        Copy <Text style={styles.mono}>.env.example</Text> to <Text style={styles.mono}>.env</Text> in the{' '}
        <Text style={styles.mono}>mobileApp</Text> folder and set{' '}
        <Text style={styles.mono}>EXPO_PUBLIC_FIREBASE_*</Text> (same values as the web app&apos;s{' '}
        <Text style={styles.mono}>REACT_APP_FIREBASE_*</Text>). Then restart Metro (
        <Text style={styles.mono}>npm start</Text>).
      </Text>
    </SafeAreaView>
  );
}

function SyncGate({ children }) {
  const { t } = useTranslation();
  const { studioReady, syncError, actionBusy } = useStudio();
  if (!studioReady) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.syncText}>Syncing your desk…</Text>
      </SafeAreaView>
    );
  }
  return (
    <View style={styles.flex}>
      {syncError ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>{syncError}</Text>
        </View>
      ) : null}
      <ReminderNotificationsBridge />
      <ConfirmProvider>{children}</ConfirmProvider>
      {actionBusy ? (
        <View style={styles.actionBusyOverlay} pointerEvents="auto">
          <View style={styles.actionBusyCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.actionBusyText}>{t('saving')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Root() {
  const auth = useAuth();

  if (!isFirebaseConfigured()) {
    return <ConfigMissing />;
  }

  if (auth.loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!auth.user) {
    return <LoginScreen />;
  }

  return (
    <StudioProvider useCloud syncUserId={auth.user.uid}>
      <SyncGate>
        <RootStack />
      </SyncGate>
    </StudioProvider>
  );
}

export default function App() {
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <NavigationContainer theme={navTheme}>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 12 },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), color: colors.text },
  syncText: { marginTop: 16, color: colors.muted, fontSize: 15 },
  syncBanner: {
    backgroundColor: colors.syncErrorBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.syncErrorBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  syncBannerText: { color: colors.syncErrorText, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  actionBusyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  actionBusyCard: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 22,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 280,
    width: '100%',
  },
  actionBusyText: { fontSize: 15, fontWeight: '600', color: colors.muted, textAlign: 'center' },
});
