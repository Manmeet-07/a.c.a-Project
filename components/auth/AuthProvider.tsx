"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  browserSessionPersistence,
  onIdTokenChanged,
  setPersistence,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseConfigured, getFirebase } from "@/lib/firebase-client";
import { connectWorkspace } from "@/lib/storage";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string;
  configured: boolean;
}
const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: "",
  configured: firebaseConfigured,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: firebaseConfigured,
    error: "",
    configured: firebaseConfigured,
  });
  useEffect(() => {
    if (!firebaseConfigured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const { auth } = getFirebase();
    void setPersistence(auth, browserSessionPersistence)
      .then(() => {
        if (!active) return;
        unsubscribe = onIdTokenChanged(
          auth,
          (user) => {
            connectWorkspace(user?.emailVerified ? user.uid : null);
            setState({ user, loading: false, error: "", configured: true });
          },
          () => {
            connectWorkspace(null);
            setState({
              user: null,
              loading: false,
              error:
                "Account services could not be reached. Please refresh and try again.",
              configured: true,
            });
          },
        );
      })
      .catch(() => {
        if (active)
          setState({
            user: null,
            loading: false,
            error:
              "This browser cannot start a secure session. Allow session storage and try again.",
            configured: true,
          });
      });
    return () => {
      active = false;
      unsubscribe?.();
      connectWorkspace(null);
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
export async function logout() {
  await signOut(getFirebase().auth);
  connectWorkspace(null);
}
