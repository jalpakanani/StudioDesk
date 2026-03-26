function isFirestoreTimestamp(v) {
  return v != null && typeof v === 'object' && typeof v.toDate === 'function';
}

/**
 * Stored / synced value → `YYYY-MM-DD` (Firestore Timestamp, ISO date or datetime, `DD/MM/YYYY`, padded or not).
 */
export function coerceDateFieldToISO(value) {
  if (value == null || value === '') return '';
  if (isFirestoreTimestamp(value)) {
    const d = value.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const s = String(value).trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?![0-9])/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[^0-9]|$)/);
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`;
  }
  return s.slice(0, 10);
}

/** Field visit: supports legacy single `date` or `dateFrom` + `dateTo`. */
export function fieldVisitRange(v) {
  const from = coerceDateFieldToISO(v?.dateFrom || v?.date);
  let to = coerceDateFieldToISO(v?.dateTo || '');
  if (!from) return { from: '', to: '' };
  if (!to) to = from;
  if (to < from) to = from;
  return { from, to };
}

/** Order event span (e.g. multi-day wedding). */
export function orderEventRange(o) {
  let from = coerceDateFieldToISO(o?.eventDateFrom || '');
  let to = coerceDateFieldToISO(o?.eventDateTo || '');
  if (!from && to) from = to;
  if (!from) return { from: '', to: '' };
  if (!to) to = from;
  if (to < from) to = from;
  return { from, to };
}

/** Whether [aFrom, aTo] overlaps [winFrom, winTo] (inclusive), ISO date strings. */
export function rangeOverlapsWindow(aFrom, aTo, winFrom, winTo) {
  if (!aFrom || !winFrom) return false;
  const aEnd = aTo || aFrom;
  return aFrom <= winTo && aEnd >= winFrom;
}

/** Add calendar days to `YYYY-MM-DD` in the local timezone (noon anchor). */
export function addCalendarDaysISO(isoDate, deltaDays) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday bounds for the calendar week that contains `todayISO`. */
export function calendarWeekRangeISO(todayISO) {
  const d = new Date(`${todayISO}T12:00:00`);
  const dow = d.getDay();
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offsetToMonday);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  const weekStart = `${y}-${m}-${day}`;
  const weekEnd = addCalendarDaysISO(weekStart, 6);
  return { weekStart, weekEnd };
}

/**
 * Any supported stored value → `DD/MM/YYYY` (not locale-based).
 */
export function formatISODateDisplay(iso) {
  const norm = coerceDateFieldToISO(iso);
  if (norm && /^\d{4}-\d{2}-\d{2}$/.test(norm)) {
    const [y, m, d] = norm.split('-');
    return `${d}/${m}/${y}`;
  }
  const raw = String(iso ?? '').trim();
  return raw.slice(0, 10);
}

/**
 * User input → `YYYY-MM-DD`. Accepts ISO or `D/M/YYYY` with `/`, `-`, or `.`.
 */
export function normalizeUserDateToISO(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?![0-9])/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return raw.slice(0, 10);
}

/** If parsed value is valid `YYYY-MM-DD`, return it; otherwise `fallbackISO`. */
export function toISODateOr(input, fallbackISO) {
  const n = normalizeUserDateToISO(input);
  return /^\d{4}-\d{2}-\d{2}$/.test(n) ? n : fallbackISO;
}

export function formatDateRangeEn(from, to) {
  if (!from) return '—';
  const same = !to || to === from;
  const left = formatISODateDisplay(from);
  if (same) return left || '—';
  return `${left} – ${formatISODateDisplay(to || from)}`;
}
