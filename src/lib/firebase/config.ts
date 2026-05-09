import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

// Firebase API keys are safe to ship to the client — they identify the
// project but don't grant any privileges. Real access control lives in
// Firestore security rules. Env vars are supported as overrides for staging
// or future projects.
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyAH9m7PVY-A_XP-AD1OOYvouVN5_00PXL4",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "mytraqr-golf.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "mytraqr-golf",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "mytraqr-golf.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "619864283089",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:619864283089:web:c2fba8ce6e94e2ffdff2f0",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-B6HM791SDW",
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

function getOrInitApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function firebaseApp(): FirebaseApp {
  return getOrInitApp();
}

export function firebaseAuth(): Auth {
  if (typeof window === "undefined") {
    throw new Error("firebaseAuth() is client-only");
  }
  if (_auth) return _auth;
  _auth = getAuth(getOrInitApp());
  return _auth;
}

export function firebaseDb(): Firestore {
  if (typeof window === "undefined") {
    // Server should never touch Firestore in this app yet — all access is
    // client-driven. If we add server actions later, switch to admin SDK.
    throw new Error("firebaseDb() is client-only");
  }
  if (_db) return _db;
  try {
    _db = initializeFirestore(getOrInitApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    // Already initialized (e.g. HMR); fall back to plain getFirestore.
    _db = getFirestore(getOrInitApp());
  }
  return _db;
}

export function googleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}
