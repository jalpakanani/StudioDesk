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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { setAppLanguage } from '../i18n';
import { colors, radius } from '../theme';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { signIn, signUp, sendPasswordReset, setAuthError, authError } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit() {
    setLocalErr('');
    setAuthError('');
    if (!email.trim() || !password) {
      setLocalErr(t('errRequired'));
      return;
    }
    if (password.length < 6) {
      setLocalErr(t('errPasswordShort'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (e) {
      const code = e?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setLocalErr(t('errWrongCredentials'));
      } else if (code === 'auth/email-already-in-use') {
        setLocalErr(t('errEmailInUse'));
      } else if (code === 'auth/weak-password') {
        setLocalErr(t('errWeakPassword'));
      } else if (code === 'auth/invalid-email') {
        setLocalErr(t('errInvalidEmail'));
      } else {
        setLocalErr(e?.message || t('errGeneric'));
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
      setLocalErr(t('errEnterEmailFirst'));
      return;
    }
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (e) {
      setLocalErr(e?.message || t('errResetFailed'));
    } finally {
      setBusy(false);
    }
  }

  const err = localErr || authError;

  return (
    <SafeAreaView
      style={styles.safeOuter}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[
                styles.langChip,
                i18n.language === 'en' && styles.langChipActive,
              ]}
              onPress={() => setAppLanguage('en')}
              accessibilityRole="button"
              accessibilityLabel={t('languageEnglish')}
            >
              <Text
                style={[
                  styles.langChipText,
                  i18n.language === 'en' && styles.langChipTextActive,
                ]}
              >
                {t('languageEnglish')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.langChip,
                i18n.language === 'gu' && styles.langChipActive,
              ]}
              onPress={() => setAppLanguage('gu')}
              accessibilityRole="button"
              accessibilityLabel={t('languageGujarati')}
            >
              <Text
                style={[
                  styles.langChipText,
                  i18n.language === 'gu' && styles.langChipTextActive,
                ]}
              >
                {t('languageGujarati')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.brand}>{t('brand')}</Text>
          <Text style={styles.tag}>{t('tag')}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              placeholder={t('placeholderEmail')}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>{t('password')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.inputPassword}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder={
                  mode === 'signin'
                    ? t('placeholderPasswordSignin')
                    : t('placeholderPasswordSignup')
                }
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? t('a11yHidePassword') : t('a11yShowPassword')
                }
              >
                <Text style={styles.eyeBtnText}>
                  {showPassword ? t('hidePassword') : t('showPassword')}
                </Text>
              </TouchableOpacity>
            </View>

            {err ? <Text style={styles.err}>{err}</Text> : null}
            {resetSent ? (
              <Text style={styles.ok}>{t('resetSent')}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={submit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {mode === 'signin' ? t('signIn') : t('createAccount')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.link}
              onPress={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setShowPassword(false);
                setLocalErr('');
                setAuthError('');
              }}
            >
              <Text style={styles.linkText}>
                {mode === 'signin' ? t('needAccount') : t('haveAccount')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.link}
              onPress={onForgot}
              disabled={busy}
            >
              <Text style={styles.linkText}>{t('forgotPassword')}</Text>
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
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 120,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  langChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBg,
  },
  langChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  langChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  langChipTextActive: {
    color: colors.primary,
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tag: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
    lineHeight: 20,
  },
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  inputPassword: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  eyeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
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
  btn: {
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
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
