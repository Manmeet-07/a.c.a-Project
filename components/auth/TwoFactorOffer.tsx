"use client";

import Icon from "../Icon";

export default function TwoFactorOffer({ onSetup, onSkip, onSignOut, error }: {
  onSetup: () => void;
  onSkip: () => void;
  onSignOut: () => void;
  error: string;
}) {
  return <section className="stack" aria-label="Optional two-factor setup">
    <span className="auth-card-icon"><Icon name="shield" /></span>
    <p className="kicker">Optional account protection</p>
    <h2>Protect your account.</h2>
    <p>Add an authenticator app before opening your workspace. Once enabled, sign-ins require a six-digit code as well as your password or Google account.</p>
    <button className="landing-btn auth-submit" onClick={onSetup}>Set up 2FA</button>
    <button className="btn btn-secondary" onClick={onSkip}>Not now</button>
    <p className="auth-hint">You can continue without setting it up. The Security page is always available when you’re ready.</p>
    <button className="auth-text-btn" onClick={onSignOut}>Sign out</button>
    {error && <p className="error-banner" role="alert">{error}</p>}
  </section>;
}
