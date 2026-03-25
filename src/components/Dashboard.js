import {useMemo, useState} from 'react'
import {useStudio} from '../context/StudioContext'
import {useTab} from '../context/TabContext'
import {formatINR, sumPayments} from '../utils/money'
import {
  coerceDateFieldToISO,
  fieldVisitRange,
  formatDateRangeEn,
  orderEventRange,
} from '../utils/dateRange'
import {
  buildSettlementRows,
  computeStudioProfit,
  netVisitPendingAfterStudioPay,
  settlementNeedsLinkHint,
} from '../utils/settlement'
import {
  addDaysISO,
  localCalendarTodayISO,
  orderEventStartsTomorrow,
  orderPastDueWithBalance,
  visitTouchesTomorrow,
} from '../utils/reminders'

function todayISO() {
  return localCalendarTodayISO()
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
  const {setTab} = useTab()
  const [notifPerm, setNotifPerm] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  )
  const futureOrderRows = useMemo(() => {
    const t = todayISO()
    return orders
      .map(o => {
        const received = sumPayments(o.clientPayments)
        const total = Number(o.totalAmount) || 0
        const due = total - received
        return {order: o, received, due, total}
      })
      .filter(x => isOrderFuture(x.order, t))
      .sort((a, b) => {
        const c = futureOrderSortKey(a.order).localeCompare(
          futureOrderSortKey(b.order),
        )
        if (c !== 0) return c
        if (b.due !== a.due) return b.due - a.due
        return (a.order.title || '').localeCompare(b.order.title || '')
      })
  }, [orders])

  /** Only unpaid portion on still-upcoming orders (stat tile). */
  const totalClientDue = useMemo(() => {
    return futureOrderRows.reduce((s, x) => s + Math.max(0, x.due), 0)
  }, [futureOrderRows])

  const visitBalances = useMemo(() => {
    return (fieldVisits || []).map(v => {
      const received = sumPayments(v.collections)
      const total = Number(v.amountToCollect) || 0
      return {v, received, due: total - received}
    })
  }, [fieldVisits])

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

  const tomorrowOrders = useMemo(() => {
    const t = todayISO()
    return orders
      .filter(o => orderEventStartsTomorrow(o, t))
      .map(o => ({
        order: o,
        client: clientById.get(o.clientId)?.name || '—',
        when: upcomingOrderWhenLabel(o),
      }))
  }, [orders, clientById])

  const tomorrowVisits = useMemo(() => {
    const t = todayISO()
    return (fieldVisits || [])
      .filter(v => visitTouchesTomorrow(v, t))
      .map(v => {
        const {from, to} = fieldVisitRange(v)
        return {v, rangeLabel: formatDateRangeEn(from, to)}
      })
  }, [fieldVisits])

  const pastDueOrders = useMemo(() => {
    const t = todayISO()
    return orders
      .filter(o => orderPastDueWithBalance(o, t))
      .map(o => {
        const received = sumPayments(o.clientPayments)
        const due = (Number(o.totalAmount) || 0) - received
        return {
          order: o,
          client: clientById.get(o.clientId)?.name || '—',
          due: Math.max(0, due),
          when: upcomingOrderWhenLabel(o),
        }
      })
      .sort((a, b) => b.due - a.due)
  }, [orders, clientById])

  const hasReminders =
    tomorrowOrders.length > 0 || tomorrowVisits.length > 0 || pastDueOrders.length > 0

  async function requestBrowserNotifications() {
    if (typeof Notification === 'undefined') return
    const r = await Notification.requestPermission()
    setNotifPerm(r)
  }

  const showReminderCard =
    !isFresh && (hasReminders || notifPerm === 'default')

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

      {showReminderCard ? (
        <section className="card dash-reminders" aria-label="Reminders">
          <div className="dash-reminders-head">
            <h3 className="dash-reminders-title">Reminders</h3>
            <div className="dash-reminders-actions">
              {typeof Notification !== 'undefined' && notifPerm === 'default' ? (
                <button type="button" className="btn btn-sm primary" onClick={requestBrowserNotifications}>
                  Browser alerts
                </button>
              ) : null}
            </div>
            {typeof Notification !== 'undefined' && notifPerm === 'denied' ? (
              <span className="muted small">Alerts blocked — allow notifications in browser settings.</span>
            ) : null}
            {notifPerm === 'granted' ? (
              <span className="muted small dash-reminders-ok">Browser alerts on</span>
            ) : null}
          </div>
          <p className="dash-reminders-lead muted small">
            <strong>Browser alerts</strong> — system notifications while this tab stays open, up to{' '}
            <strong>5 times per day</strong> per reminder type, with spacing so they do not stack.
          </p>
          {tomorrowOrders.length > 0 ? (
            <div className="dash-reminder-block">
              <h4 className="dash-reminder-block-title">
                Tomorrow (
                {formatDateRangeEn(addDaysISO(todayISO(), 1), addDaysISO(todayISO(), 1))})
              </h4>
              <ul className="dash-reminder-list">
                {tomorrowOrders.map(({order, client, when}) => (
                  <li key={order.id}>
                    <button type="button" className="dash-reminder-row" onClick={() => setTab('orders')}>
                      <span className="dash-reminder-main">
                        <strong>{order.title}</strong>
                        <span className="muted small">{client}</span>
                      </span>
                      <span className="dash-reminder-meta muted small">{when}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {tomorrowVisits.length > 0 ? (
            <div className="dash-reminder-block">
              <h4 className="dash-reminder-block-title">My exposing tomorrow</h4>
              <ul className="dash-reminder-list">
                {tomorrowVisits.map(({v, rangeLabel}) => (
                  <li key={v.id}>
                    <button type="button" className="dash-reminder-row" onClick={() => setTab('field')}>
                      <span className="dash-reminder-main">
                        <strong>{v.hostName}</strong>
                        {v.venue ? <span className="muted small">{v.venue}</span> : null}
                      </span>
                      <span className="dash-reminder-meta muted small">{rangeLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pastDueOrders.length > 0 ? (
            <div className="dash-reminder-block">
              <h4 className="dash-reminder-block-title">Collect payment (event over, balance left)</h4>
              <ul className="dash-reminder-list">
                {pastDueOrders.map(({order, client, due, when}) => (
                  <li key={order.id}>
                    <button type="button" className="dash-reminder-row" onClick={() => setTab('orders')}>
                      <span className="dash-reminder-main">
                        <strong>{order.title}</strong>
                        <span className="muted small">{client}</span>
                      </span>
                      <span className="dash-reminder-meta warn">{formatINR(due)} due</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!hasReminders && notifPerm === 'default' ? (
            <p className="muted small" style={{margin: 0}}>
              No list items right now. Turn on browser alerts to get pings when jobs or payments need attention.
            </p>
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
          <span className="stat-hint">Orders not ended</span>
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
              Future jobs on the calendar—shown even when fully paid; balance
              due when anything is left to receive.
            </p>
          </div>
          {futureOrderRows.length === 0 ? (
            <div className="dash-empty dash-empty--orders">
              <span className="dash-empty-icon" aria-hidden="true">
                ✦
              </span>
              <p className="dash-empty-title">No upcoming orders</p>
              <p className="dash-empty-text">
                When an order&apos;s event is still today or ahead, it appears
                here.
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
                      <div className="dash-feed-title">{order.title}</div>
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
