import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native';

export const DESK_REMINDER_CHANNEL_ID = 'my-studio-desk-reminders';

let channelEnsured = false;

export async function ensureDeskReminderChannel() {
  if (channelEnsured) return;
  await notifee.createChannel({
    id: DESK_REMINDER_CHANNEL_ID,
    name: 'Desk reminders',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
  channelEnsured = true;
}

export async function requestDeskNotificationPermission() {
  await ensureDeskReminderChannel();
  return notifee.requestPermission({
    alert: true,
    sound: true,
    badge: true,
  });
}

export async function getDeskNotificationAuthorized() {
  const s = await notifee.getNotificationSettings();
  return (
    s.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    s.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

/** iOS: user has not been asked yet. */
export async function getDeskNotificationNotDetermined() {
  const s = await notifee.getNotificationSettings();
  return s.authorizationStatus === AuthorizationStatus.NOT_DETERMINED;
}

export async function getDeskNotificationState() {
  const s = await notifee.getNotificationSettings();
  const authorized =
    s.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    s.authorizationStatus === AuthorizationStatus.PROVISIONAL;
  return {
    authorized,
    denied: s.authorizationStatus === AuthorizationStatus.DENIED,
  };
}
