import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {
  EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
} from '@env';

export function getResolvedFirebaseConfig() {
  const apiKey = String(EXPO_PUBLIC_FIREBASE_API_KEY || '').trim();
  const authDomain = String(EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '').trim();
  const projectId = String(EXPO_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
  const appId = String(EXPO_PUBLIC_FIREBASE_APP_ID || '').trim();
  if (!apiKey || !authDomain || !projectId || !appId) return null;

  const storageBucket =
    String(EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '').trim() || `${projectId}.appspot.com`;
  const messagingSenderId =
    String(EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '').trim() || '000000000000';

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket,
    messagingSenderId,
  };
}

export function isFirebaseConfigured() {
  return getResolvedFirebaseConfig() !== null;
}

let appSingleton = null;

export function getFirebaseApp() {
  const resolved = getResolvedFirebaseConfig();
  if (!resolved) return null;
  if (!appSingleton) {
    appSingleton = getApps().length ? getApps()[0] : initializeApp(resolved);
  }
  return appSingleton;
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

export function getDb() {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}

export const USER_DATA_COLLECTION = 'userStudioData';
