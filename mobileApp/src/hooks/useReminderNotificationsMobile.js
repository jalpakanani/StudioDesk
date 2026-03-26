import { useEffect } from 'react';
import notifee from '@notifee/react-native';
import { formatINR, sumPayments } from '../utils/money';
import {
  localCalendarTodayISO,
  orderEventStartsTomorrow,
  orderPastDueWithBalance,
  orderReminderLabel,
  visitTouchesTomorrow,
} from '../utils/reminders';
import {
  canSendDailySlot,
  readDaySlots,
  readReminderSig,
  recordDailySlot,
  writeReminderSig,
} from '../utils/remindersStorage';
import { ensureDeskReminderChannel, getDeskNotificationAuthorized, DESK_REMINDER_CHANNEL_ID } from '../notifications/notifeeDesk';

const MIN_GAP_MS = 2.75 * 60 * 60 * 1000;
const MAX_NOTIFS_PER_KIND_PER_DAY = 5;

function notifIdFromTag(tag) {
  const cleaned = String(tag || 'desk').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 62);
  return cleaned || 'desk-n';
}

/**
 * Local notifications (Notifee) when permission is granted — same rules as web
 * `useReminderNotifications`: tomorrow / pay-due caps and spacing via AsyncStorage.
 */
export function useReminderNotificationsMobile(orders, fieldVisits, clientById) {
  useEffect(() => {
    let cancelled = false;
    let intervalId;

    async function run() {
      if (cancelled) return;
      try {
        await ensureDeskReminderChannel();
      } catch {
        return;
      }
      const allowed = await getDeskNotificationAuthorized();
      if (!allowed || cancelled) return;

      const today = localCalendarTodayISO();
      const list = fieldVisits || [];

      const tomorrowOrders = orders.filter((o) => orderEventStartsTomorrow(o, today));
      const tomorrowVisits = list.filter((v) => visitTouchesTomorrow(v, today));
      const payDue = orders.filter((o) => orderPastDueWithBalance(o, today));

      const tomorrowSig = [...tomorrowOrders.map((o) => o.id), ...tomorrowVisits.map((v) => v.id)]
        .sort()
        .join('|');
      const lastTomorrowSig = await readReminderSig('tomorrow', today);
      const tomorrowSetChanged = tomorrowSig !== lastTomorrowSig;
      const tomorrowSlots = await readDaySlots('tomorrow', today);
      const tomorrowUnderCap = tomorrowSlots.length < MAX_NOTIFS_PER_KIND_PER_DAY;
      const tomorrowGapOk = await canSendDailySlot(
        'tomorrow',
        today,
        MAX_NOTIFS_PER_KIND_PER_DAY,
        MIN_GAP_MS,
      );

      if (
        (tomorrowOrders.length > 0 || tomorrowVisits.length > 0) &&
        tomorrowUnderCap &&
        (tomorrowGapOk || tomorrowSetChanged)
      ) {
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
        const tag =
          tomorrowSig.length <= 80
            ? `desk-tom-${tomorrowSig}`
            : `desk-tom-${tomorrowSig.slice(0, 40)}-${tomorrowSig.length}`;
        try {
          await notifee.displayNotification({
            id: notifIdFromTag(tag),
            title: 'My Studio Desk — tomorrow',
            body: parts.join(' · '),
            android: {
              channelId: DESK_REMINDER_CHANNEL_ID,
              pressAction: { id: 'default' },
            },
          });
          await recordDailySlot('tomorrow', today);
          await writeReminderSig('tomorrow', today, tomorrowSig);
        } catch {
          /* do not consume slot on failure */
        }
      }

      const paySig = payDue
        .map((o) => o.id)
        .sort()
        .join('|');
      const lastPaySig = await readReminderSig('pay', today);
      const paySetChanged = paySig !== lastPaySig;
      const paySlots = await readDaySlots('pay', today);
      const payUnderCap = paySlots.length < MAX_NOTIFS_PER_KIND_PER_DAY;
      const payGapOk = await canSendDailySlot('pay', today, MAX_NOTIFS_PER_KIND_PER_DAY, MIN_GAP_MS);

      if (payDue.length > 0 && payUnderCap && (payGapOk || paySetChanged)) {
        try {
          let body;
          let tag;
          if (payDue.length === 1) {
            const o = payDue[0];
            const due = (Number(o.totalAmount) || 0) - sumPayments(o.clientPayments);
            body = `${orderReminderLabel(o, clientById)}: still due ${formatINR(Math.max(0, due))}`;
            tag = `desk-pay-${o.id}`;
          } else {
            const sample = payDue
              .slice(0, 3)
              .map((o) => orderReminderLabel(o, clientById))
              .join(' · ');
            body = `${payDue.length} jobs — ${sample}${payDue.length > 3 ? '…' : ''}. Open your desk.`;
            tag = `desk-pay-b-${paySig.slice(0, 48)}`;
          }
          await notifee.displayNotification({
            id: notifIdFromTag(tag),
            title: 'My Studio Desk — collect payment',
            body,
            android: {
              channelId: DESK_REMINDER_CHANNEL_ID,
              pressAction: { id: 'default' },
            },
          });
          await recordDailySlot('pay', today);
          await writeReminderSig('pay', today, paySig);
        } catch {
          /* ignore */
        }
      }
    }

    run();
    intervalId = setInterval(() => {
      run();
    }, MIN_GAP_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [orders, fieldVisits, clientById]);
}
