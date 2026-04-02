import { coerceDateFieldToISO, orderEventRange } from './dateRange';
import { sumPayments } from './money';
import { localCalendarTodayISO } from './reminders';
import i18n from '../i18n';

/**
 * Auto-derived from calendar + payments (no manual field).
 * - Before event window: Booked
 * - On event day(s): In progress
 * - After event, balance due: Payment pending
 * - After event, paid (or overpaid): Closed
 */
export function deriveOrderWorkflowStatus(order, todayISO) {
  if (!order) return 'booked';
  const today = todayISO || localCalendarTodayISO();
  const received = sumPayments(order.clientPayments);
  const total = Number(order.totalAmount) || 0;
  const due = total - received;

  let { from, to } = orderEventRange(order);
  if (!from) {
    from = coerceDateFieldToISO(order.orderDate || '');
    to = from;
  }
  if (!from) return 'booked';
  if (!to) to = from;
  if (to < from) to = from;

  if (today < from) return 'booked';
  if (today <= to) return 'in_progress';
  if (due > 0) return 'pending_payment';
  return 'closed';
}

/** English-only corpus for desk search token matching (not shown in UI). */
const LABELS_EN = {
  booked: 'Booked',
  in_progress: 'In progress',
  pending_payment: 'Payment pending',
  closed: 'Closed',
};

export function orderWorkflowLabel(status) {
  const s = String(status || '').trim();
  const key = s === 'delivered' ? 'closed' : LABELS_EN[s] ? s : 'booked';
  return i18n.t(`workflow.${key}`);
}

/** Hide from “active” dashboard lists when job is done and settled. */
export function isOrderWorkflowClosed(order, todayISO) {
  return deriveOrderWorkflowStatus(order, todayISO) === 'closed';
}

export function orderWorkflowSearchText(status) {
  const s = String(status || '').trim();
  const base = s === 'delivered' ? LABELS_EN.closed : LABELS_EN[s] || LABELS_EN.booked;
  const extra = {
    booked: 'future upcoming scheduled',
    in_progress: 'today shoot shooting ongoing active',
    pending_payment: 'due balance collect installment pending money',
    closed: 'done complete paid settled finished',
    delivered: 'delivered',
  };
  return `${s} ${base} ${extra[s] || ''}`.toLowerCase();
}
