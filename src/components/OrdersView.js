import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { useTab } from '../context/TabContext';
import { formatINR, sumPayments } from '../utils/money';
import { formatDateRangeEn, formatISODateDisplay, orderEventRange } from '../utils/dateRange';

export default function OrdersView() {
  const { setTab, navFocus, clearNavFocus } = useTab();
  const titleRef = useRef(null);
  const {
    orders,
    clients,
    clientById,
    addOrder,
    updateOrder,
    removeOrder,
    addClientPayment,
    removeClientPayment,
    addExposureGuest,
    updateExposureGuest,
    removeExposureGuest,
  } = useStudio();

  const [selectedId, setSelectedId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [newOrderDate, setNewOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEventFrom, setNewEventFrom] = useState('');
  const [newEventTo, setNewEventTo] = useState('');

  const selected = useMemo(() => orders.find((o) => o.id === selectedId) || null, [orders, selectedId]);

  useEffect(() => {
    if (!navFocus || navFocus.kind !== 'order') return;
    const id = navFocus.id;
    if (!orders.some((o) => o.id === id)) {
      clearNavFocus();
      return;
    }
    setSelectedId(id);
    clearNavFocus();
    requestAnimationFrame(() => {
      const el = document.getElementById(`order-pick-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el?.classList.add('desk-flash');
      window.setTimeout(() => el?.classList.remove('desk-flash'), 2000);
    });
  }, [navFocus, orders, clearNavFocus]);

  function submitOrder(e) {
    e.preventDefault();
    const o = addOrder({
      clientId: newClientId,
      title: newTitle,
      totalAmount: newTotal,
      orderDate: newOrderDate,
      eventDateFrom: newEventFrom,
      eventDateTo: newEventTo || newEventFrom,
    });
    if (o) {
      setNewTitle('');
      setNewTotal('');
      setNewEventFrom('');
      setNewEventTo('');
      setSelectedId(o.id);
    }
  }

  function focusNewOrder() {
    titleRef.current?.focus();
    titleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Orders</h2>
          <p className="panel-lead">
            Quote, booking date, optional <strong>event from → to</strong> for multi-day functions (e.g. wedding),
            and client payments.
          </p>
        </div>
      </div>

      {!clients.length ? (
        <div className="glass-panel" style={{ marginBottom: '1rem' }}>
          <h3 className="glass-panel-title">Almost there</h3>
          <p className="muted" style={{ margin: '0 0 0.85rem' }}>
            Add a client first—then you can attach orders and track payments.
          </p>
          <button type="button" className="btn primary shine" onClick={() => setTab('clients')}>
            Go to Clients
          </button>
        </div>
      ) : null}

      <div className="glass-panel">
        <h3 className="glass-panel-title">New order</h3>
        <form className="form-grid" onSubmit={submitOrder} style={{ marginBottom: 0 }}>
          <label>
            Client *
            <select
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              required
            >
              <option value="">— Select —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Order / event name *
            <input ref={titleRef} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          </label>
          <label>
            Total quote (₹)
            <input
              type="number"
              min="0"
              value={newTotal}
              onChange={(e) => setNewTotal(e.target.value)}
            />
          </label>
          <label>
            Order date
            <input
              type="date"
              lang="en-IN"
              value={newOrderDate}
              onChange={(e) => setNewOrderDate(e.target.value)}
            />
          </label>
          <label>
            Event from
            <input type="date" lang="en-IN" value={newEventFrom} onChange={(e) => setNewEventFrom(e.target.value)} />
          </label>
          <label>
            Event to
            <input
              type="date"
              lang="en-IN"
              value={newEventTo}
              onChange={(e) => setNewEventTo(e.target.value)}
              min={newEventFrom || undefined}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary shine" disabled={!clients.length}>
              Create order
            </button>
          </div>
        </form>
      </div>

      <div className="split">
        <div>
          <h3 className="subhead">Your jobs</h3>
          <ul className="order-pick">
            {orders.length === 0 && clients.length > 0 ? (
              <li>
                <button type="button" className="empty-spotlight" onClick={focusNewOrder}>
                  <div className="empty-spotlight-icon" aria-hidden="true">
                    ✦
                  </div>
                  <h3>No orders yet</h3>
                  <p>Tap to jump to the form and log your first booking.</p>
                </button>
              </li>
            ) : null}
            {orders.length === 0 && !clients.length ? (
              <li className="muted">Add a client to create orders.</li>
            ) : null}
            {orders.map((o) => {
              const rec = sumPayments(o.clientPayments);
              const total = Number(o.totalAmount) || 0;
              const due = total - rec;
              const ev = orderEventRange(o);
              const evLabel = ev.from ? formatDateRangeEn(ev.from, ev.to) : null;
              const guestCount = (o.exposureGuests || []).length;
              return (
                <li key={o.id}>
                  <button
                    id={`order-pick-${o.id}`}
                    type="button"
                    className={`pick ${selectedId === o.id ? 'active' : ''}`}
                    onClick={() => setSelectedId(o.id)}
                  >
                    <div className="pick-title">{o.title}</div>
                    <div className="muted small">
                      {clientById.get(o.clientId)?.name} · Due:{' '}
                      <span className={due > 0 ? 'warn' : 'ok'}>{formatINR(Math.max(0, due))}</span>
                    </div>
                    {evLabel ? <div className="muted small">Event: {evLabel}</div> : null}
                    {guestCount > 0 ? (
                      <div className="pick-guest-hint">{guestCount} coming to studio</div>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="detail-pane">
          {!selected ? (
            <div className="empty-detail">
              <div className="empty-detail-visual" aria-hidden="true">
                📋
              </div>
              <p className="muted" style={{ margin: 0, maxWidth: '240px' }}>
                Pick a job on the left to edit the quote and client payments.
              </p>
              <button type="button" className="btn primary btn-sm shine" onClick={() => setTab('field')}>
                Outside shoots → My Exposing
              </button>
            </div>
          ) : (
            <OrderDetail
              key={selected.id}
              order={selected}
              clientName={clientById.get(selected.clientId)?.name || '—'}
              updateOrder={updateOrder}
              removeOrder={removeOrder}
              addClientPayment={addClientPayment}
              removeClientPayment={removeClientPayment}
              addExposureGuest={addExposureGuest}
              updateExposureGuest={updateExposureGuest}
              removeExposureGuest={removeExposureGuest}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function OrderDetail({
  order,
  clientName,
  updateOrder,
  removeOrder,
  addClientPayment,
  removeClientPayment,
  addExposureGuest,
  updateExposureGuest,
  removeExposureGuest,
  onDeleted,
}) {
  const [title, setTitle] = useState(order.title);
  const [totalAmount, setTotalAmount] = useState(String(order.totalAmount ?? ''));
  const [orderDate, setOrderDate] = useState(order.orderDate || '');
  const er0 = orderEventRange(order);
  const [eventDateFrom, setEventDateFrom] = useState(order.eventDateFrom || er0.from || '');
  const [eventDateTo, setEventDateTo] = useState(() => {
    const from = order.eventDateFrom || er0.from || '';
    const to = order.eventDateTo || er0.to || '';
    if (from && to === from) return '';
    return to;
  });
  const [notes, setNotes] = useState(order.notes || '');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState('');

  const received = sumPayments(order.clientPayments);
  const total = Number(order.totalAmount) || 0;
  const due = total - received;

  function saveMeta(e) {
    e.preventDefault();
    let evFrom = eventDateFrom.trim().slice(0, 10);
    let evTo = eventDateTo.trim().slice(0, 10);
    if (evFrom && !evTo) evTo = evFrom;
    if (evFrom && evTo && evTo < evFrom) evTo = evFrom;
    updateOrder(order.id, {
      title: title.trim(),
      totalAmount: Number(totalAmount) || 0,
      orderDate,
      eventDateFrom: evFrom,
      eventDateTo: evTo,
      notes: notes.trim(),
    });
  }

  function addPay(e) {
    e.preventDefault();
    addClientPayment(order.id, { amount: payAmount, date: payDate, note: payNote });
    setPayAmount('');
    setPayNote('');
  }

  return (
    <div className="order-detail">
      <div className="detail-head">
        <h3>{order.title}</h3>
        <button
          type="button"
          className="btn small danger"
          onClick={() => {
            if (window.confirm('Delete this order permanently?')) {
              removeOrder(order.id);
              onDeleted();
            }
          }}
        >
          Delete order
        </button>
      </div>
      <p className="muted">Client: {clientName}</p>

      <form className="form-grid tight" onSubmit={saveMeta}>
        <label>
          Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Total (₹)
          <input type="number" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
        </label>
        <label>
          Order date
          <input type="date" lang="en-IN" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </label>
        <label>
          Event from
          <input type="date" lang="en-IN" value={eventDateFrom} onChange={(e) => setEventDateFrom(e.target.value)} />
        </label>
        <label>
          Event to
          <input
            type="date"
            lang="en-IN"
            value={eventDateTo}
            onChange={(e) => setEventDateTo(e.target.value)}
            min={eventDateFrom || undefined}
          />
        </label>
        <p className="muted small full" style={{ gridColumn: '1 / -1', margin: '-0.25rem 0 0' }}>
          For single-day events, leave &quot;Event to&quot; empty. For weddings across several days, set both.
        </p>
        <label className="full">
          Notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="form-actions full">
          <button type="submit" className="btn primary">
            Save details
          </button>
        </div>
      </form>

      <div className="money-strip">
        <span>Received: {formatINR(received)}</span>
        <span>Total: {formatINR(total)}</span>
        <span>
          Due: <strong className={due > 0 ? 'warn' : 'ok'}>{formatINR(Math.max(0, due))}</strong>
        </span>
      </div>

      <ExposureGuestsSection
        orderId={order.id}
        guests={order.exposureGuests}
        addExposureGuest={addExposureGuest}
        updateExposureGuest={updateExposureGuest}
        removeExposureGuest={removeExposureGuest}
      />

      <section className="subblock">
        <h4>Client payments / installments</h4>
        <form className="form-row" onSubmit={addPay}>
          <input
            type="number"
            min="0"
            placeholder="Amount (₹)"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            required
          />
          <input type="date" lang="en-IN" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          <input placeholder="Note" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          <button type="submit" className="btn primary">
            Add
          </button>
        </form>
        <ul className="mini-table">
          {(order.clientPayments || []).map((p) => (
            <li key={p.id}>
              <span>{formatISODateDisplay(p.date)}</span>
              <span>{formatINR(p.amount)}</span>
              <span className="muted">{p.note}</span>
              <button
                type="button"
                className="btn tiny danger"
                onClick={() => removeClientPayment(order.id, p.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ExposureGuestsSection({
  orderId,
  guests,
  addExposureGuest,
  updateExposureGuest,
  removeExposureGuest,
}) {
  const list = guests || [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gAmount, setGAmount] = useState('');
  const [gPartyKey, setGPartyKey] = useState('');
  const [gnotes, setGnotes] = useState('');
  const [editingId, setEditingId] = useState(null);

  function submitGuest(e) {
    e.preventDefault();
    if (editingId) {
      updateExposureGuest(orderId, editingId, {
        name,
        phone,
        amountToPay: gAmount,
        partyKey: gPartyKey,
        notes: gnotes,
      });
      setEditingId(null);
      setName('');
      setPhone('');
      setGAmount('');
      setGPartyKey('');
      setGnotes('');
      return;
    }
    const g = addExposureGuest(orderId, {
      name,
      phone,
      amountToPay: gAmount,
      partyKey: gPartyKey,
      notes: gnotes,
    });
    if (g) {
      setName('');
      setPhone('');
      setGAmount('');
      setGPartyKey('');
      setGnotes('');
    }
  }

  function startEdit(g) {
    setEditingId(g.id);
    setName(g.name);
    setPhone(g.phone || '');
    setGAmount(String(g.amountToPay ?? ''));
    setGPartyKey(g.partyKey || '');
    setGnotes(g.notes || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setPhone('');
    setGAmount('');
    setGPartyKey('');
    setGnotes('');
  }

  return (
    <section className="subblock exposure-guests-block">
      <h4>Who is coming to your studio for this Order</h4>
      <p className="muted small" style={{ margin: '0 0 0.65rem' }}>
        Add everyone who will be at <strong>your place</strong> for this job. When <em>you</em> go to someone
        else&apos;s location, use the <strong>My Exposing</strong> tab instead. If you owe them money for the
        exposure, enter it under <strong>Pay them</strong>. Use the same <strong>Match key</strong> on My Exposing
        (or the same spelling) so the dashboard can net what you collect minus what you pay.
      </p>
      <form className="form-grid tight" onSubmit={submitGuest}>
        <label>
          Name *
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          Pay them (₹)
          <input
            type="number"
            min="0"
            placeholder="0"
            value={gAmount}
            onChange={(e) => setGAmount(e.target.value)}
          />
        </label>
        <label>
          Match key
          <input
            placeholder="e.g. sandip — same on My Exposing"
            value={gPartyKey}
            onChange={(e) => setGPartyKey(e.target.value)}
          />
        </label>
        <label className="full">
          Note (role, day, etc.)
          <input value={gnotes} onChange={(e) => setGnotes(e.target.value)} />
        </label>
        <div className="form-actions full">
          <button type="submit" className="btn primary">
            {editingId ? 'Save' : 'Add'}
          </button>
          {editingId ? (
            <button type="button" className="btn" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {list.length === 0 ? (
        <p className="muted small" style={{ margin: '0.65rem 0 0' }}>
          No one listed yet.
        </p>
      ) : (
        <ul className="exposure-guest-list">
          {list.map((g) => (
            <li key={g.id} className="exposure-guest-row">
              <div>
                <strong>{g.name}</strong>
                {g.phone ? <span className="muted"> · {g.phone}</span> : null}
                {(Number(g.amountToPay) || 0) > 0 ? (
                  <div className="muted small">You pay: {formatINR(g.amountToPay)}</div>
                ) : null}
                {g.partyKey ? <div className="muted small">Match key: {g.partyKey}</div> : null}
                {g.notes ? <div className="muted small">{g.notes}</div> : null}
              </div>
              <div className="row-actions">
                <button type="button" className="btn small" onClick={() => startEdit(g)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => {
                    if (window.confirm(`Remove ${g.name} from this list?`)) removeExposureGuest(orderId, g.id);
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
