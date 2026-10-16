"use client";

import { useState } from "react";
import ResumeUploader from "./ResumeUploader";
import JobTailor from "./JobTailor";
import ApplicationTracker from "./ApplicationTracker";
import { useApplications, useProfile } from "@/lib/storage";
import BackupControls from "./BackupControls";
import Icon from "./Icon";

type Tab = "profile" | "tailor" | "track";
const TABS: { id: Tab; label: string; detail: string; icon: "profile" | "spark" | "grid" }[] = [
  { id: "profile", label: "My profile", detail: "Your career foundation", icon: "profile" },
  { id: "tailor", label: "Tailor a resume", detail: "Find your strongest fit", icon: "spark" },
  { id: "track", label: "Applications", detail: "Keep moving forward", icon: "grid" },
];
const HEADINGS = {
  profile: { eyebrow: "YOUR STARTING POINT", title: "Your next move.", accent: "In full orbit.", description: "Bring your experience together. Make every application more intentional." },
  tailor: { eyebrow: "MAKE YOUR EXPERIENCE COUNT", title: "Find your frequency.", accent: "Make it resonate.", description: "Compare your resume with a role and discover what to bring to the forefront." },
  track: { eyebrow: "YOUR CAREER, IN MOTION", title: "Follow the possibility.", accent: "Keep your momentum.", description: "Keep a clear view of your applications, from first discovery to your next offer." },
};

export default function AppShell() {
  const [motionPaused, setMotionPaused] = useState(false);
  const [tab, setTab] = useState<Tab>("profile");
  const profile = useProfile();
  const applications = useApplications();
  const heading = HEADINGS[tab];
  return (
    <div className={`workspace orbit-workspace ${motionPaused ? "motion-paused" : ""}`}>
      <div className="living-background" aria-hidden="true"><div className="aurora aurora-one" /><div className="aurora aurora-two" /><div className="star-field" /><div className="orbital-system"><div className="orbital-ring ring-one" /><div className="orbital-ring ring-two" /><div className="orbital-ring ring-three" /><div className="orbit-core" /></div><div className="background-grid" /></div>
      <aside className="sidebar">
        <button onClick={() => setTab("profile")} className="brand" aria-label="ACA home"><span className="brand-mark"><Icon name="spark" /></span><span>aca<span className="brand-dot">.</span></span></button>
        <div className="sidebar-label">YOUR PERSONAL LAUNCHPAD</div>
        <nav className="workspace-nav" aria-label="Main navigation">
          {TABS.map(t => <button key={t.id} className={`nav-item ${tab === t.id ? "nav-item-active" : ""}`} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}><Icon name={t.icon} /><span>{t.label}<small>{t.detail}</small></span>{t.id === "track" && applications.length > 0 && <span className="nav-count">{applications.length}</span>}</button>)}
        </nav>
        <div className="sidebar-tip"><span className="tip-icon"><Icon name="spark" /></span><h3>Small steps. Big possibilities.</h3><p>A thoughtful application starts with knowing what you bring.</p><button onClick={() => setTab(tab === "profile" ? "tailor" : "profile")}>{tab === "profile" ? "Explore job matching" : "View your profile"}<Icon name="arrow" /></button></div>
        <div className="sidebar-bottom"><span className="avatar">{profile?.name?.slice(0, 1).toUpperCase() || "Y"}</span><div><strong>{profile?.name || "Your workspace"}</strong><small>Personal career space</small></div><span className="online-dot" /></div>
      </aside>
      <main className="workspace-main">
        <header className="topbar"><span>Workspace <span className="breadcrumb-slash">/</span> <strong>{TABS.find(t => t.id === tab)?.label}</strong></span><div className="topbar-tools"><span className="local-badge"><span className="online-dot" /> Saved on this device</span><button className="motion-control" onClick={() => setMotionPaused(p => !p)} aria-pressed={motionPaused} aria-label={motionPaused ? "Resume background animation" : "Pause background animation"}><span aria-hidden="true">{motionPaused ? "▷" : "Ⅱ"}</span>{motionPaused ? "Resume motion" : "Pause motion"}</button></div></header>
        <div className="page-content">
          <section className="page-heading"><div className="eyebrow">{heading.eyebrow}</div><h1>{heading.title}<em>{heading.accent}</em></h1><p>{heading.description}</p></section>
          <div className="journey" aria-label="Application workflow">{TABS.map((t, i) => <button key={t.id} onClick={() => setTab(t.id)} className={`journey-step ${tab === t.id ? "journey-active" : ""}`} aria-pressed={tab === t.id}><span className="step-number">{i === 0 && profile ? <Icon name="check" /> : `0${i + 1}`}</span><span><strong>{["Build your profile", "Find your match", "Track your progress"][i]}</strong><small>{["Upload your resume", "Get tailored insights", "Organize opportunities"][i]}</small></span><Icon name="arrow" /></button>)}</div>
          <BackupControls />
          <div className="content-grid">
            <section className="active-panel" aria-label={TABS.find(t => t.id === tab)?.label}>
              {tab === "profile" && <ResumeUploader onNavigate={setTab} />}
              <div hidden={tab !== "tailor"}><JobTailor key={profile?.updatedAt || "empty"} /></div>
              {tab === "track" && <ApplicationTracker />}
            </section>
            <aside className="context-rail">
              <div className="guide-card"><div className="eyebrow">MISSION NOTES</div><h2>{tab === "profile" ? "Your experience. A clearer picture." : tab === "tailor" ? "Be relevant. Stay authentic." : "Build a little momentum."}</h2><p>{tab === "profile" ? "Your resume is the foundation for smarter matches and a more focused job search." : tab === "tailor" ? "Use match insights to highlight the experience you already have. A score is a guide, not a verdict." : "Update each opportunity as it moves forward, so your next step is always clear."}</p><div className="guide-divider" />{["Start with your latest resume", "Highlight skills you actually have", "Review before you apply"].map((text, i) => <div className="guide-point" key={text}><span>0{i + 1}</span>{text}</div>)}</div>
              <div className="privacy-note"><Icon name="shield" /><div><strong>Your workspace stays yours</strong><p>Your profile and tracker are saved in this browser. Resume parsing runs on the server. AI is optional: when enabled, filtered resume excerpts and the job description are sent to Anthropic. Export backups to keep a copy outside this browser.</p></div></div>
            </aside>
          </div>
          <footer className="workspace-footer"><span>A little ambition. A whole new trajectory.</span><span>Autonomous Career Agent <span>·</span> ACA</span></footer>
        </div>
      </main>
    </div>
  );
}
