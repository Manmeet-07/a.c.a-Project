"use client";

import { useState } from "react";
import type { CandidateProfile } from "@/types/profile";
import { mentionsSkill } from "@/lib/skills";
import ProfileEditor from "./ProfileEditor";
import Icon from "./Icon";

export default function ResumeProfile({ profile, onNavigate }: {
  profile: CandidateProfile;
  onNavigate?: (tab: "tailor" | "track") => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const visibleSkills = profile.skills.filter(skill => skill.toLowerCase().includes(query.toLowerCase().trim()));
  const evidence = selectedSkill
    ? profile.resumeText.split(/\n/).filter(line => mentionsSkill(line, selectedSkill)).slice(0, 3)
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
  const initials = profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const summary = [profile.email, profile.phone].filter(Boolean).join(" · ");

  return (
    <div className="stack">
      <section className="card profile-summary">
        <span className="avatar" aria-hidden="true">{initials || <Icon name="file" />}</span>
        <div className="profile-name">
          <h2>{profile.name || "Name not found"}</h2>
          <p className="muted">{profile.name ? summary || "No email or phone found" : "Add your name under “Edit details and skills”."}</p>
        </div>
        <dl className="stats">
          <div><dt>Skills</dt><dd>{profile.skills.length}</dd></div>
          <div><dt>Contact details</dt><dd>{detectedContacts}</dd></div>
        </dl>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Skills</h3>
          {profile.skills.length > 0 && <span className="muted">Select one to see where it appears</span>}
        </div>
        {profile.skills.length > 0 ? <>
          {profile.skills.length > 8 && (
            <label className="search">
              <Icon name="search" />
              <input type="search" aria-label="Search detected skills" placeholder="Search skills" value={query} onChange={e => { setQuery(e.target.value); setSelectedSkill(null); }} />
            </label>
          )}
          <div className="chips">
            {visibleSkills.map(skill => (
              <button key={skill} type="button" className="chip chip-button" onClick={() => setSelectedSkill(selectedSkill === skill ? null : skill)} aria-pressed={selectedSkill === skill}>{skill}</button>
            ))}
          </div>
          {visibleSkills.length === 0 && <p className="muted" role="status">No skills match “{query}”.</p>}
          {selectedSkill && (
            <div className="evidence" key={selectedSkill}>
              <div className="evidence-head">
                <strong>{selectedSkill} in your resume</strong>
                <button type="button" className="btn-link" onClick={() => setSelectedSkill(null)}>Close</button>
              </div>
              {evidence.length > 0
                ? evidence.map((line, index) => <blockquote key={index}>{line}</blockquote>)
                : <p className="muted">Found through a related term or alias. Check the resume text below for context.</p>}
              <p className="fine-print">Mentions describe your resume, not how strong the skill is.</p>
            </div>
          )}
        </> : <p className="muted">No skills from our list were found. Your resume text is still used for matching, and you can add skills under “Edit details and skills”.</p>}
      </section>

      <details className="card disclosure">
        <summary><span>Contact details</span><span className="muted">{detectedContacts} of {contactFields.length} found</span></summary>
        <dl className="contact-grid">
          {contactFields.map(field => (
            <div key={field.label}><dt>{field.label}</dt><dd className={field.value ? "" : "muted"}>{field.value || "Not found"}</dd></div>
          ))}
        </dl>
        <p className="fine-print">Automatic extraction can miss details. Check these before using Fill-Assist on an application.</p>
      </details>

      <details className="card disclosure">
        <summary><span>Edit details and skills</span></summary>
        <ProfileEditor profile={profile} />
      </details>

      <details className="card disclosure">
        <summary><span>Resume text</span><span className="muted">What matching uses</span></summary>
        <pre className="resume-text">{profile.resumeText}</pre>
      </details>

      {onNavigate && (
        <section className="card cta">
          <div>
            <h3>Compare with a job</h3>
            <p className="muted">Paste a job description and see how your resume lines up.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("tailor")}>Start matching<Icon name="arrow" /></button>
        </section>
      )}
    </div>
  );
}
