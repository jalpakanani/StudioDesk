import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StudioProvider, useStudio } from './context/StudioContext';
import { TabProvider, useTab } from './context/TabContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { useReminderNotifications } from './hooks/useReminderNotifications';
import './App.css';
import Dashboard from './components/Dashboard';
import ClientsView from './components/ClientsView';
import OrdersView from './components/OrdersView';
import FieldVisitsView from './components/FieldVisitsView';
import SettingsView from './components/SettingsView';
import BackupBar from './components/BackupBar';
import GlobalSearch from './components/GlobalSearch';
import LoginScreen from './components/LoginScreen';
import { useStudioDisplayName } from './hooks/useStudioDisplayName';

function ReminderRunner() {
  const { orders, fieldVisits, clientById } = useStudio();
  useReminderNotifications(orders, fieldVisits, clientById);
  return null;
}

function Shell() {
  const { t } = useTranslation();
  const studioName = useStudioDisplayName();
  const { tab, setTab } = useTab();
  const auth = useAuth();
  const { studioReady, actionBusy } = useStudio();

  const tabs = useMemo(
    () => [
      { id: 'dash', label: t('tabs.dash'), icon: '◇' },
      { id: 'clients', label: t('tabs.clients'), icon: '◎' },
      { id: 'orders', label: t('tabs.orders'), icon: '▤' },
      { id: 'field', label: t('tabs.field'), icon: '⌖' },
      { id: 'settings', label: t('tabs.settings'), icon: '⚙' },
    ],
    [t],
  );

  if (auth.firebaseEnabled && auth.user && !studioReady) {
    return (
      <div className="app-shell">
        <div className="app-bg" aria-hidden="true" />
        <div className="app-loading">
          <p>{t('app.syncing')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ReminderRunner />
      <div className="app-bg" aria-hidden="true" />
      <header className="app-header">
        <div className="header-inner">
          <div className="header-top">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                <svg
                  className="brand-mark-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  focusable="false"
                >
                  <path
                    d="M12 4l7.2 7.2L12 18.4 4.8 11.2 12 4z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h1>{studioName || t('app.brand')}</h1>
                <p className="tagline">{t('app.tagline')}</p>
              </div>
            </div>
            <div className="header-tools">
              <GlobalSearch />
            </div>
            {auth.firebaseEnabled && auth.user ? (
              <div className="header-auth">
                <span className="header-auth-email muted small" title={auth.user.email || ''}>
                  {auth.user.email}
                </span>
                <button type="button" className="btn small" onClick={() => auth.logOut()}>
                  {t('app.signOut')}
                </button>
              </div>
            ) : null}
          </div>
          <nav className="tabs" aria-label={t('app.navMain')}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tab ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                <span className="tab-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div key={tab} className="panel panel-enter">
          {tab === 'dash' && <Dashboard />}
          {tab === 'clients' && <ClientsView />}
          {tab === 'orders' && <OrdersView />}
          {tab === 'field' && <FieldVisitsView />}
          {tab === 'settings' && <SettingsView />}
        </div>
      </main>

      <BackupBar />

      {actionBusy ? (
        <div
          className="app-action-busy"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="app-action-busy__inner">
            <div className="app-action-busy__spinner" aria-hidden="true" />
            <p>{t('app.saving')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppGate() {
  const { t } = useTranslation();
  const auth = useAuth();

  if (auth.firebaseEnabled && auth.loading) {
    return (
      <div className="app-shell">
        <div className="app-bg" aria-hidden="true" />
        <div className="app-loading">
          <p>{t('app.loading')}</p>
        </div>
      </div>
    );
  }

  if (auth.firebaseEnabled && !auth.user) {
    return (
      <div className="app-shell app-shell--login">
        <div className="app-bg" aria-hidden="true" />
        <LoginScreen />
      </div>
    );
  }

  if (!auth.firebaseEnabled) {
    return (
      <StudioProvider useCloud={false} syncUserId={null}>
        <TabProvider>
          <ConfirmProvider>
            <Shell />
          </ConfirmProvider>
        </TabProvider>
      </StudioProvider>
    );
  }

  return (
    <StudioProvider useCloud syncUserId={auth.user.uid}>
      <TabProvider>
        <ConfirmProvider>
          <Shell />
        </ConfirmProvider>
      </TabProvider>
    </StudioProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
