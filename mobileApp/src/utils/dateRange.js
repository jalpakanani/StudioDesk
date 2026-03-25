/** Field visit: supports legacy single `date` or `dateFrom` + `dateTo`. */
export function fieldVisitRange(v) {
  const from = String(v?.dateFrom || v?.date || '').slice(0, 10);
  let to = String(v?.dateTo || '').slice(0, 10);
  if (!from) return { from: '', to: '' };
  if (!to) to = from;
  if (to < from) to = from;
  return { from, to };
}

/** Order event span (e.g. multi-day wedding). */
export function orderEventRange(o) {
  let from = String(o?.eventDateFrom || '').slice(0, 10);
  let to = String(o?.eventDateTo || '').slice(0, 10);
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

export function formatDateRangeEn(from, to) {
  if (!from) return '—';
  const same = !to || to === from;
  const f = new Date(from + 'T12:00:00');
  const opts = { day: 'numeric', month: 'short' };
  if (same) return f.toLocaleDateString('en-IN', { ...opts, year: 'numeric' });
  const t = new Date((to || from) + 'T12:00:00');
  const yf = f.getFullYear();
  const yt = t.getFullYear();
  const left = f.toLocaleDateString('en-IN', opts);
  const right = t.toLocaleDateString(
    'en-IN',
    yt === yf ? opts : { ...opts, year: 'numeric' }
  );
  return `${left} – ${right}`;
}
