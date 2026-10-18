"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ResumeUploader from "./ResumeUploader";
import JobTailor from "./JobTailor";
import ApplicationTracker from "./ApplicationTracker";
import { useApplications, useProfile } from "@/lib/storage";
import BackupControls from "./BackupControls";
import Logo from "./Logo";
import { useScrollReveal, useScrolledClass } from "./useScrollReveal";
import { useAuth, logout } from "./auth/AuthProvider";

type Tab = "profile" | "tailor" | "track";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "tailor", label: "Match" },
  { id: "track", label: "Applications" },
];
// Each heading ends on one accent word, set in the serif like the landing page.
const HEADINGS: Record<Tab, { title: string; accent: string; description: string }> = {
  profile: { title: "Your resume, ready to", accent: "work.", description: "Upload a PDF resume. ACA picks out your contact details and skills so you can compare jobs and fill in applications faster." },
  tailor: { title: "See how you", accent: "match.", description: "Paste a job description to compare it with your resume: what lines up, what’s missing, and what to emphasize." },
  track: { title: "Every application,", accent: "tracked.", description: "Follow each role from first look to offer." },
};

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("profile");
  const { user } = useAuth();
  const [accountError, setAccountError] = useState("");
  const profile = useProfile();
  const applications = useApplications();
  const heading = HEADINGS[tab];
  const page = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  useScrollReveal(page, ".panel .stack > *, .panel > div > .card.empty, .site-footer");
  useScrolledClass(nav);
  return (
    <div className="app">
      <header className="global-nav" ref={nav}>
        <div className="nav-inner">
          <Link href="/" className="brand" aria-label="ACA home"><Logo size={22} />aca</Link>
          <nav className="tabs" aria-label="Main navigation">
            {TABS.map(t => (
              <button key={t.id} type="button" className="tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === "track" && applications.length > 0 && <span className="tab-count">{applications.length}</span>}
              </button>
            ))}
          </nav>
          <div className="account-menu"><span className="nav-note" title={user?.email || ""}>{user?.email}</span><button className="btn btn-secondary" onClick={() => { void logout().catch(() => setAccountError("Could not sign out. Please try again.")); }}>Sign out</button></div>
        </div>
      </header>
      <main className="page" ref={page}>
        {accountError && <p role="alert" className="notice notice-warning">{accountError}</p>}
        <section className="hero" key={tab}>
          <h1><span className="line"><span>{heading.title} <em className="accent">{heading.accent}</em></span></span></h1>
          <p>{heading.description}</p>
        </section>
        <section className="panel" aria-label={TABS.find(t => t.id === tab)?.label}>
          {tab === "profile" && <ResumeUploader onNavigate={setTab} />}
          <div hidden={tab !== "tailor"}><JobTailor key={profile?.updatedAt || "empty"} onNavigate={setTab} /></div>
          {tab === "track" && <ApplicationTracker />}
        </section>
        <footer className="site-footer">
          <BackupControls />
          <p className="fine-print">Your profile and applications sync to your private account. Resumes are read on the server to extract text. AI suggestions are optional: when you turn them on, filtered resume excerpts and the job description are sent to Anthropic.</p>
          <p className="fine-print">ACA · Autonomous Career Agent</p>
        </footer>
      </main>
    </div>
  );
}
