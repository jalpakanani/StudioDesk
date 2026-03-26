import { coerceDateFieldToISO, orderEventRange } from './dateRange';
import { sumPayments } from './money';
import { localCalendarTodayISO } from './reminders';

/**
 * Auto-derived from calendar + payments (no manual field).
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

const LABELS = {
  booked: 'Booked',
  in_progress: 'In progress',
  pending_payment: 'Payment pending',
  closed: 'Closed',
};

export function orderWorkflowLabel(status) {
  const s = String(status || '').trim();
  if (LABELS[s]) return LABELS[s];
  if (s === 'delivered') return 'Closed';
  return LABELS.booked;
}

export function isOrderWorkflowClosed(order, todayISO) {
  return deriveOrderWorkflowStatus(order, todayISO) === 'closed';
}

export function orderWorkflowSearchText(status) {
  const s = String(status || '').trim();
  const base = orderWorkflowLabel(s);
  const extra = {
    booked: 'future upcoming scheduled',
    in_progress: 'today shoot shooting ongoing active',
    pending_payment: 'due balance collect installment pending money',
    closed: 'done complete paid settled finished',
    delivered: 'delivered',
  };
  return `${s} ${base} ${extra[s] || ''}`.toLowerCase();
}
