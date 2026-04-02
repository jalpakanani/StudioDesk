import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import gu from './locales/gu.json';

export const LANGUAGE_STORAGE_KEY = 'my-studio-desk-lang';

function readStoredLanguage() {
  if (typeof window === 'undefined') return 'en';
  try {
    const v = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (v === 'en' || v === 'gu') return v;
  } catch {
    /* ignore */
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    gu: { translation: gu },
  },
  lng: readStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setAppLanguage(code) {
  if (code !== 'en' && code !== 'gu') return;
  i18n.changeLanguage(code);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export default i18n;
