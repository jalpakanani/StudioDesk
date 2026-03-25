import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors, radius } from '../theme';

export default function LoginScreen() {
  const { signIn, signUp, sendPasswordReset, setAuthError, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function submit() {
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

  async function onForgot() {
    setLocalErr('');
    setAuthError('');
    setResetSent(false);
    if (!email.trim()) {
      setLocalErr('Enter your email first.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err) {
      setLocalErr(err?.message || 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  }

  const err = localErr || authError;

  return (
    <SafeAreaView style={styles.safeOuter} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>My Studio Desk</Text>
        <Text style={styles.tag}>Orders & payments · My Exposing</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}
          {resetSent ? <Text style={styles.ok}>Password reset email sent.</Text> : null}

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setLocalErr('');
              setAuthError('');
            }}
          >
            <Text style={styles.linkText}>
              {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.link} onPress={onForgot} disabled={busy}>
            <Text style={styles.linkText}>Forgot password</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeOuter: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
  tag: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: 28, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.loginCardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#2d235a',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    marginBottom: 14,
    fontSize: 16,
  },
  err: {
    color: '#9a3412',
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(254, 215, 170, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.25)',
    overflow: 'hidden',
  },
  ok: {
    color: '#14532d',
    marginBottom: 12,
    fontSize: 14,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.alertSuccessBg,
    borderWidth: 1,
    borderColor: colors.alertSuccessBorder,
    overflow: 'hidden',
  },
  btn: { borderRadius: radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
