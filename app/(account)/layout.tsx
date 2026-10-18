import type { ReactNode } from "react";
import { AuthFrame } from "@/components/auth/AuthScreen";

// Sign-in and registration share one frame, so switching between them only
// swaps the form card instead of replaying the whole page entrance.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
