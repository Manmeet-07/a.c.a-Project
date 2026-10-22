"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import type { MultiFactorResolver, TotpSecret } from "firebase/auth";
import { authErrorCode, beginTotpEnrollment, finishTotpEnrollment, mfaError, mfaResolver, reauthenticateForSecurity, removeTotp, totpFactors } from "@/lib/mfa";
import { logout, useAuth } from "./AuthProvider";
import TotpChallenge from "./TotpChallenge";

type Action = { type: "enroll" } | { type: "remove"; factorId: string };
export default function SecuritySettings() {
  const { user } = useAuth();
  const router = useRouter();
  const [factors, setFactors] = useState(() => user ? totpFactors(user) : []);
  const [action, setAction] = useState<Action | null>(null);
  const [method, setMethod] = useState<"password" | "google.com">(() => user?.providerData.some(provider => provider.providerId === "google.com") ? "google.com" : "password");
  const [password, setPassword] = useState("");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  // Setup keys and QR data live only in this mounted component, never storage.
  const [setup, setSetup] = useState<{ secret: TotpSecret; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function cancel() {
    setSetup(null); setPassword(""); setCode(""); setResolver(null); setAction(null); setError(""); setBackupConfirmed(false);
  }
  if (!user) return null;
  const activeUser = user;
  async function afterReauthentication() {
    setPassword("");
    if (action?.type === "enroll") {
      const secret = await beginTotpEnrollment(activeUser);
      const qr = await QRCode.toDataURL(secret.generateQrCodeUrl(activeUser.email || activeUser.uid, "ACA"), { width: 224, margin: 2 });
      setSetup({ secret, qr }); setResolver(null);
    } else if (action?.type === "remove") {
      await removeTotp(activeUser, action.factorId);
      cancel(); await logout(); router.replace("/login");
    }
  }
  return <section className="card security-card stack" aria-label="Account security">
    <span className="kicker">Account security</span>
    <h1>Two-factor authentication</h1>
    <p>Add an authenticator app to protect your account with a six-digit code after your password or Google sign-in.</p>
    <p className="notice" role="status">{factors.length ? "Two-factor authentication is on." : "Two-factor authentication is off."}</p>
    {message && <p className="notice" role="status">{message}</p>}
    {error && <p className="notice notice-warning" role="alert">{error}</p>}
    {resolver ? <TotpChallenge resolver={resolver} onComplete={afterReauthentication} onCancel={cancel} /> : setup ? <form className="stack" onSubmit={async event => {
      event.preventDefault(); if (!backupConfirmed) return; setBusy(true); setError("");
      try {
        await finishTotpEnrollment(activeUser, setup.secret, code);
        setFactors(totpFactors(activeUser)); cancel(); setMessage("Authenticator added. Future sign-ins require an authenticator code.");
      } catch (error) { setError(mfaError(error)); setCode(""); }
      finally { setBusy(false); }
    }}>
      <h2>Connect your authenticator</h2>
      <p>Scan this QR code in Google Authenticator, Microsoft Authenticator, or another compatible app.</p>
      <Image className="security-qr" src={setup.qr} unoptimized width={224} height={224} alt="Scan this QR code with your authenticator app" />
      <label className="field-label">Authenticator setup key<input className="text-input security-key" value={setup.secret.secretKey} readOnly autoComplete="off" spellCheck={false} /></label>
      <p className="fine-print">If scanning is unavailable, enter the key manually: time-based, six digits, every 30 seconds. Keep the key private.</p>
      <label className="field-label">Authenticator code<input className="text-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} required disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label>
      <label className="security-confirm"><input type="checkbox" checked={backupConfirmed} disabled={busy} required onChange={event => setBackupConfirmed(event.target.checked)} />I have secured my authenticator backup. I understand ACA does not issue recovery codes and losing my authenticator may require administrator-assisted recovery.</label>
      <div className="actions"><button type="submit" className="btn btn-primary" disabled={busy || !backupConfirmed}>{busy ? "Verifying…" : "Enable two-factor authentication"}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={cancel}>Cancel setup</button></div>
    </form> : action ? <form className="stack" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      try { await reauthenticateForSecurity(activeUser, method, password); await afterReauthentication(); }
      catch (error) {
        setPassword("");
        const challenge = mfaResolver(error);
        if (challenge) setResolver(challenge);
        else if (authErrorCode(error) === "auth/user-token-expired") { await logout(); router.replace("/login"); }
        else setError(mfaError(error));
      } finally { setBusy(false); }
    }}>
      <h2>{action.type === "enroll" ? "Confirm your identity" : "Confirm authenticator removal"}</h2>
      <p>{action.type === "enroll" ? "Sign in again before adding an authenticator." : "Sign in again and complete any authenticator challenge. Removing your last authenticator turns off two-factor protection. You will be signed out after removal."}</p>
      {activeUser.providerData.some(provider => provider.providerId === "password") && activeUser.providerData.some(provider => provider.providerId === "google.com") && <label className="field-label">Sign-in method<select className="text-input" value={method} disabled={busy} onChange={event => setMethod(event.target.value as "password" | "google.com")}><option value="password">Email and password</option><option value="google.com">Google</option></select></label>}
      {method === "password" && <label className="field-label">Current password<input className="text-input" type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>}
      <div className="actions"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Confirming…" : method === "google.com" ? "Confirm with Google" : "Confirm password"}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={cancel}>Cancel changes</button></div>
    </form> : <>
      {factors.length > 0 && <ul className="security-factors">{factors.map((factor, index) => <li key={factor.uid}><span>{factor.displayName || `Authenticator ${index + 1}`}</span><button className="btn btn-secondary" onClick={() => { setAction({ type: "remove", factorId: factor.uid }); setError(""); setMessage(""); }}>Remove authenticator {index + 1}</button></li>)}</ul>}
      <button className="btn btn-primary" disabled={factors.length >= 5} onClick={() => { setAction({ type: "enroll" }); setError(""); setMessage(""); }}>{factors.length ? "Add another authenticator" : "Set up authenticator"}</button>
      <p className="fine-print">Enable authenticator backup or keep another enrolled authenticator available. If every authenticator is lost, contact the ACA administrator to arrange account recovery. Email verification and Google’s own two-step settings are separate from ACA’s two-factor protection.</p>
    </>}
  </section>;
}
