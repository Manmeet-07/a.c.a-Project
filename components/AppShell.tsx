"use client";

import { useState } from "react";
import ResumeUploader from "./ResumeUploader";
import JobTailor from "./JobTailor";
import ApplicationTracker from "./ApplicationTracker";

type Tab = "profile" | "tailor" | "track";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "1. Profile" },
  { id: "tailor", label: "2. Tailor" },
  { id: "track", label: "3. Track" },
];

export default function AppShell() {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div className="flex flex-col gap-8">
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "tab-btn-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "profile" && <ResumeUploader />}
      {tab === "tailor" && <JobTailor />}
      {tab === "track" && <ApplicationTracker />}
    </div>
  );
}
