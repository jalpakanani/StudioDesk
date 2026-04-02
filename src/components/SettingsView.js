import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';
import { DESK_ALERTS_ENABLED_KEY } from '../hooks/useReminderNotifications';
import { readStudioDisplayName, writeStudioDisplayName } from '../utils/studioDisplayName';

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
  const { t, i18n } = useTranslation();
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [permission, setPermission] = useState('default');
  const [studioNameDraft, setStudioNameDraft] = useState('');
  const unsupported = permission === 'unsupported';

  useEffect(() => {
    setAlertsEnabled(readEnabled());
    setPermission(browserNotifState());
    setStudioNameDraft(readStudioDisplayName());
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
      const brand = readStudioDisplayName() || t('app.brand');
      new Notification(`${brand} — ${t('settings.testNotificationSuffix')}`, {
        body: t('settings.testBody'),
        tag: 'desk-test',
      });
    } catch {
      /* ignore */
    }
  }

  function saveStudioName() {
    writeStudioDisplayName(studioNameDraft);
  }

  return (
    <>
      <section className="card card-lift dash-card card-wide">
        <div className="dash-card-head">
          <h3>{t('settings.title')}</h3>
          <p className="dash-card-subtitle">{t('settings.intro')}</p>
        </div>

        <div className="dash-feed-item dash-feed-item--client" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: '1 1 200px' }}>
            <div className="dash-feed-title">{t('settings.studioNameTitle')}</div>
            <div className="muted small">{t('settings.studioNameHint')}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: '1 1 280px' }}>
            <input
              type="text"
              className="login-input"
              style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%' }}
              value={studioNameDraft}
              onChange={(e) => setStudioNameDraft(e.target.value)}
              placeholder={t('settings.studioNamePlaceholder')}
              maxLength={120}
              autoComplete="organization"
            />
            <button type="button" className="btn primary btn-sm shine" onClick={saveStudioName}>
              {t('settings.studioNameSave')}
            </button>
          </div>
        </div>

        <div className="dash-feed-item dash-feed-item--client">
          <div>
            <div className="dash-feed-title">{t('language.label')}</div>
            <div className="muted small">{t('language.hint')}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn btn-sm ${i18n.language === 'en' ? 'primary' : ''}`}
              onClick={() => setAppLanguage('en')}
            >
              {t('language.english')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${i18n.language === 'gu' ? 'primary' : ''}`}
              onClick={() => setAppLanguage('gu')}
            >
              {t('language.gujarati')}
            </button>
          </div>
        </div>

        <div className="dash-feed-item dash-feed-item--client">
          <div>
            <div className="dash-feed-title">{t('settings.deskAlerts')}</div>
            <div className="muted small">{t('settings.deskAlertsHint')}</div>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={alertsEnabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span className="small">{alertsEnabled ? t('settings.on') : t('settings.off')}</span>
          </label>
        </div>

        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          {t('settings.browserPermission')} {unsupported ? t('settings.notSupported') : permission}
        </p>
        {permission === 'denied' ? (
          <p className="muted small" style={{ marginTop: '0.5rem' }}>
            {t('settings.deniedHint')}
          </p>
        ) : null}
        {!unsupported && permission === 'default' && alertsEnabled ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn primary btn-sm shine" onClick={() => requestBrowserPermission()}>
              {t('settings.allowNotif')}
            </button>
          </div>
        ) : null}
        {!unsupported && permission === 'granted' && alertsEnabled ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-sm" onClick={() => sendTestNotification()}>
              {t('settings.sendTest')}
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}
