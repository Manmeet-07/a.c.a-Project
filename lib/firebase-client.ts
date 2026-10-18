"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);
let services: { auth: Auth; db: Firestore } | undefined;
export function getFirebase() {
  if (!firebaseConfigured)
    throw new Error(
      "Firebase setup is not complete. Please contact the ACA administrator.",
    );
  if (services) return services;
  const existed = getApps().length > 0;
  const app = existed ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = existed
    ? getFirestore(app)
    : initializeFirestore(app, { localCache: memoryLocalCache() });
  // Emulator access is explicitly disabled in production builds.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true"
  ) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  services = { auth, db };
  return services;
}
export async function authenticatedFetch(
  input: string,
  init: RequestInit = {},
) {
  const user = getFirebase().auth.currentUser;
  if (!user) throw new Error("Please sign in to continue.");
  if (!user.emailVerified)
    throw new Error("Verify your email before using your workspace.");
  const token = await user.getIdToken();
  if (getFirebase().auth.currentUser?.uid !== user.uid)
    throw new Error("Your account changed. Please try again.");
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers, cache: "no-store" });
}
