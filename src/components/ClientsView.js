import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudio } from '../context/StudioContext';
import { useTab } from '../context/TabContext';
import { useConfirm } from '../context/ConfirmContext';

export default function ClientsView() {
  const { t } = useTranslation();
  const { confirmAsync } = useConfirm();
  const { clients, addClient, updateClient, removeClient } = useStudio();
  const { setTab, navFocus, clearNavFocus } = useTab();
  const nameRef = useRef(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (!navFocus || navFocus.kind !== 'client') return;
    const id = navFocus.id;
    if (!clients.some((c) => c.id === id)) {
      clearNavFocus();
      return;
    }
    clearNavFocus();
    requestAnimationFrame(() => {
      const el = document.getElementById(`desk-client-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el?.classList.add('desk-flash');
      window.setTimeout(() => el?.classList.remove('desk-flash'), 2000);
    });
  }, [navFocus, clients, clearNavFocus]);

  function submitNew(e) {
    e.preventDefault();
    const c = addClient({ name, phone, notes });
    if (c) {
      setName('');
      setPhone('');
      setNotes('');
    }
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone || '');
    setEditNotes(c.notes || '');
  }

  function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    updateClient(editingId, { name: editName, phone: editPhone, notes: editNotes });
    setEditingId(null);
  }

  function focusForm() {
    nameRef.current?.focus();
    nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">{t('clients.title')}</h2>
          <p className="panel-lead">{t('clients.lead')}</p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div
          className="empty-spotlight"
          role="button"
          tabIndex={0}
          onClick={focusForm}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              focusForm();
            }
          }}
        >
          <div className="empty-spotlight-icon" aria-hidden="true">
            👋
          </div>
          <h3>{t('clients.emptyTitle')}</h3>
          <p>{t('clients.emptyText')}</p>
        </div>
      ) : null}

      <div className="glass-panel">
        <h3 className="glass-panel-title">{t('clients.quickAdd')}</h3>
        <form className="form-row" onSubmit={submitNew}>
          <input
            ref={nameRef}
            placeholder={t('clients.placeholderName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input placeholder={t('clients.placeholderPhone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input placeholder={t('clients.placeholderNotes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="submit" className="btn primary shine">
            {t('clients.addClient')}
          </button>
        </form>
      </div>

      {clients.length > 0 ? (
        <section className="glass-panel clients-roster-panel">
          <div className="clients-roster-head">
            <div>
              <h3 className="glass-panel-title clients-roster-title">{t('clients.savedTitle')}</h3>
              <p className="clients-roster-lead muted small">
                {t('clients.rosterLead', { count: clients.length })}
              </p>
            </div>
            <button
              type="button"
              className="btn primary btn-sm shine clients-roster-cta"
              onClick={() => setTab('orders')}
            >
              {t('clients.newOrder')}
            </button>
          </div>
          <ul className="table-list clients-roster-list">
            {clients.map((c) => (
              <li key={c.id} id={`desk-client-${c.id}`}>
                {editingId === c.id ? (
                  <form className="inline-edit" onSubmit={saveEdit}>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                    <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    <button type="submit" className="btn small primary">
                      {t('common.save')}
                    </button>
                    <button type="button" className="btn small" onClick={() => setEditingId(null)}>
                      {t('common.cancel')}
                    </button>
                  </form>
                ) : (
                  <div className="table-row">
                    <div>
                      <strong>{c.name}</strong>
                      {c.phone ? <span className="muted"> · {c.phone}</span> : null}
                      {c.notes ? <div className="muted small">{c.notes}</div> : null}
                    </div>
                    <div className="row-actions">
                      <button type="button" className="btn small" onClick={() => startEdit(c)}>
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => {
                          void (async () => {
                            const ok = await confirmAsync({
                              title: t('clients.confirmDeleteTitle'),
                              message: t('clients.deleteConfirm', { name: c.name }),
                              confirmLabel: t('common.delete'),
                              cancelLabel: t('common.cancel'),
                            });
                            if (ok) removeClient(c.id);
                          })();
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ul className="table-list">
          <li className="muted">{t('clients.rosterPlaceholder')}</li>
        </ul>
      )}
    </div>
  );
}
