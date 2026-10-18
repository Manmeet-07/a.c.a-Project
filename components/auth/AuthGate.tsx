"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth, logout } from "./AuthProvider";
import { AuthFrame } from "./AuthScreen";
import {
  retryWorkspace,
  useStorageWarning,
  useWorkspaceStatus,
} from "@/lib/storage";
export default function AuthGate({ children }: { children: ReactNode }) {
  const [error, setError] = useState("");
  const { user, loading } = useAuth();
  const status = useWorkspaceStatus();
  const warning = useStorageWarning();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user?.emailVerified) router.replace("/login");
  }, [loading, user, user?.emailVerified, router]);
  if (!loading && user?.emailVerified && status === "ready") return children;
  return (
    <AuthFrame>
      {status === "error" ? (
        <>
          <h2>Let’s reconnect.</h2>
          {error && <p role="alert">{error}</p>}
          <p role="alert">
            {warning || "Your private workspace could not be loaded."}
          </p>
          <button className="primary-btn" onClick={retryWorkspace}>
            Try again
          </button>
          <button
            className="auth-text-btn"
            onClick={() => {
              void logout().catch(() =>
                setError("Could not sign out. Please try again."),
              );
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <div className="auth-loading" role="status">
          <span className="auth-spinner" />
          {user?.emailVerified
            ? "Opening your private workspace…"
            : "Checking your session…"}
        </div>
      )}
    </AuthFrame>
  );
}
