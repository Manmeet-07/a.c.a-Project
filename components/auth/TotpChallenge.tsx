"use client";

import { useState } from "react";
import { TotpMultiFactorGenerator, type MultiFactorResolver } from "firebase/auth";
import { mfaError, resolveTotp } from "@/lib/mfa";

export default function TotpChallenge({ resolver, onComplete, onCancel }: {
  resolver: MultiFactorResolver;
  onComplete: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const factors = resolver.hints.filter(factor => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  const [factorId, setFactorId] = useState(factors[0]?.uid || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="stack" aria-label="Two-factor verification">
    <h2>Verify your sign-in.</h2>
    <p>Enter the six-digit code from your authenticator app to continue.</p>
    {!factors.length ? <p role="alert">This account uses a second factor ACA cannot display. Contact the ACA administrator for help recovering access.</p> : <form className="auth-form" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      try { await resolveTotp(resolver, factorId, code); setCode(""); await onComplete(); }
      catch (error) { setError(mfaError(error)); setCode(""); }
      finally { setBusy(false); }
    }}>
      {factors.length > 1 && <label className="field-label">Authenticator<select className="text-input" value={factorId} disabled={busy} onChange={event => setFactorId(event.target.value)}>{factors.map((factor, index) => <option key={factor.uid} value={factor.uid}>{factor.displayName || `Authenticator ${index + 1}`}</option>)}</select></label>}
      <label className="field-label">Authenticator code<input className="text-input" name="totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} required value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <button className="landing-btn auth-submit" disabled={busy} type="submit">{busy ? "Verifying…" : "Verify and continue"}</button>
    </form>}
    <button className="auth-text-btn" type="button" disabled={busy} onClick={onCancel}>Cancel verification</button>
    <p className="auth-hint">Lost access to your authenticator? Use another enrolled authenticator or contact the ACA administrator. A password reset does not bypass this step.</p>
  </section>;
}
