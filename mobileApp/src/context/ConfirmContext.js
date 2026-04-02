import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius } from '../theme';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const finish = useCallback((result) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setDialog(null);
    if (resolve) resolve(result);
  }, []);

  const confirmAsync = useCallback((opts) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({
        title: opts.title || '',
        message: opts.message,
        confirmLabel: opts.confirmLabel,
        cancelLabel: opts.cancelLabel,
        danger: opts.danger !== false,
      });
    });
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish(false);
      return true;
    });
    return () => sub.remove();
  }, [dialog, finish]);

  const value = useMemo(() => ({ confirmAsync }), [confirmAsync]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        visible={dialog != null}
        transparent
        animationType="fade"
        onRequestClose={() => finish(false)}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => finish(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          {dialog ? (
            <View style={styles.card}>
              {dialog.title ? <Text style={styles.title}>{dialog.title}</Text> : null}
              <Text style={styles.message}>{dialog.message}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={() => finish(false)}
                  accessibilityRole="button"
                >
                  <Text style={styles.btnCancelText}>{dialog.cancelLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnConfirm, dialog.danger ? styles.btnConfirmDanger : styles.btnConfirmSafe]}
                  onPress={() => finish(true)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.btnConfirmText,
                      dialog.danger ? styles.btnConfirmTextDanger : styles.btnConfirmTextSafe,
                    ]}
                  >
                    {dialog.confirmLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside ConfirmProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    paddingHorizontal: 20,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btnCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSolid,
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.muted,
  },
  btnConfirm: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    minWidth: 100,
    alignItems: 'center',
  },
  btnConfirmSafe: {
    backgroundColor: colors.primary,
  },
  btnConfirmDanger: {
    backgroundColor: colors.danger,
  },
  btnConfirmText: {
    fontSize: 15,
    fontWeight: '700',
  },
  btnConfirmTextSafe: {
    color: '#fff',
  },
  btnConfirmTextDanger: {
    color: '#fff',
  },
});
