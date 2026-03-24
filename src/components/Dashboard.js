import {useMemo} from 'react'
import {useStudio} from '../context/StudioContext'
import {useTab} from '../context/TabContext'
import {formatINR, sumPayments} from '../utils/money'
import {
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

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/** Event / job still in the future (uses event to-date, else order date). Undated orders stay visible. */
function isOrderFuture(order, today) {
  const {from, to} = orderEventRange(order)
  const end = to || from
  if (end) return end >= today
  const od = (order.orderDate || '').slice(0, 10)
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

export default function Dashboard() {
  const {orders, clients, clientById, fieldVisits} = useStudio()
  const {setTab} = useTab()

  const clientDues = useMemo(() => {
    const t = todayISO()
    return orders
      .map(o => {
        const received = sumPayments(o.clientPayments)
        const due = (Number(o.totalAmount) || 0) - received
        return {order: o, received, due}
      })
      .filter(x => x.due > 0 && isOrderFuture(x.order, t))
      .sort((a, b) => b.due - a.due)
  }, [orders])

  const totalClientDue = useMemo(
    () => clientDues.reduce((s, x) => s + x.due, 0),
    [clientDues],
  )

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
            <h3>Future order dues</h3>
            <p className="dash-card-subtitle">
              Upcoming jobs with balance left to receive.
            </p>
          </div>
          {clientDues.length === 0 ? (
            <div className="dash-empty dash-empty--orders">
              <span className="dash-empty-icon" aria-hidden="true">
                ✦
              </span>
              <p className="dash-empty-title">No dues on the horizon</p>
              <p className="dash-empty-text">
                When a future job has money pending, it lands here.
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
              {clientDues.map(({order, received, due}) => {
                const cname = clientById.get(order.clientId)?.name || '—'
                return (
                  <li
                    key={order.id}
                    className="dash-feed-item dash-feed-item--client"
                  >
                    <div>
                      <div className="dash-feed-title">{order.title}</div>
                      <div className="dash-feed-client">{cname}</div>
                    </div>
                    <div className="dash-feed-money">
                      <div className="dash-feed-due">{formatINR(due)}</div>
                      <div className="dash-feed-received">
                        Received {formatINR(received)}
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
