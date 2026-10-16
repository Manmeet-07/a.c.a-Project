"use client";
import { useState } from "react";
import { CandidateProfile } from "@/types/profile";
import { setProfile } from "@/lib/storage";
import { SKILL_DEFINITIONS } from "@/lib/skills";

const FIELDS = ["name", "email", "phone", "address", "city", "state", "postalCode", "linkedin", "github", "website", "portfolio"] as const;
export default function ProfileEditor({ profile }: { profile: CandidateProfile }) {
  const [draft, setDraft] = useState(profile);
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [error, setError] = useState("");
  return <details className="bookmarklet-card"><summary>Correct contact details and skills</summary>
    <p>Automatic address and phone extraction currently favors US formats. You can enter names, addresses, and international phone numbers here. Only list skills you actually have.</p>
    <form onSubmit={event => {
      event.preventDefault();
      try {
        const vocabulary = new Map(SKILL_DEFINITIONS.flatMap(s => [s.canonical, ...(s.aliases || [])].map(alias => [alias.toLowerCase(), s.canonical] as const)));
        const entered = skills.split(",").map(s => s.trim()).filter(Boolean);
        if (entered.some(s => !vocabulary.has(s.toLowerCase()))) { setError("Use recognized skill names from the suggestions below."); return; }
        setProfile({ ...draft, skills: [...new Set(entered.map(s => vocabulary.get(s.toLowerCase())!))], updatedAt: new Date().toISOString() });
      } catch (error) { setError(error instanceof Error ? error.message : "Could not save profile"); }
    }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{FIELDS.map(field => <label className="field-label" key={field}>{field === "postalCode" ? "Postal code" : field}<input className="text-input" value={draft[field] || ""} maxLength={500} onChange={event => setDraft({ ...draft, [field]: event.target.value })} /></label>)}</div>
      <label className="field-label">Skills (comma separated)<input className="text-input" value={skills} maxLength={5000} onChange={event => setSkills(event.target.value)} /></label>
      <details><summary>Recognized skills</summary><p>{SKILL_DEFINITIONS.map(s => s.canonical).join(", ")}</p></details>
      <button className="primary-btn" type="submit">Save corrections</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>;
}
