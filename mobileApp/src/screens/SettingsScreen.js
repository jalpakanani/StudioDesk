import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { AndroidNotificationSetting } from '@notifee/react-native';
import {
  getDeskNotificationState,
  requestDeskNotificationPermission,
} from '../notifications/notifeeDesk';
import {
  getAndroidAlarmSetting,
  openAndroidAlarmPermissionSettings,
} from '../notifications/scheduleDeskTriggers';
import { colors, radius } from '../theme';

export default function SettingsScreen() {
  const { user, logOut } = useAuth();
  const [notifAuthorized, setNotifAuthorized] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const [androidAlarmOff, setAndroidAlarmOff] = useState(false);

  const refreshNotif = useCallback(async () => {
    const s = await getDeskNotificationState();
    setNotifAuthorized(s.authorized);
    setNotifDenied(s.denied);
    if (Platform.OS === 'android') {
      const alarm = await getAndroidAlarmSetting();
      setAndroidAlarmOff(alarm === AndroidNotificationSetting.DISABLED);
    } else {
      setAndroidAlarmOff(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getDeskNotificationState().then(async s => {
        if (!alive) return;
        setNotifAuthorized(s.authorized);
        setNotifDenied(s.denied);
        if (Platform.OS === 'android') {
          const alarm = await getAndroidAlarmSetting();
          if (alive) setAndroidAlarmOff(alarm === AndroidNotificationSetting.DISABLED);
        }
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  async function onToggleNotifications(wantOn) {
    if (wantOn) {
      await requestDeskNotificationPermission();
      await refreshNotif();
      return;
    }
    Alert.alert(
      'Turn off alerts',
      'To disable desk reminders, turn off notifications for this app in your phone settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Settings</Text>
        <Text style={styles.screenLead}>Account and desk reminder alerts.</Text>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.cardMeta}>Signed in as</Text>
          <Text style={styles.email} selectable>
            {user?.email || '—'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => logOut()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, styles.sectionSpaced]}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.notifRow}>
            <View style={styles.notifCopy}>
              <Text style={styles.notifTitle}>Desk reminders</Text>
              <Text style={styles.notifSub}>
                While the app is open: instant alerts (up to five per type per day, spaced out). When the app
                is closed: scheduled summaries — next morning ~7:30 for tomorrow&apos;s jobs / visits, and
                ~10:00 for payment-due jobs (times are local). Open the app after editing the desk so times
                stay updated.
              </Text>
            </View>
            <Switch
              value={notifAuthorized}
              onValueChange={onToggleNotifications}
              trackColor={{
                false: colors.inputBorder,
                true: colors.accentSoft,
              }}
              thumbColor={
                notifAuthorized
                  ? colors.primary
                  : Platform.OS === 'android'
                    ? colors.surfaceSolid
                    : undefined
              }
              ios_backgroundColor={colors.inputBorder}
              accessibilityLabel="Desk reminder notifications"
            />
          </View>
          {notifDenied ? (
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={styles.deniedWrap}
              accessibilityRole="button"
            >
              <Text style={styles.deniedLink}>Notifications blocked — open system settings</Text>
            </TouchableOpacity>
          ) : null}
          {Platform.OS === 'android' && notifAuthorized && androidAlarmOff ? (
            <TouchableOpacity
              onPress={() => openAndroidAlarmPermissionSettings()}
              style={styles.deniedWrap}
              accessibilityRole="button"
            >
              <Text style={styles.deniedLink}>
                Allow &quot;Alarms &amp; reminders&quot; so closed-app reminders fire on time (Android 12+)
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  screenLead: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    opacity: 0.85,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionSpaced: { marginTop: 28 },
  card: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  cardMeta: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  email: { fontSize: 16, fontWeight: '600', color: colors.text },
  signOutBtn: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(180, 60, 60, 0.35)',
    backgroundColor: colors.dangerSoftBg,
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: colors.danger },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifCopy: { flex: 1, minWidth: 0 },
  notifTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  notifSub: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 19 },
  deniedWrap: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  deniedLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
