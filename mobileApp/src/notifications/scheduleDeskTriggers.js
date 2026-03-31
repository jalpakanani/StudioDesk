import { Platform } from 'react-native';
import notifee, { AndroidNotificationSetting, TriggerType } from '@notifee/react-native';
import { formatINR, sumPayments } from '../utils/money';
import {
  localCalendarTodayISO,
  orderEventStartsTomorrow,
  orderPastDueWithBalance,
  orderReminderLabel,
  visitTouchesTomorrow,
} from '../utils/reminders';
import { isOrderWorkflowClosed } from '../utils/orderWorkflow';
import { DESK_REMINDER_CHANNEL_ID, ensureDeskReminderChannel, getDeskNotificationAuthorized } from './notifeeDesk';

export const DESK_TRIGGER_ID_TOMORROW = 'desk-trg-tomorrow';
export const DESK_TRIGGER_ID_PAY = 'desk-trg-pay';

/** Next calendar day at local hour:minute (for “tomorrow’s jobs” morning ping). */
function millisNextCalendarDayAt(todayISO, hour, minute) {
  const [y, mo, d] = todayISO.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, hour, minute, 0, 0);
  dt.setDate(dt.getDate() + 1);
  return dt.getTime();
}

/** Same calendar day at time if still ahead of now, else that time next day. */
function millisNextOccurrenceTodayOrTomorrow(todayISO, hour, minute) {
  const [y, mo, d] = todayISO.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, hour, minute, 0, 0);
  const now = Date.now();
  if (dt.getTime() > now) return dt.getTime();
  dt.setDate(dt.getDate() + 1);
  return dt.getTime();
}

/**
 * Registers OS-level scheduled notifications so reminders can fire when the app is closed.
 * Re-run whenever desk data changes (hook) so text and times stay current.
 */
export async function syncDeskScheduledNotifications(orders, fieldVisits, clientById) {
  try {
    await ensureDeskReminderChannel();
  } catch {
    return;
  }

  await notifee.cancelTriggerNotification(DESK_TRIGGER_ID_TOMORROW).catch(() => {});
  await notifee.cancelTriggerNotification(DESK_TRIGGER_ID_PAY).catch(() => {});

  const allowed = await getDeskNotificationAuthorized();
  if (!allowed) return;

  let exactOk = true;
  if (Platform.OS === 'android') {
    const s = await notifee.getNotificationSettings();
    exactOk = s.android?.alarm === AndroidNotificationSetting.ENABLED;
  }
  const androidAlarmMgr =
    Platform.OS === 'android' ? (exactOk ? { allowWhileIdle: true } : true) : null;

  const today = localCalendarTodayISO();
  const list = fieldVisits || [];

  const tomorrowOrders = orders.filter(
    (o) => !isOrderWorkflowClosed(o, today) && orderEventStartsTomorrow(o, today),
  );
  const tomorrowVisits = list.filter((v) => visitTouchesTomorrow(v, today));
  const payDue = orders.filter(
    (o) => !isOrderWorkflowClosed(o, today) && orderPastDueWithBalance(o, today),
  );

  const buildTomorrowBody = () => {
    const parts = [];
    if (tomorrowOrders.length) {
      parts.push(
        `Orders: ${tomorrowOrders
          .map((o) => orderReminderLabel(o, clientById))
          .slice(0, 3)
          .join(', ')}${tomorrowOrders.length > 3 ? '…' : ''}`,
      );
    }
    if (tomorrowVisits.length) {
      parts.push(
        `My exposing: ${tomorrowVisits
          .map((v) => v.hostName || 'Visit')
          .slice(0, 3)
          .join(', ')}${tomorrowVisits.length > 3 ? '…' : ''}`,
      );
    }
    return parts.join(' · ');
  };

  if (tomorrowOrders.length > 0 || tomorrowVisits.length > 0) {
    const ts = millisNextCalendarDayAt(today, 7, 30);
    if (ts > Date.now()) {
      const triggerTom = {
        type: TriggerType.TIMESTAMP,
        timestamp: ts,
        ...(androidAlarmMgr != null ? { alarmManager: androidAlarmMgr } : {}),
      };
      try {
        await notifee.createTriggerNotification(
          {
            id: DESK_TRIGGER_ID_TOMORROW,
            title: 'My Studio Desk — tomorrow',
            body: buildTomorrowBody(),
            android: {
              channelId: DESK_REMINDER_CHANNEL_ID,
              pressAction: { id: 'default' },
            },
          },
          triggerTom,
        );
      } catch {
        /* ignore */
      }
    }
  }

  if (payDue.length > 0) {
    const ts = millisNextOccurrenceTodayOrTomorrow(today, 10, 0);
    if (ts > Date.now()) {
      let body;
      if (payDue.length === 1) {
        const o = payDue[0];
        const due = (Number(o.totalAmount) || 0) - sumPayments(o.clientPayments);
        body = `${orderReminderLabel(o, clientById)}: still due ${formatINR(Math.max(0, due))}`;
      } else {
        const sample = payDue
          .slice(0, 3)
          .map((o) => orderReminderLabel(o, clientById))
          .join(' · ');
        body = `${payDue.length} jobs — ${sample}${payDue.length > 3 ? '…' : ''}. Open your desk.`;
      }
      const triggerPay = {
        type: TriggerType.TIMESTAMP,
        timestamp: ts,
        ...(androidAlarmMgr != null ? { alarmManager: androidAlarmMgr } : {}),
      };
      try {
        await notifee.createTriggerNotification(
          {
            id: DESK_TRIGGER_ID_PAY,
            title: 'My Studio Desk — collect payment',
            body,
            android: {
              channelId: DESK_REMINDER_CHANNEL_ID,
              pressAction: { id: 'default' },
            },
          },
          triggerPay,
        );
      } catch {
        /* ignore */
      }
    }
  }
}

export async function getAndroidAlarmSetting() {
  if (Platform.OS !== 'android') return null;
  const s = await notifee.getNotificationSettings();
  return s.android?.alarm ?? null;
}

export async function openAndroidAlarmPermissionSettings() {
  if (Platform.OS !== 'android') return;
  await notifee.openAlarmPermissionSettings();
}
