"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebase } from "./firebase-client";

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  // Keep the popup directly in the click handler's call stack. Awaiting setup
  // here can cause browsers to treat it as an unsolicited popup.
  return signInWithPopup(getFirebase().auth, provider);
}

export function googleSignInError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow popups for ACA and try again.";
  if (code === "auth/unauthorized-domain" || code === "auth/operation-not-allowed" || code === "auth/invalid-oauth-client-id") return "Google sign-in is not configured for this website yet. Please use email and password for now.";
  if (code === "auth/account-exists-with-different-credential") return "This account uses another sign-in method. Sign in using your original method to access your existing workspace.";
  if (code === "auth/network-request-failed") return "We couldn’t reach Google sign-in. Check your connection and try again.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a little before trying again.";
  return "Google sign-in couldn’t finish. Please try again or use email and password.";
}
