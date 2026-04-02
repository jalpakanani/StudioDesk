import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import gu from './locales/gu.json';

export const LANGUAGE_STORAGE_KEY = 'my-studio-desk-language';

const resources = {
  en: { translation: en },
  gu: { translation: gu },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export async function loadSavedLanguage() {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'gu' || saved === 'en') {
      await i18n.changeLanguage(saved);
    }
  } catch {
    /* ignore */
  }
}

export async function setAppLanguage(code) {
  if (code !== 'en' && code !== 'gu') return;
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export default i18n;
