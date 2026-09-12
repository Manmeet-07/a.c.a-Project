"use client";

import { useState } from "react";
import { JobInput, TailorResult } from "@/types/job";
import { Application } from "@/types/application";
import { makeId, upsertApplication, useProfile } from "@/lib/storage";

const emptyJob: JobInput = { company: "", title: "", url: "", description: "" };

export default function JobTailor() {
  const profile = useProfile();
  const [job, setJob] = useState<JobInput>(emptyJob);
  const [result, setResult] = useState<TailorResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setStatus("loading");
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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

      setResult(data.result as TailorResult);
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Something went wrong scoring this job. Please try again.");
    }
  }

  function handleSaveToTracker() {
    if (!result) return;
    const application: Application = {
      id: makeId(),
      job,
      tailorResult: result,
      status: "tailored",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertApplication(application);
    setSaved(true);
  }

  if (!profile) {
    return (
      <div className="empty-state">
        Upload a resume in the Profile tab first -- the tailoring engine
        scores job descriptions against your parsed profile.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <form onSubmit={handleSubmit} className="tailor-form">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            className="text-input"
            placeholder="Company"
            value={job.company}
            onChange={(e) => setJob({ ...job, company: e.target.value })}
          />
          <input
            className="text-input"
            placeholder="Job title"
            value={job.title}
            onChange={(e) => setJob({ ...job, title: e.target.value })}
          />
        </div>

        <input
          className="text-input"
          placeholder="Job posting URL (optional)"
          value={job.url}
          onChange={(e) => setJob({ ...job, url: e.target.value })}
        />

        <textarea
          className="text-input textarea"
          placeholder="Paste the full job description here..."
          rows={8}
          value={job.description}
          onChange={(e) => setJob({ ...job, description: e.target.value })}
          required
        />

        <button
          type="submit"
          className="primary-btn"
          disabled={status === "loading" || job.description.trim().length < 20}
        >
          {status === "loading" ? "Scoring..." : "Score match"}
        </button>

        {status === "error" && error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
      </form>

      {result && (
        <div className="result-card">
          <div className="score-row">
            <div className={`score-gauge score-${result.band === "Strong match" ? "strong" : result.band === "Moderate match" ? "moderate" : "weak"}`}>
              {result.score}
            </div>
            <div>
              <div className="score-band">{result.band}</div>
              <div className="score-sub">
                {result.matchedSkills.length} keyword
                {result.matchedSkills.length === 1 ? "" : "s"} matched
                {result.aiEnhanced ? " · AI-enhanced suggestions" : ""}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2 text-emerald-300">
                Matched ({result.matchedSkills.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.matchedSkills.map((s) => (
                  <span key={s} className="skill-badge skill-matched">
                    {s}
                  </span>
                ))}
                {result.matchedSkills.length === 0 && (
                  <span className="text-sm text-gray-400">None detected</span>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-amber-300">
                Missing ({result.missingSkills.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.missingSkills.map((s) => (
                  <span key={s} className="skill-badge skill-missing">
                    {s}
                  </span>
                ))}
                {result.missingSkills.length === 0 && (
                  <span className="text-sm text-gray-400">None -- full coverage</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="font-semibold mb-2">Tailoring suggestions</h4>
            <ul className="suggestion-list">
              {result.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>

          <button
            className="secondary-btn mt-4"
            onClick={handleSaveToTracker}
            disabled={saved}
          >
            {saved ? "Saved to tracker ✓" : "Save to application tracker"}
          </button>
        </div>
      )}
    </div>
  );
}
