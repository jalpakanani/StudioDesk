import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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
  const { signIn, signUp, setAuthError, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLocalErr('');
    setAuthError('');
    if (!email.trim() || !password) {
      setLocalErr('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setLocalErr('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setLocalErr('Wrong email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setLocalErr('That email is already registered. Sign in instead.');
      } else if (code === 'auth/weak-password') {
        setLocalErr('Password is too weak.');
      } else if (code === 'auth/invalid-email') {
        setLocalErr('Invalid email address.');
      } else {
        setLocalErr(err?.message || 'Something went wrong.');
      }
    } finally {
      setBusy(false);
    }
  }

  const err = localErr || authError;

  return (
    <div className="login-screen">
      <div className="login-card" role="main">
        <header className="login-header">
          <span className="login-logo" aria-hidden="true">
            S
          </span>
          <div className="login-header-text">
            <h1 className="login-title">My Studio Desk</h1>
            <p className="login-subtitle">Sign in once—your desk follows you on every device.</p>
          </div>
        </header>

        <div className="login-seg" role="tablist" aria-label="Account">
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
            }}
          >
            Sign in
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
            }}
          >
            New account
          </button>
        </div>

        <form className="login-form" onSubmit={submit} noValidate>
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password-row">
              <input
                id="login-password"
                className="login-input login-input--password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder={mode === 'signin' ? '••••••••' : 'At least 6 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {err ? (
            <div className="login-alert" role="alert">
              {err}
            </div>
          ) : null}

          <button type="submit" className="login-submit btn primary shine" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
