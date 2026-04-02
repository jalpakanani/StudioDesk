import { fieldVisitRange, formatDateRangeEn, orderEventRange } from './dateRange';
import { deriveOrderWorkflowStatus, orderWorkflowSearchText } from './orderWorkflow';
import { localCalendarTodayISO } from './reminders';

function norm(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function haystack(parts) {
  return parts.map(norm).filter(Boolean).join(' ');
}

/** Every whitespace-separated token must appear somewhere in `text` (substring). */
function matchesTokens(text, tokens) {
  if (tokens.length === 0) return false;
  return tokens.every((t) => text.includes(t));
}

/**
 * @param {string} rawQuery
 * @param {{ clients: any[], orders: any[], fieldVisits: any[], clientById: Map<string, any> }} data
 * @param {{ client?: string, order?: string, visitVenue?: string, visitTitle?: string, emDash?: string }} [labels] UI labels
 * @returns {{ kind: 'client'|'order'|'visit', id: string, title: string, subtitle: string, tab: string }[]}
 */
export function buildDeskSearchResults(
  rawQuery,
  { clients, orders, fieldVisits, clientById },
  labels = {},
) {
  const L = {
    client: labels.client || 'Client',
    order: labels.order || 'Order',
    visitVenue: labels.visitVenue || 'My Exposing',
    visitTitle: labels.visitTitle || 'Visit',
    emDash: labels.emDash || '—',
  };
  const q = norm(rawQuery);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const out = [];
  const cap = 24;
  const today = localCalendarTodayISO();

  for (const c of clients || []) {
    const text = haystack([c.name, c.phone, c.notes]);
    if (!matchesTokens(text, tokens)) continue;
    out.push({
      kind: 'client',
      id: c.id,
      title: c.name || L.client,
      subtitle: c.phone ? `${c.phone} · ${L.client}` : L.client,
      tab: 'clients',
    });
    if (out.length >= cap) return out;
  }

  for (const o of orders || []) {
    const client = clientById?.get?.(o.clientId);
    const text = haystack([
      o.title,
      o.notes,
      o.address,
      orderWorkflowSearchText(deriveOrderWorkflowStatus(o, today)),
      client?.name,
      client?.phone,
    ]);
    if (!matchesTokens(text, tokens)) continue;
    const ev = orderEventRange(o);
    const when = ev.from ? formatDateRangeEn(ev.from, ev.to) : '';
    out.push({
      kind: 'order',
      id: o.id,
      title: o.title || L.order,
      subtitle: when ? `${client?.name || L.emDash} · ${when}` : client?.name || L.order,
      tab: 'orders',
    });
    if (out.length >= cap) return out;
  }

  for (const v of fieldVisits || []) {
    const text = haystack([v.hostName, v.venue, v.notes, v.partyKey]);
    if (!matchesTokens(text, tokens)) continue;
    const { from, to } = fieldVisitRange(v);
    const when = from ? formatDateRangeEn(from, to) : '';
    out.push({
      kind: 'visit',
      id: v.id,
      title: v.hostName || L.visitTitle,
      subtitle: when ? `${v.venue || L.visitVenue} · ${when}` : v.venue || L.visitVenue,
      tab: 'field',
    });
    if (out.length >= cap) return out;
  }

  return out;
}
