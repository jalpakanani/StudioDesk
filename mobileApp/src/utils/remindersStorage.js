import AsyncStorage from '@react-native-async-storage/async-storage';

const DAY_SLOTS_PREFIX = 'my-studio-desk-notifSlots';
const REMINDER_SIG_PREFIX = 'my-studio-desk-reminderSig';

export async function readDaySlots(kind, todayISO) {
  const key = `${DAY_SLOTS_PREFIX}:${kind}:${todayISO}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function recordDailySlot(kind, todayISO) {
  const key = `${DAY_SLOTS_PREFIX}:${kind}:${todayISO}`;
  const prev = await readDaySlots(kind, todayISO);
  const next = [...prev, new Date().toISOString()];
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* storage full */
  }
}

export async function readReminderSig(kind, todayISO) {
  try {
    return (await AsyncStorage.getItem(`${REMINDER_SIG_PREFIX}:${kind}:${todayISO}`)) || '';
  } catch {
    return '';
  }
}

export async function writeReminderSig(kind, todayISO, sig) {
  try {
    await AsyncStorage.setItem(`${REMINDER_SIG_PREFIX}:${kind}:${todayISO}`, sig);
  } catch {
    /* ignore */
  }
}

export async function canSendDailySlot(kind, todayISO, maxPerDay = 5, minGapMs = 2.75 * 60 * 60 * 1000) {
  const slots = await readDaySlots(kind, todayISO);
  if (slots.length >= maxPerDay) return false;
  const last = slots[slots.length - 1];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= minGapMs;
}
