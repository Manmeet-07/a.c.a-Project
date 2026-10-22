"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
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
import { clearMfaOfferChoice, readMfaOfferChoice, saveMfaOfferChoice } from "@/lib/mfa-offer";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string;
  configured: boolean;
}
interface AuthContextState extends AuthState {
  twoFactorOfferDismissed: boolean;
  dismissTwoFactorOffer: () => void;
}
const AuthContext = createContext<AuthContextState>({
  user: null,
  loading: true,
  error: "",
  configured: firebaseConfigured,
  twoFactorOfferDismissed: false,
  dismissTwoFactorOffer: () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [twoFactorOfferDismissed, setTwoFactorOfferDismissed] = useState(false);
  const dismissedUser = useRef<string | null>(null);
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
            if (!user) {
              dismissedUser.current = null;
              clearMfaOfferChoice();
              setTwoFactorOfferDismissed(false);
            } else {
              const dismissed = dismissedUser.current === user.uid || readMfaOfferChoice(user.uid);
              dismissedUser.current = dismissed ? user.uid : null;
              setTwoFactorOfferDismissed(dismissed);
            }
            connectWorkspace(user?.emailVerified ? user.uid : null);
            setState({ user, loading: false, error: "", configured: true });
          },
          () => {
            dismissedUser.current = null;
            clearMfaOfferChoice();
            setTwoFactorOfferDismissed(false);
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
  function dismissTwoFactorOffer() {
    if (!state.user) return;
    dismissedUser.current = state.user.uid;
    saveMfaOfferChoice(state.user.uid);
    setTwoFactorOfferDismissed(true);
  }
  return <AuthContext.Provider value={{ ...state, twoFactorOfferDismissed, dismissTwoFactorOffer }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
export async function logout() {
  await signOut(getFirebase().auth);
  connectWorkspace(null);
}
