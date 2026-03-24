import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Firebase web config from Console → Project settings. Only these four must be set in .env.local;
 * storage bucket + messaging sender id get sensible defaults if omitted (common reason login never showed).
 */
export function getResolvedFirebaseConfig() {
  const apiKey = process.env.REACT_APP_FIREBASE_API_KEY?.trim();
  const authDomain = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN?.trim();
  const projectId = process.env.REACT_APP_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.REACT_APP_FIREBASE_APP_ID?.trim();
  if (!apiKey || !authDomain || !projectId || !appId) return null;

  const storageBucket =
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET?.trim() || `${projectId}.appspot.com`;
  const messagingSenderId =
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID?.trim() || '000000000000';

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

/** Firestore doc: one document per user with full app payload */
export const USER_DATA_COLLECTION = 'userStudioData';
