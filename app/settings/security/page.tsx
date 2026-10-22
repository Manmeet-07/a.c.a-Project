import type { Metadata } from "next";
import Link from "next/link";
import AuthGate from "@/components/auth/AuthGate";
import SecuritySettings from "@/components/auth/SecuritySettings";

export const metadata: Metadata = { title: "Account security · ACA", robots: { index: false, follow: false } };
export default function SecurityPage() {
  return <AuthGate><main className="page security-page"><Link className="btn btn-secondary" href="/app">Back to workspace</Link><SecuritySettings /></main></AuthGate>;
}
