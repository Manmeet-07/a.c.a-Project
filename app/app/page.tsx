import type { Metadata } from "next";
import AuthGate from "@/components/auth/AuthGate";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Workspace · ACA",
};

export default function Workspace() {
  return <AuthGate><AppShell /></AuthGate>;
}
