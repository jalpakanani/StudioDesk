import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../firebase/init';

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

  const value = useMemo(
    () => ({
      firebaseEnabled: firebaseOn,
      user,
      loading,
      authError,
      setAuthError,
      signIn,
      signUp,
      logOut,
    }),
    [firebaseOn, user, loading, authError, signIn, signUp, logOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
