/** User-chosen title shown in header / login (this browser only). */
export const STUDIO_DISPLAY_NAME_KEY = 'my-studio-desk-studio-name';

export function readStudioDisplayName() {
  if (typeof window === 'undefined') return '';
  try {
    const v = window.localStorage.getItem(STUDIO_DISPLAY_NAME_KEY);
    return v != null ? String(v).trim() : '';
  } catch {
    return '';
  }
}

export function writeStudioDisplayName(name) {
  if (typeof window === 'undefined') return;
  const trimmed = String(name || '').trim();
  try {
    if (trimmed) window.localStorage.setItem(STUDIO_DISPLAY_NAME_KEY, trimmed);
    else window.localStorage.removeItem(STUDIO_DISPLAY_NAME_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('desk-studio-name-changed'));
}
