import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudio } from '../context/StudioContext';
import { useTab } from '../context/TabContext';
import { useConfirm } from '../context/ConfirmContext';
import { formatINR, sumPayments } from '../utils/money';
import { formatDateRangeEn, formatISODateDisplay, orderEventRange } from '../utils/dateRange';
import { deriveOrderWorkflowStatus, orderWorkflowLabel } from '../utils/orderWorkflow';
import { localCalendarTodayISO } from '../utils/reminders';

export default function OrdersView() {
  const { t } = useTranslation();
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
  const [newAddress, setNewAddress] = useState('');

  const selected = useMemo(() => orders.find((o) => o.id === selectedId) || null, [orders, selectedId]);
  const deskToday = localCalendarTodayISO();

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
      address: newAddress,
    });
    if (o) {
      setNewTitle('');
      setNewTotal('');
      setNewEventFrom('');
      setNewEventTo('');
      setNewAddress('');
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
          <h2 className="panel-title">{t('orders.title')}</h2>
          <p className="panel-lead">{t('orders.lead')}</p>
        </div>
      </div>

      {!clients.length ? (
        <div className="glass-panel" style={{ marginBottom: '1rem' }}>
          <h3 className="glass-panel-title">{t('orders.almostTitle')}</h3>
          <p className="muted" style={{ margin: '0 0 0.85rem' }}>
            {t('orders.almostText')}
          </p>
          <button type="button" className="btn primary shine" onClick={() => setTab('clients')}>
            {t('orders.goClients')}
          </button>
        </div>
      ) : null}

      <div className="glass-panel">
        <h3 className="glass-panel-title">{t('orders.newOrderForm')}</h3>
        <form className="form-grid" onSubmit={submitOrder} style={{ marginBottom: 0 }}>
          <label>
            {t('orders.labelClient')}
            <select
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              required
            >
              <option value="">{t('common.select')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('orders.labelTitle')}
            <input ref={titleRef} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          </label>
          <label>
            {t('orders.labelTotal')}
            <input
              type="number"
              min="0"
              value={newTotal}
              onChange={(e) => setNewTotal(e.target.value)}
            />
          </label>
          <label>
            {t('orders.labelOrderDate')}
            <input
              type="date"
              lang="en-IN"
              value={newOrderDate}
              onChange={(e) => setNewOrderDate(e.target.value)}
            />
          </label>
          <label>
            {t('orders.labelEventFrom')}
            <input type="date" lang="en-IN" value={newEventFrom} onChange={(e) => setNewEventFrom(e.target.value)} />
          </label>
          <label>
            {t('orders.labelEventTo')}
            <input
              type="date"
              lang="en-IN"
              value={newEventTo}
              onChange={(e) => setNewEventTo(e.target.value)}
              min={newEventFrom || undefined}
            />
          </label>
          <label className="full">
            {t('orders.labelVenue')}
            <textarea
              rows={2}
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder={t('orders.venuePlaceholder')}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary shine" disabled={!clients.length}>
              {t('orders.createOrder')}
            </button>
          </div>
        </form>
      </div>

      <div className="split">
        <div>
          <h3 className="subhead">{t('orders.yourJobs')}</h3>
          <ul className="order-pick">
            {orders.length === 0 && clients.length > 0 ? (
              <li>
                <button type="button" className="empty-spotlight" onClick={focusNewOrder}>
                  <div className="empty-spotlight-icon" aria-hidden="true">
                    ✦
                  </div>
                  <h3>{t('orders.noOrdersTitle')}</h3>
                  <p>{t('orders.noOrdersText')}</p>
                </button>
              </li>
            ) : null}
            {orders.length === 0 && !clients.length ? (
              <li className="muted">{t('orders.needClient')}</li>
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
                    <div className="pick-title-row">
                      <div className="pick-title">{o.title}</div>
                      <span
                        className={`order-workflow-pill order-workflow-pill--${deriveOrderWorkflowStatus(o, deskToday)}`}
                      >
                        {orderWorkflowLabel(deriveOrderWorkflowStatus(o, deskToday))}
                      </span>
                    </div>
                    <div className="muted small">
                      {clientById.get(o.clientId)?.name} · {t('orders.due')}{' '}
                      <span className={due > 0 ? 'warn' : 'ok'}>{formatINR(Math.max(0, due))}</span>
                    </div>
                    {evLabel ? (
                      <div className="muted small">
                        {t('orders.event')} {evLabel}
                      </div>
                    ) : null}
                    {o.address ? (
                      <div className="muted small" style={{ marginTop: 2 }}>
                        {o.address.length > 72 ? `${o.address.slice(0, 72)}…` : o.address}
                      </div>
                    ) : null}
                    {guestCount > 0 ? (
                      <div className="pick-guest-hint">{t('orders.guestsHint', { count: guestCount })}</div>
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
                {t('orders.detailEmpty')}
              </p>
              <button type="button" className="btn primary btn-sm shine" onClick={() => setTab('field')}>
                {t('orders.detailCta')}
              </button>
            </div>
          ) : (
            <OrderDetail
              key={selected.id}
              order={selected}
              clientName={clientById.get(selected.clientId)?.name || t('common.dash')}
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
  const { t } = useTranslation();
  const { confirmAsync } = useConfirm();
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
  const [address, setAddress] = useState(order.address || '');
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
      address: address.trim(),
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
            void (async () => {
              const ok = await confirmAsync({
                title: t('orders.deleteOrder'),
                message: t('orders.deleteOrderConfirm'),
                confirmLabel: t('common.delete'),
                cancelLabel: t('common.cancel'),
              });
              if (ok) {
                removeOrder(order.id);
                onDeleted();
              }
            })();
          }}
        >
          {t('orders.deleteOrder')}
        </button>
      </div>
      <p className="muted">
        {t('orders.clientLabel')} {clientName}
      </p>

      <form className="form-grid tight" onSubmit={saveMeta}>
        <label>
          {t('common.name')}
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          {t('orders.labelTotalShort')}
          <input type="number" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
        </label>
        <p className="muted small full" style={{ gridColumn: '1 / -1', margin: '0 0 0.25rem' }}>
          {t('orders.statusLine')}{' '}
          <strong className={`order-workflow-pill order-workflow-pill--${deriveOrderWorkflowStatus(order, localCalendarTodayISO())}`} style={{ display: 'inline-block', marginLeft: '0.35rem' }}>
            {orderWorkflowLabel(deriveOrderWorkflowStatus(order, localCalendarTodayISO()))}
          </strong>
          <span className="muted"> {t('orders.statusHint')}</span>
        </p>
        <label>
          {t('orders.labelOrderDate')}
          <input type="date" lang="en-IN" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </label>
        <label>
          {t('orders.labelEventFrom')}
          <input type="date" lang="en-IN" value={eventDateFrom} onChange={(e) => setEventDateFrom(e.target.value)} />
        </label>
        <label>
          {t('orders.labelEventTo')}
          <input
            type="date"
            lang="en-IN"
            value={eventDateTo}
            onChange={(e) => setEventDateTo(e.target.value)}
            min={eventDateFrom || undefined}
          />
        </label>
        <p className="muted small full" style={{ gridColumn: '1 / -1', margin: '-0.25rem 0 0' }}>
          {t('orders.eventToHint')}
        </p>
        <label className="full">
          {t('orders.labelVenue')}
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t('orders.venuePlaceholder')}
          />
        </label>
        <label className="full">
          {t('common.notes')}
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="form-actions full">
          <button type="submit" className="btn primary">
            {t('orders.saveDetails')}
          </button>
        </div>
      </form>

      <div className="money-strip">
        <span>
          {t('orders.received')} {formatINR(received)}
        </span>
        <span>
          {t('orders.total')} {formatINR(total)}
        </span>
        <span>
          {t('orders.dueLabel')} <strong className={due > 0 ? 'warn' : 'ok'}>{formatINR(Math.max(0, due))}</strong>
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
        <h4>{t('orders.paymentsTitle')}</h4>
        <form className="form-row" onSubmit={addPay}>
          <input
            type="number"
            min="0"
            placeholder={t('orders.amountPlaceholder')}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            required
          />
          <input type="date" lang="en-IN" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          <input placeholder={t('orders.payNote')} value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          <button type="submit" className="btn primary">
            {t('common.add')}
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
                onClick={() => {
                  void (async () => {
                    const ok = await confirmAsync({
                      title: t('orders.confirmRemovePaymentTitle'),
                      message: t('orders.removePaymentConfirm', {
                        amount: formatINR(p.amount),
                        date: formatISODateDisplay(p.date),
                      }),
                      confirmLabel: t('common.remove'),
                      cancelLabel: t('common.cancel'),
                    });
                    if (ok) removeClientPayment(order.id, p.id);
                  })();
                }}
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
  const { t } = useTranslation();
  const { confirmAsync } = useConfirm();
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
      <h4>{t('orders.exposureTitle')}</h4>
      <p className="muted small" style={{ margin: '0 0 0.65rem' }}>
        {t('orders.exposureIntro')}
      </p>
      <form className="form-grid tight" onSubmit={submitGuest}>
        <label>
          {t('orders.labelNameReq')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t('common.phone')}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label>
          {t('orders.payThem')}
          <input
            type="number"
            min="0"
            placeholder="0"
            value={gAmount}
            onChange={(e) => setGAmount(e.target.value)}
          />
        </label>
        <label>
          {t('orders.matchKey')}
          <input
            placeholder={t('orders.matchKeyPlaceholder')}
            value={gPartyKey}
            onChange={(e) => setGPartyKey(e.target.value)}
          />
        </label>
        <label className="full">
          {t('orders.guestNoteLabel')}
          <input
            placeholder={t('orders.guestNotePlaceholder')}
            value={gnotes}
            onChange={(e) => setGnotes(e.target.value)}
          />
        </label>
        <div className="form-actions full">
          {editingId ? (
            <button type="button" className="btn" onClick={cancelEdit}>
              {t('common.cancel')}
            </button>
          ) : null}
          <button type="submit" className="btn primary">
            {editingId ? t('common.save') : t('common.add')}
          </button>
        </div>
      </form>
      {list.length === 0 ? (
        <p className="muted small" style={{ margin: '0.65rem 0 0' }}>
          {t('orders.noGuests')}
        </p>
      ) : (
        <ul className="exposure-guest-list">
          {list.map((g) => (
            <li key={g.id} className="exposure-guest-row">
              <div>
                <strong>{g.name}</strong>
                {g.phone ? <span className="muted"> · {g.phone}</span> : null}
                {(Number(g.amountToPay) || 0) > 0 ? (
                  <div className="muted small">
                    {t('orders.youPay')} {formatINR(g.amountToPay)}
                  </div>
                ) : null}
                {g.partyKey ? (
                  <div className="muted small">
                    {t('orders.matchKeyLabel')} {g.partyKey}
                  </div>
                ) : null}
                {g.notes ? <div className="muted small">{g.notes}</div> : null}
              </div>
              <div className="row-actions">
                <button type="button" className="btn small" onClick={() => startEdit(g)}>
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => {
                    void (async () => {
                      const ok = await confirmAsync({
                        title: t('orders.confirmRemoveGuestTitle'),
                        message: t('orders.removeGuestConfirm', { name: g.name }),
                        confirmLabel: t('common.remove'),
                        cancelLabel: t('common.cancel'),
                      });
                      if (ok) removeExposureGuest(orderId, g.id);
                    })();
                  }}
                >
                  {t('common.remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
