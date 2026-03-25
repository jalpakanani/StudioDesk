import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase/init';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from '@firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const firebaseOn = isFirebaseConfigured();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseOn);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!firebaseOn) {
      setLoading(false);
      return undefined;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, [firebaseOn]);

  const signIn = useCallback(async (email, password) => {
    setAuthError('');
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase not configured');
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUp = useCallback(async (email, password) => {
    setAuthError('');
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase not configured');
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const logOut = useCallback(async () => {
    setAuthError('');
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  }, []);

  const sendPasswordReset = useCallback(async (email) => {
    setAuthError('');
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase not configured');
    const trimmed = email.trim();
    if (!trimmed) throw new Error('Email required');
    await sendPasswordResetEmail(auth, trimmed);
  }, []);

  const value = useMemo(
    () => ({
      firebaseEnabled: firebaseOn,
      user,
      loading,
      authError,
      setAuthError,
      signIn,
      signUp,
      sendPasswordReset,
      logOut,
    }),
    [firebaseOn, user, loading, authError, signIn, signUp, sendPasswordReset, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
