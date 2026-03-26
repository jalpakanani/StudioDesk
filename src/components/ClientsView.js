import { useEffect, useRef, useState } from 'react';
import { useStudio } from '../context/StudioContext';
import { useTab } from '../context/TabContext';

export default function ClientsView() {
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
          <h2 className="panel-title">Clients</h2>
          <p className="panel-lead">People you shoot for—used on every order and payment line.</p>
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
          <h3>Add your first client</h3>
          <p>Tap here or fill the form below—takes a few seconds.</p>
        </div>
      ) : null}

      <div className="glass-panel">
        <h3 className="glass-panel-title">Quick add</h3>
        <form className="form-row" onSubmit={submitNew}>
          <input
            ref={nameRef}
            placeholder="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="submit" className="btn primary shine">
            Add client
          </button>
        </form>
      </div>

      {clients.length > 0 ? (
        <section className="glass-panel clients-roster-panel">
          <div className="clients-roster-head">
            <div>
              <h3 className="glass-panel-title clients-roster-title">Saved clients</h3>
              <p className="clients-roster-lead muted small">
                {clients.length} on file — used when you book orders and log payments.
              </p>
            </div>
            <button
              type="button"
              className="btn primary btn-sm shine clients-roster-cta"
              onClick={() => setTab('orders')}
            >
              New order
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
                      Save
                    </button>
                    <button type="button" className="btn small" onClick={() => setEditingId(null)}>
                      Cancel
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
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete ${c.name}? All orders linked to this client will be removed.`
                            )
                          )
                            removeClient(c.id);
                        }}
                      >
                        Delete
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
          <li className="muted">Your roster will show up here.</li>
        </ul>
      )}
    </div>
  );
}
