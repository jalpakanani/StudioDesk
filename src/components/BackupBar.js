import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudio } from '../context/StudioContext';

export default function BackupBar() {
  const { t } = useTranslation();
  const { exportJson, importJson, cloudSync, syncError } = useStudio();
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  function download() {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studio-desk-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(t('backup.downloadStarted'));
    setTimeout(() => setMsg(''), 2500);
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJson(String(reader.result));
        setMsg(t('backup.importOk'));
      } catch {
        setMsg(t('backup.invalidFile'));
      }
      setTimeout(() => setMsg(''), 3000);
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  const syncErrorBanner = cloudSync && syncError && (
    <div className="sync-error-banner" role="alert">
      <strong>{t('backup.syncProblem')}</strong> {syncError}. {t('backup.syncHelpBeforeRulesFile')}{' '}
      <code className="sync-error-code">firebase/firestore.rules</code> {t('backup.syncHelpAfterRulesFile')}{' '}
      <code className="sync-error-code">REACT_APP_FIREBASE_*</code> {t('backup.syncHelpAfterEnv')}
    </div>
  );

  if (cloudSync) {
    if (!syncError) return null;
    return (
      <footer className="backup-bar backup-bar--sync-error-only">
        {syncErrorBanner}
      </footer>
    );
  }

  return (
    <footer className="backup-bar">
      {syncErrorBanner}
      <span className="muted small">{t('backup.localOnly')}</span>
      <div className="backup-actions">
        <button type="button" className="btn small" onClick={download}>
          {t('backup.downloadJson')}
        </button>
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
          {t('backup.importJson')}
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} />
        {msg ? <span className="small">{msg}</span> : null}
      </div>
    </footer>
  );
}
