"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { getFirebase } from "@/lib/firebase-client";
import { googleSignInError, signInWithGoogle } from "@/lib/google-auth";
import { logout, useAuth } from "./AuthProvider";
import Icon from "../Icon";
import Logo from "../Logo";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-stage">
      <div className="lp-glow" aria-hidden="true"><span /><span /></div>
      <header className="auth-nav">
        <Link href="/" className="landing-brand" aria-label="ACA home"><Logo size={24} accent="#22d3ee" gap="#fb923c" track="#ffffff" />aca</Link>
        <Link href="/" className="landing-link auth-home">Back to home</Link>
      </header>
      <main className="auth-layout">
        <section className="auth-story" aria-labelledby="auth-title">
          <p className="kicker auth-rise">Your workspace</p>
          <h1 id="auth-title" className="auth-title">
            <span className="line"><span>Your job search,</span></span>
            <span className="line"><span>all in one <em className="accent">place.</em></span></span>
          </h1>
          <p className="auth-lede auth-rise">Your resume, your matches and every role you’re tracking, saved to your account and ready on any device.</p>
          <AuthPreview />
        </section>
        <section className="auth-card">{children}</section>
      </main>
      <footer className="auth-footer">
        <span className="footer-brand"><Logo size={18} accent="#22d3ee" gap="#fb923c" track="#ffffff" />ACA · Autonomous Career Agent</span>
        <span>Private to your account. You submit every application yourself.</span>
      </footer>
    </div>
  );
}

// A small, real piece of the product (the match view) instead of decoration.
// The ring and score animate once with CSS; reduced motion shows the end state.
const PREVIEW_RING = 2 * Math.PI * 52;
function AuthPreview() {
  return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-preview-ring score-ring">
        <svg viewBox="0 0 120 120"><circle className="score-track" cx="60" cy="60" r="52" /><circle className="score-value" cx="60" cy="60" r="52" strokeDasharray={PREVIEW_RING} style={{ ["--ring" as string]: PREVIEW_RING }} /></svg>
        <span className="score-number auth-preview-score" />
      </div>
      <div className="auth-preview-body">
        <strong>Junior Data Engineer</strong>
        <small>Example Company · 61% match</small>
        <div className="chips">
          {["Python", "SQL", "Docker"].map(s => <span key={s} className="chip chip-match"><Icon name="check" />{s}</span>)}
          <span className="chip chip-missing">Kubernetes</span>
        </div>
      </div>
    </div>
  );
}
function friendlyError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait a little before trying again.";
  if (code === "auth/network-request-failed")
    return "We couldn’t reach account services. Check your connection and try again.";
  if (
    code === "auth/weak-password" ||
    code === "auth/password-does-not-meet-requirements"
  )
    return "Choose a stronger password with at least 12 characters.";
  if (code === "auth/operation-not-allowed" || code === "auth/invalid-api-key")
    return "Account services are not fully configured yet. Please contact the ACA administrator.";
  return "We couldn’t complete that request. Check your details, try signing in, or reset your password.";
}
export function AuthScreen({
  mode = "login",
  redirect = true,
}: {
  mode?: "login" | "register";
  redirect?: boolean;
}) {
  const { user, loading, error: authError, configured } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reset, setReset] = useState(false);
  useEffect(() => {
    if (redirect && user?.emailVerified) router.replace("/app");
  }, [user, user?.emailVerified, redirect, router]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (mode === "register" && !reset && password !== confirm) {
      setError("Your passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      const { auth } = getFirebase();
      if (reset) {
        try {
          await sendPasswordResetEmail(auth, email.trim());
        } catch (error) {
          const code =
            error && typeof error === "object" && "code" in error
              ? String(error.code)
              : "";
          if (code !== "auth/user-not-found" && code !== "auth/invalid-email")
            throw error;
        }
        setMessage(
          "If an account exists for that email, a password-reset link will arrive shortly.",
        );
      } else if (mode === "register") {
        const result = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );
        if (name.trim())
          await updateProfile(result.user, { displayName: name.trim() });
        await sendEmailVerification(result.user);
        setPassword("");
        setConfirm("");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        setPassword("");
      }
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <>
        <div className="auth-loading" role="status">
          <span className="auth-spinner" />
          Starting your secure session…
        </div>
      </>
    );
  if (user && !user.emailVerified)
    return (
      <>
        <span className="auth-card-icon">
          <Icon name="shield" />
        </span>
        <p className="kicker">One last step</p>
        <h2>Check your inbox.</h2>
        <p>
          Verify <strong>{user.email}</strong> to open your private workspace.
        </p>
        <p className="auth-hint">
          Open the verification link, then come back here. Check your spam
          folder if you don’t see the email.
        </p>
        <button
          className="landing-btn auth-submit"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await user.reload();
              await user.getIdToken(true);
              if (!user.emailVerified)
                setMessage(
                  "Your email isn’t verified yet. Open the link in your inbox first.",
                );
            } catch (error) {
              setError(friendlyError(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Checking…" : "I’ve verified my email"}
        </button>
        <button
          className="auth-text-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await sendEmailVerification(user);
              setMessage(
                "Verification email sent. Please wait before requesting another.",
              );
            } catch (error) {
              setError(friendlyError(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          Resend verification email
        </button>
        <button
          className="auth-text-btn"
          disabled={busy}
          onClick={async () => {
            try {
              await logout();
            } catch (error) {
              setError(friendlyError(error));
            }
          }}
        >
          Use a different account
        </button>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
      </>
    );
  if (user?.emailVerified)
    return (
      <>
        <div className="auth-loading" role="status">
          Opening your workspace…
        </div>
      </>
    );
  return (
    <>
      <div className="auth-card-content" key={reset ? "reset" : mode}>
      <p className="kicker">{reset ? "Password reset" : mode === "register" ? "New account" : "Sign in"}</p>
      <h2>
        {reset
          ? "Reset your password."
          : mode === "register"
            ? "Create your account."
            : "Welcome back."}
      </h2>
      <p>
        {reset
          ? "Enter your email and we’ll send you a link to choose a new password."
          : mode === "register"
            ? "Free to use. Your resume and applications stay private to you."
            : "Sign in to pick up where you left off."}
      </p>
      {!configured && (
        <div className="auth-setup-note" role="status">
          Account setup is in progress. Registration will open once Firebase is
          connected to this deployment.
        </div>
      )}
      {!reset && (
        <>
          <button
            className="auth-google"
            type="button"
            disabled={busy || !configured}
            onClick={async () => {
              setBusy(true);
              setGoogleBusy(true);
              setError("");
              setMessage("");
              try {
                await signInWithGoogle();
                setPassword("");
                setConfirm("");
              } catch (error) {
                setError(googleSignInError(error));
              } finally {
                setGoogleBusy(false);
                setBusy(false);
              }
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z" />
              <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
              <path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z" />
              <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z" />
            </svg>
            {googleBusy ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <div className="auth-divider"><span>or use your email</span></div>
        </>
      )}
      {(error || authError) && <p className="error-banner" role="alert">{error || authError}</p>}
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && !reset && (
          <label className="field-label">
            Your name
            <input
              className="text-input"
              autoComplete="name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={busy || !configured}
              placeholder="How should we address you?"
            />
          </label>
        )}
        <label className="field-label">
          Email address
          <input
            className="text-input"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy || !configured}
            placeholder="you@example.com"
          />
        </label>
        {!reset && (
          <>
            <label className="field-label">
              Password
              <span className="auth-password">
                <input
                  aria-label="Password"
                  className="text-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  minLength={mode === "register" ? 12 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={busy || !configured}
                  placeholder={
                    mode === "register"
                      ? "At least 12 characters"
                      : "Your password"
                  }
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            {mode === "register" && (
              <label className="field-label">
                Confirm password
                <input
                  className="text-input"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={busy || !configured}
                  placeholder="One more time"
                />
              </label>
            )}
            {mode === "login" && (
              <button
                className="auth-forgot"
                type="button"
                onClick={() => {
                  setReset(true);
                  setPassword("");
                  setError("");
                  setMessage("");
                }}
              >
                Forgot password?
              </button>
            )}
          </>
        )}
        <p className="auth-hint">
          {mode === "register" && !reset
            ? "Use a unique password. We’ll ask you to verify your email before opening your workspace."
            : "For your privacy, your sign-in lasts for this browser session."}
        </p>
        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
        <button
          className="landing-btn auth-submit"
          disabled={busy || !configured}
          type="submit"
        >
          {busy
            ? "Just a moment…"
            : reset
              ? "Send reset link"
              : mode === "register"
                ? "Create my account"
                : "Sign in"}
          <Icon name="arrow" />
        </button>
      </form>
      </div>
      <div className="auth-switch">
        {reset ? (
          <button
            onClick={() => {
              setReset(false);
              setMessage("");
              setError("");
            }}
          >
            Back to sign in
          </button>
        ) : mode === "register" ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New around here? <Link href="/register">Create an account</Link>
          </>
        )}
      </div>
      <div className="auth-security-note">
        <Icon name="shield" />
        <span>
          Your password is handled by Firebase Authentication. Your workspace
          data is private to your account.
        </span>
      </div>
    </>
  );
}
