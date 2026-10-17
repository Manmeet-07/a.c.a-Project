import type { Metadata } from "next";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Workspace · ACA",
};

export default function Workspace() {
  return <AppShell />;
}
