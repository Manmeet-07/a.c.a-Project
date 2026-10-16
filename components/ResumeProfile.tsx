"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { CandidateProfile } from "@/types/profile";
import Icon from "./Icon";

export default function ResumeProfile({ profile, onNavigate }: {
  profile: CandidateProfile;
  onNavigate?: (tab: "tailor" | "track") => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const visibleSkills = profile.skills.filter(skill => skill.toLowerCase().includes(query.toLowerCase().trim()));
  const evidence = selectedSkill
    ? profile.resumeText.split(/\n/).filter(line => line.toLowerCase().includes(selectedSkill.toLowerCase())).slice(0, 3)
    : [];
  const contactFields = [
    { label: "Email", value: profile.email },
    { label: "Phone", value: profile.phone },
    { label: "Location", value: [profile.city, profile.state, profile.postalCode].filter(Boolean).join(", ") },
    { label: "Street address", value: profile.address },
    { label: "LinkedIn", value: profile.linkedin },
    { label: "GitHub", value: profile.github },
    { label: "Website", value: profile.website || profile.portfolio },
  ];
  const detectedContacts = contactFields.filter(field => field.value).length;
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("") || "Y";

  return (
    <div className="profile-discovery">
      <div className="discovery-banner" role="status"><span className="discovery-check"><Icon name="check" /></span><span>Your experience is in orbit.<small>Here’s what we found in your resume. Take a look around.</small></span><span className="discovery-spark" aria-hidden="true">✳</span></div>
      <section className="identity-stage">
        <div className="identity-orbit" aria-hidden="true"><span className="identity-orbit-ring" /><span className="identity-initials">{initials}</span><span className="identity-satellite" /></div>
        <div className="identity-copy"><div className="eyebrow">MEET YOUR CAREER PROFILE</div><h2>{profile.name ? <>Hello, <em>{profile.name.split(/\s+/)[0]}.</em></> : "Your story starts here."}</h2><p>{profile.name || "Name wasn’t detected — check the extracted resume below."}</p><span className="source-file"><Icon name="file" />{profile.fileName || "Your uploaded resume"}</span></div>
      </section>
      <div className="discovery-stats">
        <div><strong>{profile.skills.length.toString().padStart(2, "0")}</strong><span>skills detected</span><Icon name="spark" /></div>
        <div><strong>{detectedContacts.toString().padStart(2, "0")}</strong><span>contact details found</span><Icon name="profile" /></div>
        <div><strong>01</strong><span>story. Yours.</span><Icon name="file" /></div>
      </div>
      <section className="skill-explorer">
        <div className="explorer-heading"><div><span className="eyebrow">YOUR CONSTELLATION</span><h3>Explore what you bring.</h3></div><span className="explorer-count">{profile.skills.length} skills</span></div>
        <p className="explorer-intro">Select a skill to explore where it appears in your resume.</p>
        {profile.skills.length > 0 ? <>
          <label className="skill-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="Search detected skills" placeholder="Find a skill in your constellation…" value={query} onChange={e => { setQuery(e.target.value); setSelectedSkill(null); }} /></label>
          <div className="skill-constellation">
            {visibleSkills.map((skill, index) => <button key={skill} type="button" className={`constellation-skill ${selectedSkill === skill ? "skill-selected" : ""}`} style={{ "--reveal-delay": `${Math.min(index, 15) * 35}ms` } as CSSProperties} onClick={() => setSelectedSkill(selectedSkill === skill ? null : skill)} aria-pressed={selectedSkill === skill}><span className="skill-star" aria-hidden="true" />{skill}<span className="skill-plus" aria-hidden="true">{selectedSkill === skill ? "−" : "+"}</span></button>)}
          </div>
          {visibleSkills.length === 0 && <p className="skill-no-results" role="status">No detected skills match “{query}”. Try another term.</p>}
          {selectedSkill && <div className="skill-evidence" key={selectedSkill}><div className="evidence-title"><span><Icon name="spark" />{selectedSkill}</span><button type="button" onClick={() => setSelectedSkill(null)} aria-label="Close skill details">×</button></div><span className="evidence-label">FROM YOUR RESUME</span>{evidence.length > 0 ? evidence.map((line, index) => <blockquote key={index}>{line}</blockquote>) : <p>This skill was recognized through a related term or alias. Review your extracted resume for context.</p>}<p className="evidence-note">Detected mentions describe your resume, not a proficiency rating.</p></div>}
        </> : <p className="skill-no-results">We didn’t recognize skills from our vocabulary. Your resume text is still available for matching.</p>}
      </section>
      <details className="profile-accordion"><summary><span className="accordion-icon"><Icon name="profile" /></span><span>Check your contact card<small>{detectedContacts} details detected · Used by Fill-Assist</small></span><span className="accordion-plus" aria-hidden="true">+</span></summary><div className="contact-card-grid">{contactFields.map(field => <div className="contact-detail" key={field.label}><span>{field.label}</span><p className={!field.value ? "detail-missing" : ""}>{field.value || "Not detected"}</p></div>)}</div><p className="contact-review-note">Extraction can miss details. Review these before using Fill-Assist on an application.</p></details>
      <details className="profile-accordion"><summary><span className="accordion-icon"><Icon name="file" /></span><span>Look inside your resume<small>The text behind your profile and matches</small></span><span className="accordion-plus" aria-hidden="true">+</span></summary><pre className="resume-text-preview">{profile.resumeText}</pre></details>
      {onNavigate && <div className="profile-next-move"><div><span className="eyebrow">NOW, LET’S PUT IT TO WORK</span><h3>Your next opportunity is out there.</h3><p>Bring a job description. Find where your experience connects.</p></div><button type="button" className="primary-btn" onClick={() => onNavigate("tailor")}>Find my match<Icon name="arrow" /></button><button type="button" className="next-track-link" onClick={() => onNavigate("track")}>Go to applications <span aria-hidden="true">↗</span></button></div>}
    </div>
  );
}
