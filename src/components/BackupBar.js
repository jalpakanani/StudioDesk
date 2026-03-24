import { useRef, useState } from 'react';
import { useStudio } from '../context/StudioContext';

export default function BackupBar() {
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
    setMsg('Download started.');
    setTimeout(() => setMsg(''), 2500);
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJson(String(reader.result));
        setMsg('Import successful.');
      } catch {
        setMsg('Invalid file.');
      }
      setTimeout(() => setMsg(''), 3000);
    };
    reader.readAsText(f);
    e.target.value = '';
  }

  return (
    <footer className="backup-bar">
      {cloudSync && syncError ? (
        <div className="sync-error-banner" role="alert">
          <strong>Cloud sync problem:</strong> {syncError}. Open Firebase → Firestore → Rules and publish the rules
          from <code className="sync-error-code">firebase/firestore.rules</code> in this project. If this device uses a
          <strong> hosted website</strong>, add the same <code className="sync-error-code">REACT_APP_FIREBASE_*</code>{' '}
          keys in the host (Vercel/Netlify env) and rebuild—otherwise this device stays offline-only.
        </div>
      ) : null}
      <span className="muted small">
        {cloudSync
          ? 'Your desk syncs to your account (Firebase). Same login on phone + laptop = same data when cloud works.'
          : 'Data is stored in this browser only (localStorage)—not shared across devices. Add .env.local + login for cloud sync.'}
      </span>
      <div className="backup-actions">
        <button type="button" className="btn small" onClick={download}>
          Download JSON backup
        </button>
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} />
        {msg ? <span className="small">{msg}</span> : null}
      </div>
    </footer>
  );
}
