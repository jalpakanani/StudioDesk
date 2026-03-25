import { useEffect } from 'react';
import { formatINR, sumPayments } from '../utils/money';
import {
  canSendDailySlot,
  localCalendarTodayISO,
  orderEventStartsTomorrow,
  orderPastDueWithBalance,
  readDaySlots,
  readReminderSig,
  recordDailySlot,
  visitTouchesTomorrow,
  writeReminderSig,
} from '../utils/reminders';

/** ~2h 45m → up to 5 pings fit in a typical waking day without stacking too tight. */
const MIN_GAP_MS = 2.75 * 60 * 60 * 1000;
const MAX_NOTIFS_PER_KIND_PER_DAY = 5;

/**
 * Optional desktop notifications when permission is granted.
 * Each kind (“tomorrow” vs “payment”) can fire up to 5 times per calendar day,
 * at least ~2h 45m apart, while this tab stays open (interval) or when data changes.
 * Adding another job for tomorrow (or another pay-due order) bypasses the gap once so each new item can ping.
 */
export function useReminderNotifications(orders, fieldVisits) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined;

    function run() {
      if (Notification.permission !== 'granted') return;

      const today = localCalendarTodayISO();

      const tomorrowOrders = orders.filter((o) => orderEventStartsTomorrow(o, today));
      const tomorrowVisits = (fieldVisits || []).filter((v) => visitTouchesTomorrow(v, today));
      const payDue = orders.filter((o) => orderPastDueWithBalance(o, today));

      const tomorrowSig = [...tomorrowOrders.map((o) => o.id), ...tomorrowVisits.map((v) => v.id)]
        .sort()
        .join('|');
      const lastTomorrowSig = readReminderSig('tomorrow', today);
      const tomorrowSetChanged = tomorrowSig !== lastTomorrowSig;
      const tomorrowSlots = readDaySlots('tomorrow', today);
      const tomorrowUnderCap = tomorrowSlots.length < MAX_NOTIFS_PER_KIND_PER_DAY;
      const tomorrowGapOk = canSendDailySlot('tomorrow', today, MAX_NOTIFS_PER_KIND_PER_DAY, MIN_GAP_MS);

      if (
        (tomorrowOrders.length > 0 || tomorrowVisits.length > 0) &&
        tomorrowUnderCap &&
        (tomorrowGapOk || tomorrowSetChanged)
      ) {
        const parts = [];
        if (tomorrowOrders.length) {
          parts.push(
            `Orders: ${tomorrowOrders.map((o) => o.title || 'Job').slice(0, 3).join(', ')}${
              tomorrowOrders.length > 3 ? '…' : ''
            }`
          );
        }
        if (tomorrowVisits.length) {
          parts.push(
            `My exposing: ${tomorrowVisits.map((v) => v.hostName || 'Visit').slice(0, 3).join(', ')}${
              tomorrowVisits.length > 3 ? '…' : ''
            }`
          );
        }
        try {
          const tag =
            tomorrowSig.length <= 80
              ? `desk-tom-${tomorrowSig}`
              : `desk-tom-${tomorrowSig.slice(0, 40)}-${tomorrowSig.length}`;
          new Notification('My Studio Desk — tomorrow', {
            body: parts.join(' · '),
            tag,
          });
          recordDailySlot('tomorrow', today);
          writeReminderSig('tomorrow', today, tomorrowSig);
        } catch {
          /* Safari / policy — do not consume a daily slot */
        }
      }

      const paySig = payDue
        .map((o) => o.id)
        .sort()
        .join('|');
      const lastPaySig = readReminderSig('pay', today);
      const paySetChanged = paySig !== lastPaySig;
      const paySlots = readDaySlots('pay', today);
      const payUnderCap = paySlots.length < MAX_NOTIFS_PER_KIND_PER_DAY;
      const payGapOk = canSendDailySlot('pay', today, MAX_NOTIFS_PER_KIND_PER_DAY, MIN_GAP_MS);

      if (payDue.length > 0 && payUnderCap && (payGapOk || paySetChanged)) {
        try {
          if (payDue.length === 1) {
            const o = payDue[0];
            const due = (Number(o.totalAmount) || 0) - sumPayments(o.clientPayments);
            new Notification('My Studio Desk — collect payment', {
              body: `${o.title || 'Order'}: still due ${formatINR(Math.max(0, due))}`,
              tag: `desk-pay-${o.id}`,
            });
          } else {
            new Notification('My Studio Desk — collect payment', {
              body: `${payDue.length} jobs have balance after the event date. Open your desk.`,
              tag: `desk-pay-b-${paySig.slice(0, 48)}`,
            });
          }
          recordDailySlot('pay', today);
          writeReminderSig('pay', today, paySig);
        } catch {
          /* ignore — do not consume a daily slot */
        }
      }
    }

    run();
    const id = window.setInterval(run, MIN_GAP_MS);
    return () => window.clearInterval(id);
  }, [orders, fieldVisits]);
}
