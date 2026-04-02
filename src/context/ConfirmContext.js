import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ConfirmContext = createContext(null);

/**
 * @typedef {{ title?: string, message: string, confirmLabel: string, cancelLabel: string, danger?: boolean }} ConfirmOptions
 */

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);
  const confirmButtonRef = useRef(null);

  const finish = useCallback((result) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setDialog(null);
    if (resolve) resolve(result);
  }, []);

  /** @returns {Promise<boolean>} */
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
    const t = window.setTimeout(() => confirmButtonRef.current?.focus(), 50);
    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [dialog, finish]);

  const value = useMemo(() => ({ confirmAsync }), [confirmAsync]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {dialog ? (
        <div
          className="confirm-dialog-backdrop"
          role="presentation"
          onClick={() => finish(false)}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={dialog.title ? 'confirm-dialog-title' : 'confirm-dialog-message'}
            aria-describedby={dialog.title ? 'confirm-dialog-message' : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {dialog.title ? (
              <h2 id="confirm-dialog-title" className="confirm-dialog__title">
                {dialog.title}
              </h2>
            ) : null}
            <p id="confirm-dialog-message" className="confirm-dialog__message">
              {dialog.message}
            </p>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn" onClick={() => finish(false)}>
                {dialog.cancelLabel}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={`btn primary btn-sm${dialog.danger ? ' confirm-dialog__confirm--danger' : ''}`}
                onClick={() => finish(true)}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
