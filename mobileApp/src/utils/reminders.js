import { fieldVisitRange, orderEventRange } from './dateRange';
import { sumPayments } from './money';

const DAY_SLOTS_PREFIX = 'my-studio-desk-notifSlots';

/** Local calendar YYYY-MM-DD — matches browser date inputs and reminder logic (not UTC midnight). */
export function localCalendarTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO timestamps (same calendar day) when we already showed a desktop notification. */
export function readDaySlots(kind, todayISO) {
  const key = `${DAY_SLOTS_PREFIX}:${kind}:${todayISO}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Allow another notification today? Max `maxPerDay` (default 5), at least `minGapMs` since the last one.
 */
export function canSendDailySlot(kind, todayISO, maxPerDay = 5, minGapMs = 2.75 * 60 * 60 * 1000) {
  const slots = readDaySlots(kind, todayISO);
  if (slots.length >= maxPerDay) return false;
  const last = slots[slots.length - 1];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= minGapMs;
}

export function recordDailySlot(kind, todayISO) {
  const key = `${DAY_SLOTS_PREFIX}:${kind}:${todayISO}`;
  const next = [...readDaySlots(kind, todayISO), new Date().toISOString()];
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

const REMINDER_SIG_PREFIX = 'my-studio-desk-reminderSig';

/** Last notified set signature for a day (so a new tomorrow/pay item can ping without waiting min gap). */
export function readReminderSig(kind, todayISO) {
  try {
    return localStorage.getItem(`${REMINDER_SIG_PREFIX}:${kind}:${todayISO}`) || '';
  } catch {
    return '';
  }
}

export function writeReminderSig(kind, todayISO, sig) {
  try {
    localStorage.setItem(`${REMINDER_SIG_PREFIX}:${kind}:${todayISO}`, sig);
  } catch {
    /* quota / private mode */
  }
}

/** Next/prev calendar day in the user's local timezone (not UTC midnight). */
export function addDaysISO(isoDate, deltaDays) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Event first day is exactly tomorrow (e.g. remind the day before). */
export function orderEventStartsTomorrow(order, todayISO) {
  const tomorrow = addDaysISO(todayISO, 1);
  const { from } = orderEventRange(order);
  if (from) return from === tomorrow;
  const od = String(order.orderDate || '').slice(0, 10);
  return od === tomorrow;
}

/** Visit spans tomorrow (any day of shoot is tomorrow). */
export function visitTouchesTomorrow(visit, todayISO) {
  const tomorrow = addDaysISO(todayISO, 1);
  const { from, to } = fieldVisitRange(visit);
  const end = to || from;
  if (!from) return false;
  return from <= tomorrow && tomorrow <= end;
}

/** Order: balance due and job date is already over (event end or order date). */
export function orderPastDueWithBalance(order, todayISO) {
  const received = sumPayments(order.clientPayments);
  const due = (Number(order.totalAmount) || 0) - received;
  if (due <= 0) return false;
  const { from, to } = orderEventRange(order);
  const end = to || from;
  if (end) return end < todayISO;
  const od = String(order.orderDate || '').slice(0, 10);
  return od ? od < todayISO : false;
}
