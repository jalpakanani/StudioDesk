import {useEffect, useMemo, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useStudio} from '../context/StudioContext'
import {useTab} from '../context/TabContext'
import {useConfirm} from '../context/ConfirmContext'
import {formatINR, sumPayments} from '../utils/money'
import {fieldVisitRange, formatDateRangeEn, formatISODateDisplay} from '../utils/dateRange'
import {groupedFieldVisitCardStats} from '../utils/settlement'

export default function FieldVisitsView() {
  const {t} = useTranslation()
  const {confirmAsync} = useConfirm()
  const {navFocus, clearNavFocus} = useTab()
  const {
    orders,
    fieldVisits,
    addFieldVisit,
    updateFieldVisit,
    removeFieldVisit,
    addFieldVisitCollection,
    removeFieldVisitCollection,
  } = useStudio()

  const [hostName, setHostName] = useState('')
  const [venue, setVenue] = useState('')
  const [dateFrom, setDateFrom] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [dateTo, setDateTo] = useState('')
  const [time, setTime] = useState('')
  const [amountToCollect, setAmountToCollect] = useState('')
  const [partyKey, setPartyKey] = useState('')
  const [notes, setNotes] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [eh, setEh] = useState('')
  const [ev, setEv] = useState('')
  const [edf, setEdf] = useState('')
  const [edt, setEdt] = useState('')
  const [et, setEt] = useState('')
  const [ea, setEa] = useState('')
  const [epk, setEpk] = useState('')
  const [en, setEn] = useState('')

  const sorted = useMemo(() => {
    return [...(fieldVisits || [])].sort((a, b) => {
      const ra = fieldVisitRange(a)
      const rb = fieldVisitRange(b)
      const c = ra.from.localeCompare(rb.from)
      if (c !== 0) return c
      return (a.time || '').localeCompare(b.time || '')
    })
  }, [fieldVisits])

  /** Visit totals per linked person + Orders → Pay them (same rules as dashboard Same-person net). */
  const cardStatsByVisitId = useMemo(
    () => groupedFieldVisitCardStats(fieldVisits, orders),
    [fieldVisits, orders],
  )

  useEffect(() => {
    if (!navFocus || navFocus.kind !== 'visit') return
    const id = navFocus.id
    const list = fieldVisits || []
    if (!list.some(v => v.id === id)) {
      clearNavFocus()
      return
    }
    clearNavFocus()
    requestAnimationFrame(() => {
      const el = document.getElementById(`desk-visit-${id}`)
      el?.scrollIntoView({behavior: 'smooth', block: 'nearest'})
      el?.classList.add('desk-flash')
      window.setTimeout(() => el?.classList.remove('desk-flash'), 2000)
    })
  }, [navFocus, fieldVisits, clearNavFocus])

  function submitNew(e) {
    e.preventDefault()
    const v = addFieldVisit({
      hostName,
      venue,
      dateFrom,
      dateTo: dateTo || dateFrom,
      time,
      amountToCollect,
      partyKey,
      notes,
    })
    if (v) {
      setHostName('')
      setVenue('')
      setTime('')
      setAmountToCollect('')
      setPartyKey('')
      setNotes('')
      const t = new Date().toISOString().slice(0, 10)
      setDateFrom(t)
      setDateTo('')
    }
  }

  function startEdit(v) {
    const {from, to} = fieldVisitRange(v)
    setEditingId(v.id)
    setEh(v.hostName)
    setEv(v.venue || '')
    setEdf(from)
    setEdt(from === to ? '' : to)
    setEt(v.time || '')
    setEa(String(v.amountToCollect ?? ''))
    setEpk(v.partyKey || '')
    setEn(v.notes || '')
  }

  function saveEdit(e) {
    e.preventDefault()
    if (!editingId) return
    updateFieldVisit(editingId, {
      hostName: eh,
      venue: ev,
      dateFrom: edf,
      dateTo: edt || edf,
      time: et,
      amountToCollect: ea,
      partyKey: epk,
      notes: en,
    })
    setEditingId(null)
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">{t('field.title')}</h2>
          <p className="panel-lead panel-lead--tight">{t('field.lead')}</p>
          <details className="panel-tip">
            <summary>{t('field.tipSummary')}</summary>
            <p
              className="muted small"
              style={{margin: '0.5rem 0 0', lineHeight: 1.5, maxWidth: '34rem'}}
            >
              {t('field.tipBody')}
            </p>
          </details>
        </div>
      </div>

      <div className="glass-panel">
        <h3 className="glass-panel-title">{t('field.addEntry')}</h3>
        <form
          className="form-grid"
          onSubmit={submitNew}
          style={{marginBottom: 0}}
        >
          <label>
            {t('field.labelHost')}
            <input
              placeholder={t('field.hostPlaceholder')}
              value={hostName}
              onChange={e => setHostName(e.target.value)}
              required
            />
          </label>
          <label>
            {t('field.labelVenue')}
            <input
              placeholder={t('field.venuePlaceholder')}
              value={venue}
              onChange={e => setVenue(e.target.value)}
            />
          </label>
          <label>
            {t('field.labelFrom')}
            <input
              type="date"
              lang="en-IN"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              required
            />
          </label>
          <label>
            {t('field.labelTo')}
            <input
              type="date"
              lang="en-IN"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              min={dateFrom || undefined}
            />
          </label>
          <label>
            {t('field.labelTime')}
            <input
              placeholder={t('field.timePlaceholder')}
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </label>
          <label>
            {t('field.labelAmount')}
            <input
              type="number"
              min="0"
              placeholder="0"
              value={amountToCollect}
              onChange={e => setAmountToCollect(e.target.value)}
              required
            />
          </label>
          <label>
            {t('field.labelMatch')}
            <input
              placeholder={t('field.matchPlaceholder')}
              value={partyKey}
              onChange={e => setPartyKey(e.target.value)}
            />
          </label>
          <label className="full">
            {t('common.notes')}
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('field.notesPlaceholder')}
            />
          </label>
          <div className="form-actions full">
            <button type="submit" className="btn primary shine">
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>

      <h3 className="subhead" style={{marginTop: '1.25rem'}}>
        {t('field.entries', {count: sorted.length})}
      </h3>

      {sorted.length === 0 ? (
        <div
          className="empty-detail"
          style={{
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
            marginTop: '0.5rem',
          }}
        >
          <div className="empty-detail-visual" aria-hidden="true">
            🚐
          </div>
          <p className="muted" style={{margin: 0, maxWidth: '320px'}}>
            {t('field.emptyText')}
          </p>
        </div>
      ) : (
        <ul className="visit-list">
          {sorted.map(v => {
            const oneDue = Math.max(
              0,
              (Number(v.amountToCollect) || 0) - sumPayments(v.collections),
            )
            const card = cardStatsByVisitId.get(v.id) || {
              totalToCollect: Number(v.amountToCollect) || 0,
              received: sumPayments(v.collections),
              due: oneDue,
              visitCount: 1,
              payToGuest: 0,
              net: oneDue,
            }
            const total = card.totalToCollect
            const received = card.received
            const due = card.due
            const {from, to} = fieldVisitRange(v)
            return (
              <li key={v.id} id={`desk-visit-${v.id}`} className="visit-card">
                {editingId === v.id ? (
                  <form className="form-grid tight" onSubmit={saveEdit}>
                    <label>
                      {t('field.labelHost')}
                      <input
                        value={eh}
                        onChange={e => setEh(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {t('field.labelVenueShort')}
                      <input value={ev} onChange={e => setEv(e.target.value)} />
                    </label>
                    <label>
                      {t('field.labelFrom')}
                      <input
                        type="date"
                        lang="en-IN"
                        value={edf}
                        onChange={e => setEdf(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {t('field.labelTo')}
                      <input
                        type="date"
                        lang="en-IN"
                        value={edt}
                        onChange={e => setEdt(e.target.value)}
                        min={edf || undefined}
                      />
                    </label>
                    <label>
                      {t('field.labelTime')}
                      <input value={et} onChange={e => setEt(e.target.value)} />
                    </label>
                    <label>
                      {t('field.labelAmount')}
                      <input
                        type="number"
                        min="0"
                        value={ea}
                        onChange={e => setEa(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {t('orders.matchKey')}
                      <input
                        placeholder={t('field.matchEditPlaceholder')}
                        value={epk}
                        onChange={e => setEpk(e.target.value)}
                      />
                    </label>
                    <label className="full">
                      {t('common.notes')}
                      <textarea
                        rows={2}
                        value={en}
                        onChange={e => setEn(e.target.value)}
                      />
                    </label>
                    <div className="form-actions full">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setEditingId(null)}
                      >
                        {t('common.cancel')}
                      </button>
                      <button type="submit" className="btn primary btn-sm">
                        {t('field.saveChanges')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="visit-card-top">
                      <div className="visit-card-meta">
                        <div className="visit-when">
                          <strong>{formatDateRangeEn(from, to)}</strong>
                          {v.time ? (
                            <span className="muted"> · {v.time}</span>
                          ) : null}
                        </div>
                        <div className="visit-host">{t('field.atWith', {name: v.hostName})}</div>
                        {v.partyKey ? (
                          <div className="muted small">
                            {t('orders.matchKeyLabel')} {v.partyKey}
                          </div>
                        ) : null}
                        {v.venue ? (
                          <div className="muted small">{v.venue}</div>
                        ) : null}
                        {v.notes ? (
                          <div className="visit-notes">{v.notes}</div>
                        ) : null}
                      </div>
                      <div
                        className="visit-money visit-money--tiles"
                        aria-label={t('field.amountsAria')}
                      >
                        {card.visitCount > 1 ? (
                          <p className="visit-money-combine-note muted small">
                            {t('field.combineNote', {count: card.visitCount})}
                          </p>
                        ) : null}
                        <div className="visit-money-tiles">
                          <div className="visit-money-tile">
                            <span className="visit-money-tile-label">
                              {t('field.toCollect')}
                            </span>
                            <strong className="visit-money-tile-value">
                              {formatINR(total)}
                            </strong>
                          </div>
                          <div className="visit-money-tile">
                            <span className="visit-money-tile-label">
                              {t('field.received')}
                            </span>
                            <span className="visit-money-tile-value">
                              {formatINR(received)}
                            </span>
                          </div>
                          <div
                            className={`visit-money-tile visit-money-tile--due${due > 0 ? ' is-warn' : ''}`}
                          >
                            <span className="visit-money-tile-label">
                              {t('field.stillDue')}
                            </span>
                            <strong
                              className={`visit-money-tile-value ${due > 0 ? 'warn' : 'ok'}`}
                            >
                              {formatINR(Math.max(0, due))}
                            </strong>
                          </div>
                          {card.payToGuest > 0 ? (
                            <>
                              <div className="visit-money-tile">
                                <span className="visit-money-tile-label">
                                  {t('field.payOnOrder')}
                                </span>
                                <span className="visit-money-tile-value">
                                  {formatINR(card.payToGuest)}
                                </span>
                              </div>
                              <div
                                className={`visit-money-tile visit-money-tile--net${
                                  card.net > 0
                                    ? ' is-warn'
                                    : card.net < 0
                                      ? ' is-owe'
                                      : ' is-even'
                                }`}
                              >
                                <span className="visit-money-tile-label">
                                  {t('field.net')}
                                </span>
                                <strong
                                  className={`visit-money-tile-value ${
                                    card.net > 0
                                      ? 'warn'
                                      : card.net < 0
                                        ? 'visit-net-owe'
                                        : 'ok'
                                  }`}
                                >
                                  {card.net > 0
                                    ? t('field.collectAmt', {amt: formatINR(card.net)})
                                    : card.net < 0
                                      ? t('field.payAmt', {amt: formatINR(-card.net)})
                                      : t('field.even')}
                                </strong>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <VisitCollections
                      visitId={v.id}
                      collections={v.collections}
                      addFieldVisitCollection={addFieldVisitCollection}
                      removeFieldVisitCollection={removeFieldVisitCollection}
                      confirmAsync={confirmAsync}
                    />

                    <div className="visit-card-actions">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => startEdit(v)}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirmAsync({
                              title: t('field.confirmDeleteTitle'),
                              message: t('field.removeConfirm', {name: v.hostName}),
                              confirmLabel: t('common.delete'),
                              cancelLabel: t('common.cancel'),
                            })
                            if (ok) removeFieldVisit(v.id)
                          })()
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function VisitCollections({
  visitId,
  collections,
  addFieldVisitCollection,
  removeFieldVisitCollection,
  confirmAsync,
}) {
  const {t} = useTranslation()
  const [amt, setAmt] = useState('')
  const [dt, setDt] = useState(() => new Date().toISOString().slice(0, 10))
  const [nt, setNt] = useState('')

  function add(e) {
    e.preventDefault()
    addFieldVisitCollection(visitId, {amount: amt, date: dt, note: nt})
    setAmt('')
    setNt('')
  }

  return (
    <div className="visit-collections">
      <strong className="visit-collections-title">
        {t('field.collectionsTitle')}
      </strong>
      <form className="form-row tight" onSubmit={add}>
        <input
          type="number"
          min="0"
          placeholder={t('field.amountInr')}
          value={amt}
          onChange={e => setAmt(e.target.value)}
          required
        />
        <input type="date" lang="en-IN" value={dt} onChange={e => setDt(e.target.value)} />
        <input
          placeholder={t('orders.payNote')}
          value={nt}
          onChange={e => setNt(e.target.value)}
        />
        <button type="submit" className="btn small primary">
          {t('field.logReceipt')}
        </button>
      </form>
      {(collections || []).length > 0 ? (
        <ul className="mini-table">
          {(collections || []).map(p => (
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
                      title: t('field.confirmRemoveCollectionTitle'),
                      message: t('field.removeCollectionConfirm', {
                        amount: formatINR(p.amount),
                        date: formatISODateDisplay(p.date),
                      }),
                      confirmLabel: t('common.remove'),
                      cancelLabel: t('common.cancel'),
                    })
                    if (ok) removeFieldVisitCollection(visitId, p.id)
                  })()
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small" style={{margin: '0.35rem 0 0'}}>
          {t('field.noPayments')}
        </p>
      )}
    </div>
  )
}
