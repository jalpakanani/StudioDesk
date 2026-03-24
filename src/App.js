import { AuthProvider, useAuth } from './context/AuthContext';
import { StudioProvider, useStudio } from './context/StudioContext';
import { TabProvider, useTab } from './context/TabContext';
import './App.css';
import Dashboard from './components/Dashboard';
import ClientsView from './components/ClientsView';
import OrdersView from './components/OrdersView';
import FieldVisitsView from './components/FieldVisitsView';
import BackupBar from './components/BackupBar';
import LoginScreen from './components/LoginScreen';

const TABS = [
  { id: 'dash', label: 'Dashboard', icon: '◇' },
  { id: 'clients', label: 'Clients', icon: '◎' },
  { id: 'orders', label: 'Orders', icon: '▤' },
  { id: 'field', label: 'My Exposing', icon: '⌖' },
];

function Shell() {
  const { tab, setTab } = useTab();
  const auth = useAuth();
  const { studioReady } = useStudio();

  if (auth.firebaseEnabled && auth.user && !studioReady) {
    return (
      <div className="app-shell">
        <div className="app-bg" aria-hidden="true" />
        <div className="app-loading">
          <p>Syncing your desk…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-bg" aria-hidden="true" />
      <header className="app-header">
        <div className="header-inner">
          <div className="header-top">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                S
              </span>
              <div>
                <h1>My Studio Desk</h1>
                <p className="tagline">Orders &amp; payments · My Exposing &amp; collections</p>
              </div>
            </div>
            {auth.firebaseEnabled && auth.user ? (
              <div className="header-auth">
                <span className="header-auth-email muted small" title={auth.user.email || ''}>
                  {auth.user.email}
                </span>
                <button type="button" className="btn small" onClick={() => auth.logOut()}>
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
          <nav className="tabs" aria-label="Main navigation">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span>{t.label}</span>
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
        </div>
      </main>

      <BackupBar />
    </div>
  );
}

function AppGate() {
  const auth = useAuth();

  if (auth.firebaseEnabled && auth.loading) {
    return (
      <div className="app-shell">
        <div className="app-bg" aria-hidden="true" />
        <div className="app-loading">
          <p>Loading…</p>
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
          <Shell />
        </TabProvider>
      </StudioProvider>
    );
  }

  return (
    <StudioProvider useCloud syncUserId={auth.user.uid}>
      <TabProvider>
        <Shell />
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
