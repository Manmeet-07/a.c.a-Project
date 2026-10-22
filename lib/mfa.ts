"use client";

import {
  EmailAuthProvider, GoogleAuthProvider, getMultiFactorResolver, multiFactor,
  reauthenticateWithCredential, reauthenticateWithPopup, TotpMultiFactorGenerator,
  type MultiFactorError, type MultiFactorResolver, type TotpSecret, type User,
} from "firebase/auth";
import { getFirebase } from "./firebase-client";

export function authErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
}
export function mfaResolver(error: unknown): MultiFactorResolver | null {
  if (authErrorCode(error) !== "auth/multi-factor-auth-required") return null;
  return getMultiFactorResolver(getFirebase().auth, error as MultiFactorError);
}
export function totpFactors(user: User) {
  return multiFactor(user).enrolledFactors.filter(factor => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID);
}
function validCode(code: string) {
  const value = code.trim();
  if (!/^\d{6}$/.test(value)) throw new Error("Enter the six-digit code from your authenticator app.");
  return value;
}
export function resolveTotp(resolver: MultiFactorResolver, factorId: string, code: string) {
  if (!resolver.hints.some(factor => factor.uid === factorId && factor.factorId === TotpMultiFactorGenerator.FACTOR_ID)) {
    throw new Error("Choose an authenticator registered to this account.");
  }
  return resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factorId, validCode(code)));
}
export function reauthenticateForSecurity(user: User, method: "password" | "google.com", password: string) {
  if (!user.providerData.some(provider => provider.providerId === method)) throw new Error("Choose your existing sign-in method.");
  if (method === "google.com") {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account", login_hint: user.email || "" });
    return reauthenticateWithPopup(user, provider);
  }
  if (!user.email || !password) throw new Error("Enter your current password.");
  return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}
export async function beginTotpEnrollment(user: User) {
  if (!user.emailVerified) throw new Error("Verify your email before enabling two-factor authentication.");
  return TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
}
export async function finishTotpEnrollment(user: User, secret: TotpSecret, code: string) {
  await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, validCode(code)), "Authenticator app");
  await user.getIdToken(true);
}
export async function removeTotp(user: User, factorId: string) {
  if (!totpFactors(user).some(factor => factor.uid === factorId)) throw new Error("Authenticator not found on this account.");
  await multiFactor(user).unenroll(factorId);
}
export function mfaError(error: unknown) {
  const code = authErrorCode(error);
  if (["auth/invalid-verification-code", "auth/invalid-totp-code", "auth/code-expired"].includes(code)) return "That code is incorrect or expired. Enter the current code from your authenticator and check your phone’s time settings.";
  if (["auth/invalid-multi-factor-session", "auth/session-expired"].includes(code)) return "This verification session expired. Cancel and sign in again.";
  if (["auth/requires-recent-login", "auth/invalid-credential", "auth/wrong-password"].includes(code)) return "We couldn’t confirm your sign-in. Check your details and try again.";
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(code)) return "Sign-in cancelled. Your security settings were not changed.";
  if (code === "auth/popup-blocked") return "Allow popups for ACA, then try confirming your Google sign-in again.";
  if (code === "auth/too-many-requests") return "Too many attempts. Wait a little before trying again.";
  if (code === "auth/network-request-failed") return "Account services could not be reached. Check your connection and try again.";
  if (code === "auth/operation-not-allowed") return "Authenticator setup is not available right now. Please try again later.";
  return "We couldn’t complete verification. Check your code, or cancel and sign in again.";
}
