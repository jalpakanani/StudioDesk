import {useEffect, useId, useMemo, useState} from 'react'
import {useStudio} from '../context/StudioContext'
import {useTab} from '../context/TabContext'
import {formatINR, sumPayments} from '../utils/money'
import {
  calendarWeekRangeISO,
  coerceDateFieldToISO,
  fieldVisitRange,
  formatDateRangeEn,
  orderEventRange,
  rangeOverlapsWindow,
} from '../utils/dateRange'
import {
  buildSettlementRows,
  computeStudioProfit,
  netVisitPendingAfterStudioPay,
  settlementNeedsLinkHint,
} from '../utils/settlement'
import {localCalendarTodayISO} from '../utils/reminders'
import {
  deriveOrderWorkflowStatus,
  isOrderWorkflowClosed,
  orderWorkflowLabel,
} from '../utils/orderWorkflow'

function todayISO() {
  return localCalendarTodayISO()
}

const DASH_LIST_PAGE_SIZE_DEFAULT = 5
const DASH_LIST_PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 50, 100]
const DASH_LIST_PAGE_SIZE_STORAGE = 'deskDashboardListPageSize'

function readStoredListPageSize() {
  if (typeof localStorage === 'undefined') return DASH_LIST_PAGE_SIZE_DEFAULT
  try {
    const raw = localStorage.getItem(DASH_LIST_PAGE_SIZE_STORAGE)
    const n = Number(raw)
    if (DASH_LIST_PAGE_SIZE_OPTIONS.includes(n)) return n
  } catch {
    /* ignore */
  }
  return DASH_LIST_PAGE_SIZE_DEFAULT
}

function usePagedSlice(items, pageSize = DASH_LIST_PAGE_SIZE_DEFAULT) {
  const [page, setPage] = useState(1)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1)

  useEffect(() => {
    setPage(1)
  }, [pageSize])

  useEffect(() => {
    setPage(p => Math.min(Math.max(1, p), pageCount))
  }, [pageCount])

  const slice = useMemo(() => {
    const p = Math.min(Math.max(1, page), pageCount)
    const start = (p - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize, pageCount])

  const safePage = Math.min(Math.max(1, page), pageCount)

  return {
    page: safePage,
    setPage,
    pageCount,
    slice,
    total,
  }
}

function DashPagination({
  page,
  pageCount,
  total,
  pageSize,
  setPage,
  onPageSizeChange,
  pageSizeOptions,
}) {
  const selectId = useId()
  const [jumpDraft, setJumpDraft] = useState(() => String(page))

  useEffect(() => {
    setJumpDraft(String(page))
  }, [page])

  if (total === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const rowWord = total === 1 ? 'row' : 'rows'

  function commitJump() {
    const n = parseInt(jumpDraft, 10)
    if (!Number.isFinite(n)) {
      setJumpDraft(String(page))
      return
    }
    const clamped = Math.min(Math.max(1, n), pageCount)
    setPage(clamped)
    setJumpDraft(String(clamped))
  }

  return (
    <div className="dash-pagination-bar" role="navigation" aria-label="Table pagination">
      <div className="dash-pagination-bar__left">
        <label htmlFor={selectId} className="dash-pagination-bar__rpp-label muted small">
          Rows per page
        </label>
        <select
          id={selectId}
          className="dash-pagination-bar__rpp-select"
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizeOptions.map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="dash-pagination-bar__range muted small">
        {start}-{end} of {total} {rowWord}
      </div>
      <div className="dash-pagination-bar__right">
        {/* <button
          type="button"
          className="dash-pagination-bar__icon-btn"
          aria-label="First page"
          disabled={page <= 1}
          onClick={() => setPage(1)}
        >
          <span className="dash-pagination-bar__icon-first" aria-hidden="true">
            |
          </span>
          <span className="dash-pagination-bar__chev" aria-hidden="true">
            ‹‹
          </span>
        </button> */}
        <button
          type="button"
          className="dash-pagination-bar__nav"
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
        >
          <span className="dash-pagination-bar__chev" aria-hidden="true">
            ‹
          </span>{' '}
          Previous
        </button>
        <input
          className="dash-pagination-bar__jump"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={jumpDraft}
          onChange={e => setJumpDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commitJump}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitJump()
            }
          }}
          aria-label="Go to page"
        />
        <span className="dash-pagination-bar__of muted small">of {pageCount}</span>
        <button
          type="button"
          className="dash-pagination-bar__nav"
          disabled={page >= pageCount}
          onClick={() => setPage(p => Math.min(pageCount, p + 1))}
        >
          Next{' '}
          <span className="dash-pagination-bar__chev" aria-hidden="true">
            ›
          </span>
        </button>
        {/* <button
          type="button"
          className="dash-pagination-bar__icon-btn"
          aria-label="Last page"
          disabled={page >= pageCount}
          onClick={() => setPage(pageCount)}
        >
          <span className="dash-pagination-bar__chev" aria-hidden="true">
            ››
          </span>
          <span className="dash-pagination-bar__icon-last" aria-hidden="true">
            |
          </span>
        </button> */}
      </div>
    </div>
  )
}

/** Event / job still in the future (uses event to-date, else order date). Undated orders stay visible. */
function isOrderFuture(order, today) {
  const {from, to} = orderEventRange(order)
  const end = to || from
  if (end) return end >= today
  const od = coerceDateFieldToISO(order.orderDate)
  if (od) return od >= today
  return true
}

/** Visit not fully in the past (end date today or later). */
function isVisitFuture(v, today) {
  const {from, to} = fieldVisitRange(v)
  const end = to || from
  if (!end) return false
  return end >= today
}

/** Sort key: event end (or start), else order date — for chronological upcoming list. */
function futureOrderSortKey(order) {
  const {from, to} = orderEventRange(order)
  const end = to || from
  const od = coerceDateFieldToISO(order.orderDate)
  return end || od || '9999-12-31'
}

/** Label for dashboard row: wedding/event span, else order (booked) date. */
function upcomingOrderWhenLabel(order) {
  const {from, to} = orderEventRange(order)
  if (from) return formatDateRangeEn(from, to)
  const od = coerceDateFieldToISO(order.orderDate)
  if (od) return `Booked ${formatDateRangeEn(od, od)}`
  return ''
}

export default function Dashboard() {
  const {orders, clients, clientById, fieldVisits} = useStudio()
  const {setTab, setNavFocus} = useTab()
  const [listPageSize, setListPageSize] = useState(readStoredListPageSize)

  useEffect(() => {
    try {
      localStorage.setItem(DASH_LIST_PAGE_SIZE_STORAGE, String(listPageSize))
    } catch {
      /* ignore */
    }
  }, [listPageSize])
  const todayDesk = todayISO()
  const futureOrderRows = useMemo(() => {
    return orders
      .map(o => {
        const received = sumPayments(o.clientPayments)
        const total = Number(o.totalAmount) || 0
        const due = total - received
        return {order: o, received, due, total}
      })
      .filter(x => isOrderFuture(x.order, todayDesk) && !isOrderWorkflowClosed(x.order, todayDesk))
      .sort((a, b) => {
        const c = futureOrderSortKey(a.order).localeCompare(
          futureOrderSortKey(b.order),
        )
        if (c !== 0) return c
        if (b.due !== a.due) return b.due - a.due
        return (a.order.title || '').localeCompare(b.order.title || '')
      })
  }, [orders, todayDesk])

  /** Only unpaid portion on still-upcoming orders (stat tile). */
  const totalClientDue = useMemo(() => {
    return futureOrderRows.reduce((s, x) => s + Math.max(0, x.due), 0)
  }, [futureOrderRows])

  /** Per client: sum of (quote − received) across orders with balance. */
  const clientsWithBalanceDue = useMemo(() => {
    const map = new Map()
    for (const o of orders) {
      const received = sumPayments(o.clientPayments)
      const total = Number(o.totalAmount) || 0
      const due = total - received
      if (due <= 0 || !o.clientId) continue
      const cur = map.get(o.clientId) || {dueSum: 0, orderCount: 0}
      cur.dueSum += due
      cur.orderCount += 1
      map.set(o.clientId, cur)
    }
    return Array.from(map.entries())
      .map(([clientId, agg]) => ({
        clientId,
        name: String(clientById.get(clientId)?.name || '').trim() || '—',
        dueSum: agg.dueSum,
        orderCount: agg.orderCount,
      }))
      .filter(x => x.dueSum > 0)
      .sort((a, b) => b.dueSum - a.dueSum)
  }, [orders, clientById])

  /** Sum of all studio order balances by client (not “same person” visit netting). */
  const totalAllClientsStudioDue = useMemo(
    () => clientsWithBalanceDue.reduce((s, r) => s + r.dueSum, 0),
    [clientsWithBalanceDue],
  )

  const visitBalances = useMemo(() => {
    return (fieldVisits || []).map(v => {
      const received = sumPayments(v.collections)
      const total = Number(v.amountToCollect) || 0
      return {v, received, due: total - received}
    })
  }, [fieldVisits])

  /** Gross still due on every My Exposing row (amount − collected), any date. */
  const totalAllVisitsDueGrossAll = useMemo(
    () => visitBalances.reduce((s, x) => s + Math.max(0, x.due), 0),
    [visitBalances],
  )

  /** Studio client balances + exposing gross (simple sum — not same-person net). */
  const totalCollectStudioPlusExposingGross = useMemo(
    () => totalAllClientsStudioDue + totalAllVisitsDueGrossAll,
    [totalAllClientsStudioDue, totalAllVisitsDueGrossAll],
  )

  /** Gross still due on upcoming visits (before netting studio pay to same person). */
  const totalVisitDueGross = useMemo(() => {
    const t = todayISO()
    return visitBalances.reduce((s, x) => {
      if (x.due <= 0 || !isVisitFuture(x.v, t)) return s
      return s + Math.max(0, x.due)
    }, 0)
  }, [visitBalances])

  /** Same as settlement table: upcoming visit due minus matched “Pay them” on exposure guests. */
  const totalVisitDueNet = useMemo(() => {
    const t = todayISO()
    return netVisitPendingAfterStudioPay(
      orders,
      fieldVisits,
      (v, due) => due > 0 && isVisitFuture(v, t),
    )
  }, [orders, fieldVisits])

  /** Upcoming / today-or-later visits only, with pending amount to collect */
  const dashboardVisitRows = useMemo(() => {
    const t = todayISO()
    const rows = visitBalances.filter(
      ({v, due}) => due > 0 && isVisitFuture(v, t),
    )
    rows.sort((a, b) => {
      const af = fieldVisitRange(a.v).from
      const bf = fieldVisitRange(b.v).from
      return (
        af.localeCompare(bf) || (a.v.time || '').localeCompare(b.v.time || '')
      )
    })
    return rows
  }, [visitBalances])

  const isFresh =
    clients.length === 0 &&
    orders.length === 0 &&
    (fieldVisits || []).length === 0

  const visitCount = (fieldVisits || []).length

  const settlementRows = useMemo(
    () => buildSettlementRows(orders, fieldVisits),
    [orders, fieldVisits],
  )

  const settlementHint = useMemo(
    () => settlementNeedsLinkHint(settlementRows),
    [settlementRows],
  )

  const profit = useMemo(
    () => computeStudioProfit(orders, fieldVisits),
    [orders, fieldVisits],
  )

  const thisWeekOrderRows = useMemo(() => {
    const t = todayISO()
    const {weekStart, weekEnd} = calendarWeekRangeISO(t)
    return orders
      .filter(o => {
        if (isOrderWorkflowClosed(o, t)) return false
        const r = orderEventRange(o)
        if (r.from) return rangeOverlapsWindow(r.from, r.to || r.from, weekStart, weekEnd)
        const od = coerceDateFieldToISO(o.orderDate)
        return od ? rangeOverlapsWindow(od, od, weekStart, weekEnd) : false
      })
      .map(o => ({
        order: o,
        client: clientById.get(o.clientId)?.name || '—',
        when: upcomingOrderWhenLabel(o),
      }))
      .sort((a, b) =>
        futureOrderSortKey(a.order).localeCompare(futureOrderSortKey(b.order)),
      )
  }, [orders, clientById])

  const thisWeekVisitRows = useMemo(() => {
    const t = todayISO()
    const {weekStart, weekEnd} = calendarWeekRangeISO(t)
    return (fieldVisits || [])
      .filter(v => {
        const {from, to} = fieldVisitRange(v)
        if (!from) return false
        return rangeOverlapsWindow(from, to || from, weekStart, weekEnd)
      })
      .map(v => {
        const {from, to} = fieldVisitRange(v)
        return {v, rangeLabel: formatDateRangeEn(from, to)}
      })
      .sort((a, b) =>
        fieldVisitRange(a.v).from.localeCompare(fieldVisitRange(b.v).from),
      )
  }, [fieldVisits])

  const weekOrdersPage = usePagedSlice(thisWeekOrderRows, listPageSize)
  const weekVisitsPage = usePagedSlice(thisWeekVisitRows, listPageSize)
  const balancesPage = usePagedSlice(clientsWithBalanceDue, listPageSize)

  const tWeek = todayISO()
  const {weekStart: weekStartISO, weekEnd: weekEndISO} = calendarWeekRangeISO(tWeek)
  const thisWeekRangeText = formatDateRangeEn(weekStartISO, weekEndISO)

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Dashboard</h2>
          <p className="panel-lead">
            Dues, outside visits, and quick adds—at a glance.
          </p>
        </div>
      </div>

      <div className="quick-actions" role="group" aria-label="Quick actions">
        <button
          type="button"
          className="qa-btn"
          onClick={() => setTab('clients')}
        >
          <span className="qa-emoji" aria-hidden="true">
            +
          </span>
          <span className="qa-text">
            <strong>New client</strong>
            <small>Save a name &amp; phone</small>
          </span>
        </button>
        <button
          type="button"
          className="qa-btn"
          onClick={() => setTab('orders')}
        >
          <span className="qa-emoji" aria-hidden="true">
            ✦
          </span>
          <span className="qa-text">
            <strong>New order</strong>
            <small>Quote &amp; payments</small>
          </span>
        </button>
        <button
          type="button"
          className="qa-btn"
          onClick={() => setTab('field')}
        >
          <span className="qa-emoji" aria-hidden="true">
            ⌖
          </span>
          <span className="qa-text">
            <strong>My Exposing</strong>
            <small>Where to go &amp; collect</small>
          </span>
        </button>
      </div>

      {!isFresh &&
      (thisWeekOrderRows.length > 0 || thisWeekVisitRows.length > 0) ? (
        <section className="card dash-week-snapshot" aria-label="This week">
          <div className="dash-week-head">
            <h3 className="dash-week-title">This week</h3>
            <p className="dash-week-range muted small">{thisWeekRangeText}</p>
          </div>
          <p className="dash-week-lead muted small">
            Calendar week (Mon–Sun): jobs and outside visits that touch these dates.
          </p>
          {thisWeekOrderRows.length > 0 ? (
            <div className="dash-week-block">
              <h4 className="dash-week-block-title">Orders</h4>
              <ul className="dash-reminder-list">
                {weekOrdersPage.slice.map(({order, client, when}) => (
                  <li key={order.id}>
                    <button
                      type="button"
                      className="dash-reminder-row"
                      onClick={() => {
                        setNavFocus({kind: 'order', id: order.id})
                        setTab('orders')
                      }}
                    >
                      <span className="dash-reminder-main">
                        <strong>{order.title}</strong>
                        <span className="muted small">{client}</span>
                      </span>
                      <span className="dash-reminder-meta muted small">{when}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <DashPagination
                page={weekOrdersPage.page}
                pageCount={weekOrdersPage.pageCount}
                total={weekOrdersPage.total}
                pageSize={listPageSize}
                setPage={weekOrdersPage.setPage}
                onPageSizeChange={setListPageSize}
                pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
              />
            </div>
          ) : null}
          {thisWeekVisitRows.length > 0 ? (
            <div className="dash-week-block">
              <h4 className="dash-week-block-title">My Exposing</h4>
              <ul className="dash-reminder-list">
                {weekVisitsPage.slice.map(({v, rangeLabel}) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="dash-reminder-row"
                      onClick={() => {
                        setNavFocus({kind: 'visit', id: v.id})
                        setTab('field')
                      }}
                    >
                      <span className="dash-reminder-main">
                        <strong>{v.hostName}</strong>
                        {v.venue ? (
                          <span className="muted small">{v.venue}</span>
                        ) : null}
                      </span>
                      <span className="dash-reminder-meta muted small">{rangeLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <DashPagination
                page={weekVisitsPage.page}
                pageCount={weekVisitsPage.pageCount}
                total={weekVisitsPage.total}
                pageSize={listPageSize}
                setPage={weekVisitsPage.setPage}
                onPageSizeChange={setListPageSize}
                pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {isFresh ? (
        <div className="welcome-banner">
          <div className="welcome-banner-glow" aria-hidden="true" />
          <h3 className="welcome-title">Your desk is ready</h3>
          <p className="welcome-copy">
            Add a client and an order for studio jobs—or open{' '}
            <strong>My Exposing</strong> for outside shoots (whose place, what
            to collect).
          </p>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
            <button
              type="button"
              className="btn primary btn-lg shine"
              onClick={() => setTab('clients')}
            >
              Start with a client
            </button>
            <button
              type="button"
              className="btn btn-lg"
              onClick={() => setTab('field')}
            >
              Log My Exposing
            </button>
          </div>
        </div>
      ) : null}

      <div className="stats-row" role="list">
        <button
          type="button"
          className="stat-tile stat-tile-1"
          onClick={() => setTab('clients')}
        >
          <span className="stat-label">Clients</span>
          <span className="stat-value">{clients.length}</span>
          <span className="stat-hint">Tap to manage</span>
        </button>
        <button
          type="button"
          className="stat-tile stat-tile-2"
          onClick={() => setTab('orders')}
        >
          <span className="stat-label">Orders</span>
          <span className="stat-value">{orders.length}</span>
          <span className="stat-hint">Tap to open</span>
        </button>
        <button
          type="button"
          className="stat-tile stat-tile-3"
          onClick={() => setTab('field')}
        >
          <span className="stat-label">My Exposing</span>
          <span className="stat-value">{visitCount}</span>
          <span className="stat-hint">Outside shoots</span>
        </button>
        <div className="stat-tile stat-tile-4 stat-tile-static">
          <span className="stat-label">Due (future jobs)</span>
          <span className="stat-value stat-value-money">
            {formatINR(totalClientDue)}
          </span>
          <span className="stat-hint">Open jobs only — closed hidden</span>
        </div>
        <div
          className="stat-tile stat-tile-owes-clients stat-tile-static"
          title="Studio order dues plus My Exposing gross (every row). Not the same-person visit net tile."
        >
          <span className="stat-label">To collect (desk)</span>
          <span className="stat-value stat-value-money warn">
            {formatINR(totalCollectStudioPlusExposingGross)}
          </span>
          <span className="stat-hint">
            Studio {formatINR(totalAllClientsStudioDue)} + exposing {formatINR(totalAllVisitsDueGrossAll)} · gross
          </span>
        </div>
        <div className="stat-tile stat-tile-5 stat-tile-static">
          <span className="stat-label">Est. profit (all time)</span>
          <span
            className={`stat-value stat-value-money ${
              profit.netEstimate > 0
                ? 'ok'
                : profit.netEstimate < 0
                  ? 'warn'
                  : ''
            }`}
          >
            {formatINR(profit.netEstimate)}
          </span>
          <span className="stat-hint">
            Received {formatINR(profit.totalReceived)} − team{' '}
            {formatINR(profit.teamPayouts)} − guest pay (net){' '}
            {formatINR(profit.guestPayCommitted)}
            {profit.guestPayRaw > profit.guestPayCommitted ? (
              <>
                {' '}
                <span
                  className="muted"
                  title="Same-person My Exposing due reduces Pay them in this total."
                >
                  (was {formatINR(profit.guestPayRaw)} before visit offset)
                </span>
              </>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          className="stat-tile stat-tile-6"
          onClick={() => setTab('field')}
        >
          <span className="stat-label">Pending (visits)</span>
          <span className="stat-value stat-value-money ok">
            {formatINR(totalVisitDueNet)}
          </span>
          {totalVisitDueGross > totalVisitDueNet ? (
            <span className="stat-gross-note">
              Gross on visits <strong>{formatINR(totalVisitDueGross)}</strong>
            </span>
          ) : null}
          <span className="stat-hint">Net after studio pay (same person)</span>
        </button>
      </div>

      <div className="dash-grid">
        <section className="card card-lift dash-card">
          <div className="dash-card-head">
            <h3>Upcoming orders</h3>
            <p className="dash-card-subtitle">
              Jobs whose event is still running or coming up (end date today or later—or no event date yet). After the
              event, once fully paid, they become <strong>Closed</strong> and leave this list. Past events with a
              balance due stay in <strong>Orders</strong> until paid (status updates there).
            </p>
          </div>
          {futureOrderRows.length === 0 ? (
            <div className="dash-empty dash-empty--orders">
              <span className="dash-empty-icon" aria-hidden="true">
                ✦
              </span>
              <p className="dash-empty-title">No upcoming orders</p>
              <p className="dash-empty-text">
                Nothing on the calendar through today for open jobs. Orders with payment still due after the event
                still appear in <strong>Orders</strong> with amount due until settled.
              </p>
              <button
                type="button"
                className="btn primary btn-sm shine"
                onClick={() => setTab('orders')}
              >
                New order
              </button>
            </div>
          ) : (
            <ul className="dash-feed">
              {futureOrderRows.map(({order, received, due, total}) => {
                const cname = clientById.get(order.clientId)?.name || '—'
                const dueOutstanding = Math.max(0, due)
                const overpaid = due < 0
                const whenLabel = upcomingOrderWhenLabel(order)
                return (
                  <li
                    key={order.id}
                    className="dash-feed-item dash-feed-item--client"
                  >
                    <div>
                      <div className="dash-feed-title-row">
                        <span className="dash-feed-title">{order.title}</span>
                        <span
                          className={`order-workflow-pill order-workflow-pill--${deriveOrderWorkflowStatus(order, todayDesk)}`}
                        >
                          {orderWorkflowLabel(deriveOrderWorkflowStatus(order, todayDesk))}
                        </span>
                      </div>
                      {whenLabel ? (
                        <div className="dash-order-when">
                          <span
                            className="dash-pill-date"
                            title="Event / shoot dates for this order"
                          >
                            {whenLabel}
                          </span>
                        </div>
                      ) : (
                        <p className="dash-order-when dash-order-when--empty muted small">
                          No event date — set in order
                        </p>
                      )}
                      <div className="dash-feed-client">{cname}</div>
                    </div>
                    <div className="dash-feed-money">
                      {dueOutstanding > 0 ? (
                        <div className="dash-feed-due">
                          {formatINR(dueOutstanding)}
                        </div>
                      ) : overpaid ? (
                        <div className="dash-feed-due dash-feed-due--overpaid">
                          Overpaid {formatINR(-due)}
                        </div>
                      ) : (
                        <div className="dash-feed-due dash-feed-due--paid">
                          Paid up
                        </div>
                      )}
                      <div className="dash-feed-received">
                        {total > 0 ? (
                          <>
                            Total {formatINR(total)} · Received{' '}
                            {formatINR(received)}
                          </>
                        ) : (
                          <>Received {formatINR(received)}</>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card card-lift dash-card">
          <div className="dash-card-head">
            <h3>Visit collections</h3>
            <p className="dash-card-subtitle">
              Upcoming shoots where you still need to collect.
            </p>
          </div>
          {dashboardVisitRows.length === 0 ? (
            <div className="dash-empty dash-empty--visits">
              <span className="dash-empty-icon" aria-hidden="true">
                ⌖
              </span>
              <p className="dash-empty-title">No pending collections</p>
              <p className="dash-empty-text">
                Log My Exposing with an amount to see it here.
              </p>
              <button
                type="button"
                className="btn primary btn-sm shine"
                onClick={() => setTab('field')}
              >
                Add visit
              </button>
            </div>
          ) : (
            <>
              <ul className="dash-feed">
                {dashboardVisitRows.map(({v, due}) => {
                  const {from, to} = fieldVisitRange(v)
                  const rangeLabel = formatDateRangeEn(from, to)
                  const isRange = from && to && to !== from
                  return (
                    <li
                      key={v.id}
                      className="dash-feed-item dash-feed-item--visit"
                    >
                      <div className="dash-visit-when">
                        <span
                          className="dash-pill-date"
                          title={isRange ? 'From – to' : 'Single day'}
                        >
                          {rangeLabel}
                        </span>
                        {v.time ? (
                          <span className="dash-visit-time muted">
                            {v.time}
                          </span>
                        ) : null}
                      </div>
                      <div className="dash-visit-host">{v.hostName}</div>
                      {v.venue ? (
                        <div className="dash-visit-venue muted">{v.venue}</div>
                      ) : null}
                      <div className="dash-visit-due">
                        <span className="muted">Still due</span>
                        <span
                          className={
                            due > 0
                              ? 'dash-visit-due-amt warn'
                              : 'dash-visit-due-amt ok'
                          }
                        >
                          {formatINR(Math.max(0, due))}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="dash-card-footer">
                <button
                  type="button"
                  className="btn primary btn-sm shine"
                  onClick={() => setTab('field')}
                >
                  Open My Exposing
                </button>
              </div>
            </>
          )}
        </section>

        {clientsWithBalanceDue.length > 0 || totalAllVisitsDueGrossAll > 0 ? (
          <section
            className="card card-lift dash-card card-wide"
            aria-label="Balances to collect"
          >
            <div className="dash-card-head">
              <h3>Balances to collect</h3>
              <p className="dash-card-subtitle">
                <strong>Studio</strong> = all client orders with something left to collect.{' '}
                <strong>My Exposing</strong> = gross still due on each outside visit (amount − collected), all dates.
                Combined is a simple sum — not the &quot;same person&quot; net from the Pending (visits) tile.
              </p>
            </div>
            <div className="dash-clients-grand-total dash-clients-grand-total--stack" role="status">
              <div className="dash-clients-grand-total-row">
                <span className="dash-clients-grand-total-label">Studio (all clients)</span>
                <span className="dash-clients-grand-total-subval">{formatINR(totalAllClientsStudioDue)}</span>
              </div>
              <div className="dash-clients-grand-total-row">
                <span className="dash-clients-grand-total-label">My Exposing (gross)</span>
                <span className="dash-clients-grand-total-subval">{formatINR(totalAllVisitsDueGrossAll)}</span>
              </div>
              <div className="dash-clients-grand-total-row dash-clients-grand-total-row--total">
                <span className="dash-clients-grand-total-label">Total desk</span>
                <span className="dash-clients-grand-total-value">
                  {formatINR(totalCollectStudioPlusExposingGross)}
                </span>
              </div>
            </div>
            {clientsWithBalanceDue.length > 0 ? (
              <>
                <ul className="dash-feed">
                  {balancesPage.slice.map(row => (
                    <li key={row.clientId} className="dash-feed-item dash-feed-item--client">
                      <div>
                        <div className="dash-feed-title">{row.name}</div>
                        <div className="muted small">
                          {row.orderCount} {row.orderCount === 1 ? 'job' : 'jobs'} with balance
                        </div>
                      </div>
                      <div className="dash-feed-money">
                        <div className="dash-feed-due">{formatINR(row.dueSum)}</div>
                        <div className="dash-feed-received">to collect</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <DashPagination
                  page={balancesPage.page}
                  pageCount={balancesPage.pageCount}
                  total={balancesPage.total}
                  pageSize={listPageSize}
                  setPage={balancesPage.setPage}
                  onPageSizeChange={setListPageSize}
                  pageSizeOptions={DASH_LIST_PAGE_SIZE_OPTIONS}
                />
              </>
            ) : (
              <p className="muted small" style={{margin: '0 0 0.75rem'}}>
                No studio balances by client right now. Use <strong>My Exposing</strong> for outside collections.
              </p>
            )}
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem'}}>
              <button type="button" className="btn primary btn-sm shine" onClick={() => setTab('orders')}>
                Open orders
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setTab('field')}>
                My Exposing
              </button>
            </div>
          </section>
        ) : null}

        <section className="card card-lift dash-card card-wide dash-card--settle">
          <div className="dash-card-head">
            <h3>Same-person net</h3>
            <p className="dash-card-subtitle">
              Field <strong>due</strong> minus studio <strong>Pay them</strong>{' '}
              when it&apos;s the same contact (name or Match key).
            </p>
          </div>
          {settlementHint ? (
            <p className="dash-settle-hint">
              Studio pay and visit money both exist, but nothing linked—use the
              same <strong>Match key</strong> on the guest and the visit (or
              similar names).
            </p>
          ) : null}
          {settlementRows.length === 0 ? (
            <div className="dash-empty dash-empty--settle">
              <span className="dash-empty-icon" aria-hidden="true">
                ⇄
              </span>
              <p className="dash-empty-title">No offsets yet</p>
              <p className="dash-empty-text">
                Add &quot;Pay them&quot; on an exposure guest and My Exposing
                for the same person.
              </p>
            </div>
          ) : (
            <div className="settlement-table-wrap">
              <table className="settlement-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>You pay (studio)</th>
                    <th>Still due (visit)</th>
                    <th>Net for you</th>
                  </tr>
                </thead>
                <tbody>
                  {settlementRows.map(r => (
                    <tr
                      key={r.key}
                      className={r.hasBothSides ? 'settlement-row--net' : ''}
                    >
                      <td>{r.label}</td>
                      <td>
                        {r.payToGuest > 0 ? formatINR(r.payToGuest) : '—'}
                      </td>
                      <td>
                        {r.collectDue > 0 ? formatINR(r.collectDue) : '—'}
                      </td>
                      <td>
                        {r.net === 0 && r.hasBothSides ? (
                          <span className="ok">Even on these two</span>
                        ) : r.net > 0 ? (
                          <span className="warn">
                            Collect <strong>{formatINR(r.net)}</strong>
                          </span>
                        ) : r.net < 0 ? (
                          <span>
                            Pay <strong>{formatINR(-r.net)}</strong> net
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
