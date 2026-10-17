"use client";

import { useState } from "react";
import Link from "next/link";
import ResumeUploader from "./ResumeUploader";
import JobTailor from "./JobTailor";
import ApplicationTracker from "./ApplicationTracker";
import { useApplications, useProfile } from "@/lib/storage";
import BackupControls from "./BackupControls";
import Logo from "./Logo";

type Tab = "profile" | "tailor" | "track";
const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "tailor", label: "Match" },
  { id: "track", label: "Applications" },
];
const HEADINGS: Record<Tab, { title: string; description: string }> = {
  profile: { title: "Your resume, ready to work.", description: "Upload a PDF resume. ACA picks out your contact details and skills so you can compare jobs and fill in applications faster." },
  tailor: { title: "See how you match.", description: "Paste a job description to compare it with your resume: what lines up, what’s missing, and what to emphasize." },
  track: { title: "Every application, in one place.", description: "Follow each role from first look to offer." },
};

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("profile");
  const profile = useProfile();
  const applications = useApplications();
  const heading = HEADINGS[tab];
  return (
    <div className="app">
      <header className="global-nav">
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
          <span className="nav-note">Saved on this device</span>
        </div>
      </header>
      <main className="page">
        <section className="hero">
          <h1>{heading.title}</h1>
          <p>{heading.description}</p>
        </section>
        <section aria-label={TABS.find(t => t.id === tab)?.label}>
          {tab === "profile" && <ResumeUploader onNavigate={setTab} />}
          <div hidden={tab !== "tailor"}><JobTailor key={profile?.updatedAt || "empty"} onNavigate={setTab} /></div>
          {tab === "track" && <ApplicationTracker />}
        </section>
        <footer className="site-footer">
          <BackupControls />
          <p className="fine-print">Your profile and applications are saved in this browser. Resumes are read on the server to extract text. AI suggestions are optional: when you turn them on, filtered resume excerpts and the job description are sent to Anthropic.</p>
          <p className="fine-print">ACA · Autonomous Career Agent</p>
        </footer>
      </main>
    </div>
  );
}
