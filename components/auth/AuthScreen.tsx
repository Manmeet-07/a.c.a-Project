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
import { logout, useAuth } from "./AuthProvider";
import Icon from "../Icon";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="auth-stage">
      <div className="auth-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <Link href="/" aria-label="ACA home" className="brand auth-brand">
        <span className="brand-mark">
          <Icon name="spark" />
        </span>
        <span>
          aca<span className="brand-dot">.</span>
        </span>
      </Link>
      <div className="auth-layout">
        <section className="auth-story">
          <span className="eyebrow">YOUR AMBITION. YOUR SPACE.</span>
          <h1>
            A place for
            <br />
            your <em>next chapter.</em>
          </h1>
          <p>Your experience, opportunities, and progress—connected to you.</p>
          <div className="auth-orbit-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <Icon name="spark" />
          </div>
          <div className="auth-assurances">
            <span>
              <Icon name="shield" />
              Private to your account
            </span>
            <span>
              <Icon name="grid" />
              Available across devices
            </span>
          </div>
        </section>
        <section className="auth-card">{children}</section>
      </div>
      <footer className="auth-footer">
        Built for your next chapter. <span>Autonomous Career Agent</span>
      </footer>
    </main>
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
      <AuthFrame>
        <div className="auth-loading" role="status">
          <span className="auth-spinner" />
          Starting your secure session…
        </div>
      </AuthFrame>
    );
  if (user && !user.emailVerified)
    return (
      <AuthFrame>
        <span className="auth-card-icon">
          <Icon name="shield" />
        </span>
        <span className="eyebrow">ONE LAST STEP</span>
        <h2>Check your inbox.</h2>
        <p>
          Verify <strong>{user.email}</strong> to open your private workspace.
        </p>
        <p className="auth-hint">
          Open the verification link, then come back here. Check your spam
          folder if you don’t see the email.
        </p>
        <button
          className="primary-btn"
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
      </AuthFrame>
    );
  if (user?.emailVerified)
    return (
      <AuthFrame>
        <div className="auth-loading" role="status">
          Opening your workspace…
        </div>
      </AuthFrame>
    );
  return (
    <AuthFrame>
      <div className="auth-card-topline">
        <span className="eyebrow">
          {reset
            ? "FIND YOUR WAY BACK"
            : mode === "register"
              ? "MAKE ROOM FOR POSSIBILITY"
              : "WELCOME BACK"}
        </span>
        <Icon name="spark" />
      </div>
      <h2>
        {reset
          ? "Let’s reset."
          : mode === "register"
            ? "Your next chapter starts here."
            : "Back to your orbit."}
      </h2>
      <p>
        {reset
          ? "We’ll help you get back into your account."
          : mode === "register"
            ? "Create an account to keep your career journey together."
            : "Sign in to pick up where you left off."}
      </p>
      {!configured && (
        <div className="auth-setup-note" role="status">
          Account setup is in progress. Registration will open once Firebase is
          connected to this deployment.
        </div>
      )}
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
        {(error || authError) && (
          <p className="error-banner" role="alert">
            {error || authError}
          </p>
        )}
        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
        <button
          className="primary-btn auth-submit"
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
    </AuthFrame>
  );
}
