import type { Metadata } from "next";
import Link from "next/link";
import AuthGate from "@/components/auth/AuthGate";
import SecuritySettings from "@/components/auth/SecuritySettings";

export const metadata: Metadata = { title: "Account security · ACA", robots: { index: false, follow: false } };
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string | string[] }> }) {
  const startSetup = (await searchParams).setup === "1";
  return <AuthGate offerTwoFactor={false}><main className="page security-page"><Link className="btn btn-secondary" href="/app">Back to workspace</Link><SecuritySettings key={startSetup ? "setup" : "settings"} startSetup={startSetup} /></main></AuthGate>;
}
