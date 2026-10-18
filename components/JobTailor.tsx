"use client";

import { useState } from "react";
import { JobInput, TailorResult } from "@/types/job";
import { Application } from "@/types/application";
import { makeId, upsertApplication, useProfile } from "@/lib/storage";
import { authenticatedFetch } from "@/lib/firebase-client";
import Icon from "./Icon";

const emptyJob: JobInput = { company: "", title: "", url: "", description: "" };

// The ring fills and the number counts up once per result (CSS only; the
// counter is visual, the real number is in the accessible text).
function ScoreRing({ score, weak }: { score: number; weak: boolean }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className={`score-ring ${weak ? "is-weak" : ""}`} style={{ ["--ring" as string]: circumference, ["--score" as string]: clamped }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="score-track" cx="60" cy="60" r={radius} />
        <circle className="score-value" cx="60" cy="60" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)} />
      </svg>
      <span className="score-number score-count" aria-hidden="true" />
      <span className="sr-only">{score}</span>
    </div>
  );
}

export default function JobTailor({ onNavigate }: { onNavigate?: (tab: "profile") => void }) {
  const profile = useProfile();
  const [job, setJob] = useState<JobInput>(emptyJob);
  const [result, setResult] = useState<TailorResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [saved, setSaved] = useState(false);

  const [scoredJob, setScoredJob] = useState<JobInput | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setResult(null);
    setScoredJob(null);
    setStatus("loading");
    setError(null);
    setSaved(false);

    try {
      if (useAI) await authenticatedFetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const res = await authenticatedFetch("/api/tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          useAI,
          resumeText: profile.resumeText,
          profileSkills: profile.skills,
          jobDescription: job.description,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus("error");
        setError(data?.error ?? "Couldn't score this job description.");
        return;
      }

      setScoredJob({ ...job });
      setResult(data.result as TailorResult);
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Something went wrong scoring this job. Please try again.");
    }
  }

  async function handleSaveToTracker() {
    if (!result || !scoredJob) return;
    const application: Application = {
      id: makeId(),
      job: { ...job, description: scoredJob.description },
      tailorResult: result,
      status: "tailored",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await upsertApplication(application);
      setSaved(true);
    } catch {
      setStatus("error");
      setError("Could not save to your account. Check your connection and try again.");
    }
  }

  if (!profile) {
    return (
      <div className="card empty">
        <h2>Start with your resume</h2>
        <p className="muted">Upload your resume on the Profile page, then come back to compare it with a job.</p>
        {onNavigate && <button type="button" className="btn btn-primary" onClick={() => onNavigate("profile")}>Go to Profile</button>}
      </div>
    );
  }

  const loading = status === "loading";
  const listed = result ? result.matchedSkills.length + result.missingSkills.length : 0;

  return (
    <div className="stack">
      <form onSubmit={handleSubmit} className="card form">
        <div className="field-grid">
          <label className="field"><span className="field-label">Company</span><input
            className="input"
            disabled={loading}
            value={job.company}
            onChange={(e) => { setJob({ ...job, company: e.target.value }); setSaved(false); }}
          /></label>
          <label className="field"><span className="field-label">Job title</span><input
            className="input"
            disabled={loading}
            value={job.title}
            onChange={(e) => { setJob({ ...job, title: e.target.value }); setSaved(false); }}
          /></label>
        </div>

        <label className="field"><span className="field-label">Job posting URL <span className="optional">(optional)</span></span><input
          className="input"
          disabled={loading}
          type="url"
          placeholder="https://"
          value={job.url}
          onChange={(e) => { setJob({ ...job, url: e.target.value }); setSaved(false); }}
        /></label>

        <label className="field"><span className="field-label">Job description</span><textarea
          aria-label="Job description"
          className="input textarea"
          placeholder="Paste the full job description"
          rows={9}
          disabled={loading}
          value={job.description}
          onChange={(e) => { setJob({ ...job, description: e.target.value }); setResult(null); setSaved(false); }}
          required
        /><span className="fine-print">At least 20 characters. The more detail, the better the comparison.</span></label>

        <label className="toggle">
          <input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} disabled={loading} />
          <span>
            <strong>Use AI suggestions</strong>
            <span className="muted">Sends resume excerpts (with likely contact lines removed) and this job description to Anthropic. If AI is unavailable or at its limit, local suggestions are used.</span>
          </span>
        </label>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || job.description.trim().length < 20}
          >
            {loading ? "Analyzing…" : "Analyze match"}
          </button>
        </div>

        {status === "error" && error && (
          <div className="notice notice-warning" role="alert">
            {error}
          </div>
        )}
      </form>

      {result && (
        <section className="card result" aria-label="Match result">
          <div className="score">
            <ScoreRing score={result.score} weak={result.band === "Weak match"} />
            <div>
              <h2>{result.band}</h2>
              <p className="muted">
                {listed > 0
                  ? `${result.matchedSkills.length} of ${listed} skills in this listing are on your resume.`
                  : "Based on wording only."}
                {result.aiEnhanced ? " Suggestions by AI." : ""}
              </p>
              <p className="fine-print">A score is a guide, not a verdict.</p>
            </div>
          </div>

          <div className="skill-columns">
            <div>
              <h3>On your resume</h3>
              <div className="chips">
                {result.matchedSkills.map((s) => <span key={s} className="chip chip-match"><Icon name="check" />{s}</span>)}
                {result.matchedSkills.length === 0 && <span className="muted">None found</span>}
              </div>
            </div>
            <div>
              <h3>Missing</h3>
              <div className="chips">
                {result.missingSkills.map((s) => <span key={s} className="chip chip-missing">{s}</span>)}
                {result.missingSkills.length === 0 && <span className="muted">Nothing missing</span>}
              </div>
            </div>
          </div>

          <div>
            <h3>What to emphasize</h3>
            <ol className="suggestions">
              {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveToTracker}
              disabled={saved}
            >
              {saved ? <><Icon name="check" />Saved to Applications</> : "Save to Applications"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
