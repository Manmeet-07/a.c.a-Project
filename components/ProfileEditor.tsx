"use client";
import { useState } from "react";
import { CandidateProfile } from "@/types/profile";
import { setProfile } from "@/lib/storage";
import { SKILL_DEFINITIONS } from "@/lib/skills";

const FIELDS = [
  ["name", "Full name"], ["email", "Email"], ["phone", "Phone"], ["address", "Street address"],
  ["city", "City"], ["state", "State or region"], ["postalCode", "Postal code"], ["linkedin", "LinkedIn"],
  ["github", "GitHub"], ["website", "Website"], ["portfolio", "Portfolio"],
] as const;

export default function ProfileEditor({ profile }: { profile: CandidateProfile }) {
  const [draft, setDraft] = useState(profile);
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [error, setError] = useState("");
  return (
    <form className="form" onSubmit={event => {
      event.preventDefault();
      try {
        const vocabulary = new Map(SKILL_DEFINITIONS.flatMap(s => [s.canonical, ...(s.aliases || [])].map(alias => [alias.toLowerCase(), s.canonical] as const)));
        const entered = skills.split(",").map(s => s.trim()).filter(Boolean);
        if (entered.some(s => !vocabulary.has(s.toLowerCase()))) { setError("Use recognized skill names from the list below."); return; }
        setProfile({ ...draft, skills: [...new Set(entered.map(s => vocabulary.get(s.toLowerCase())!))], updatedAt: new Date().toISOString() });
      } catch (error) { setError(error instanceof Error ? error.message : "Could not save profile"); }
    }}>
      <p className="muted">Automatic extraction works best with US-style addresses and phone numbers. Correct anything here, including international details. Only list skills you actually have.</p>
      <div className="field-grid">
        {FIELDS.map(([field, label]) => (
          <label className="field" key={field}>
            <span className="field-label">{label}</span>
            <input className="input" value={draft[field] || ""} maxLength={500} onChange={event => setDraft({ ...draft, [field]: event.target.value })} />
          </label>
        ))}
      </div>
      <label className="field">
        <span className="field-label">Skills (comma separated)</span>
        <input className="input" value={skills} maxLength={5000} onChange={event => setSkills(event.target.value)} />
      </label>
      <details className="inline-disclosure"><summary>Recognized skills</summary><p className="muted">{SKILL_DEFINITIONS.map(s => s.canonical).join(", ")}</p></details>
      <div><button className="btn btn-primary" type="submit">Save changes</button></div>
      {error && <p className="notice notice-warning" role="alert">{error}</p>}
    </form>
  );
}
