import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { setAppLanguage } from '../i18n';
import { useStudioDisplayName } from '../hooks/useStudioDisplayName';

function IconEye({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconEyeOff({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
      />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M1 1l22 22" />
    </svg>
  );
}

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const studioName = useStudioDisplayName();
  const { signIn, signUp, sendPasswordReset, setAuthError, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetErr, setResetErr] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLocalErr('');
    setAuthError('');
    if (!email.trim() || !password) {
      setLocalErr(t('login.errRequired'));
      return;
    }
    if (password.length < 6) {
      setLocalErr(t('login.errPasswordShort'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setLocalErr(t('login.errWrongCredentials'));
      } else if (code === 'auth/email-already-in-use') {
        setLocalErr(t('login.errEmailInUse'));
      } else if (code === 'auth/weak-password') {
        setLocalErr(t('login.errWeakPassword'));
      } else if (code === 'auth/invalid-email') {
        setLocalErr(t('login.errInvalidEmail'));
      } else {
        setLocalErr(err?.message || t('login.errGeneric'));
      }
    } finally {
      setBusy(false);
    }
  }

  const err = localErr || authError;

  async function handlePasswordReset(e) {
    e.preventDefault();
    setResetErr('');
    setAuthError('');
    if (!email.trim()) {
      setResetErr(t('login.errEnterEmailFirst'));
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (errReset) {
      const code = errReset?.code || '';
      if (code === 'auth/invalid-email') {
        setResetErr(t('login.errInvalidEmail'));
      } else if (code === 'auth/user-not-found') {
        setResetErr(t('login.errUserNotFound'));
      } else if (code === 'auth/too-many-requests') {
        setResetErr(t('login.errTooManyRequests'));
      } else {
        setResetErr(errReset?.message || t('login.errResetFailed'));
      }
    } finally {
      setResetBusy(false);
    }
  }

  function closeForgot() {
    setForgotOpen(false);
    setResetSent(false);
    setResetErr('');
  }

  return (
    <div className="login-screen">
      <div className="login-card" role="main">
        <div className="login-lang-row" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
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
        <header className="login-header">
          <span className="login-logo" aria-hidden="true">
            S
          </span>
          <div className="login-header-text">
            <h1 className="login-title">{studioName || t('login.title')}</h1>
            <p className="login-subtitle">{t('login.subtitle')}</p>
          </div>
        </header>

        <div className="login-seg" role="tablist" aria-label={t('login.accountTabs')}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`login-seg-btn ${mode === 'signin' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('signin');
              setShowPassword(false);
              setLocalErr('');
              setAuthError('');
              closeForgot();
            }}
          >
            {t('login.signIn')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`login-seg-btn ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('signup');
              setShowPassword(false);
              setLocalErr('');
              setAuthError('');
              closeForgot();
            }}
          >
            {t('login.newAccount')}
          </button>
        </div>

        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-field">
            <label htmlFor="login-email">{t('login.email')}</label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              autoComplete="email"
              placeholder={t('login.placeholderEmail')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">{t('login.password')}</label>
            <div className="login-password-row">
              <input
                id="login-password"
                className="login-input login-input--password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signin' ? t('login.placeholderPasswordSignin') : t('login.placeholderPasswordSignup')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                aria-pressed={showPassword}
                title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {mode === 'signin' ? (
              <div className="login-forgot-row">
                <button
                  type="button"
                  className="login-forgot-link"
                  onClick={() => {
                    setForgotOpen((v) => !v);
                    setResetSent(false);
                    setResetErr('');
                    setAuthError('');
                  }}
                  aria-expanded={forgotOpen}
                >
                  {forgotOpen ? t('login.forgotToggleHide') : t('login.forgotToggle')}
                </button>
              </div>
            ) : null}
          </div>

          {mode === 'signin' && forgotOpen ? (
            <div className="login-forgot-panel">
              {resetSent ? (
                <div className="login-alert login-alert--success" role="status">
                  {t('login.resetSuccess', { email: email.trim() })}
                </div>
              ) : (
                <>
                  <p className="login-forgot-hint muted small">{t('login.resetHint')}</p>
                  {resetErr ? (
                    <div className="login-alert" role="alert">
                      {resetErr}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="btn login-forgot-send"
                    disabled={resetBusy}
                    onClick={handlePasswordReset}
                  >
                    {resetBusy ? t('login.resetSending') : t('login.resetSend')}
                  </button>
                </>
              )}
              <button type="button" className="login-forgot-back muted small" onClick={closeForgot}>
                {resetSent ? t('login.resetBack') : t('login.resetCancel')}
              </button>
            </div>
          ) : null}

          {err ? (
            <div className="login-alert" role="alert">
              {err}
            </div>
          ) : null}

          <button type="submit" className="login-submit btn primary shine" disabled={busy}>
            {busy ? t('login.submitWait') : mode === 'signin' ? t('login.signIn') : t('login.createAccount')}
          </button>
        </form>
      </div>
    </div>
  );
}
