import { useEffect, useState } from 'react';
import { DESK_ALERTS_ENABLED_KEY } from '../hooks/useReminderNotifications';

function readEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(DESK_ALERTS_ENABLED_KEY);
    if (raw == null) return true;
    return raw !== '0';
  } catch {
    return true;
  }
}

function browserNotifState() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function notifyDeskAlertsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('desk-alerts-changed'));
}

export default function SettingsView() {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [permission, setPermission] = useState('default');
  const unsupported = permission === 'unsupported';

  useEffect(() => {
    setAlertsEnabled(readEnabled());
    setPermission(browserNotifState());
  }, []);

  async function onToggle(next) {
    setAlertsEnabled(next);
    try {
      window.localStorage.setItem(DESK_ALERTS_ENABLED_KEY, next ? '1' : '0');
    } catch {
      /* keep UI responsive even if storage is blocked */
    }
    notifyDeskAlertsChanged();
    if (!next || unsupported) return;
    if (Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
      } catch {
        setPermission(browserNotifState());
      }
      notifyDeskAlertsChanged();
      return;
    }
    setPermission(browserNotifState());
  }

  async function requestBrowserPermission() {
    if (unsupported || Notification.permission !== 'default') return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
    } catch {
      setPermission(browserNotifState());
    }
    notifyDeskAlertsChanged();
  }

  function sendTestNotification() {
    if (unsupported || Notification.permission !== 'granted' || !alertsEnabled) return;
    try {
      new Notification('My Studio Desk — test', {
        body: 'If you see this, browser alerts are working. Real alerts only when you have tomorrow jobs / visits or payment-due orders.',
        tag: 'desk-test',
      });
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <section className="card card-lift dash-card card-wide">
        <div className="dash-card-head">
          <h3>Settings</h3>
          <p className="dash-card-subtitle">
            Desk alerts run in this tab when the browser allows notifications. They fire for tomorrow&apos;s jobs or
            visits and for past-event payment due—not on a fixed schedule every minute.
          </p>
        </div>

        <div className="dash-feed-item dash-feed-item--client">
          <div>
            <div className="dash-feed-title">Desk alerts</div>
            <div className="muted small">
              Store preference on this device. You still need browser permission below.
            </div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={alertsEnabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span className="small">{alertsEnabled ? 'On' : 'Off'}</span>
          </label>
        </div>

        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          Browser permission: {unsupported ? 'Not supported' : permission}
        </p>
        {permission === 'denied' ? (
          <p className="muted small" style={{ marginTop: '0.5rem' }}>
            Notifications blocked by browser. Allow this site from browser settings (lock icon or site settings), then
            reload.
          </p>
        ) : null}
        {!unsupported && permission === 'default' && alertsEnabled ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn primary btn-sm shine" onClick={() => requestBrowserPermission()}>
              Allow browser notifications
            </button>
          </div>
        ) : null}
        {!unsupported && permission === 'granted' && alertsEnabled ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-sm" onClick={() => sendTestNotification()}>
              Send test notification
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
