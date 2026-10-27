"use client";

import { useRef, useState } from "react";
import Icon from "./Icon";
import ResumeProfile from "./ResumeProfile";
import { CandidateProfile } from "@/types/profile";
import { setProfile as saveProfile, useProfile, workspaceAccount } from "@/lib/storage";
import { authenticatedFetch } from "@/lib/firebase-client";
import { MAX_FILE_BYTES, MAX_FILE_LABEL } from "@/lib/limits";

export default function ResumeUploader({ onNavigate }: { onNavigate?: (tab: "tailor" | "track") => void }) {
  const profile = useProfile();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so selecting the exact same file twice in a row still
    // fires a change event (browsers otherwise treat it as a no-op).
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setError(null);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("error");
      setError("Only PDF resumes are supported.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus("error");
      setError(`File is too large (${MAX_FILE_LABEL} max).`);
      return;
    }

    setStatus("loading");
    const owner = workspaceAccount();

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await authenticatedFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus("error");
        setError(data?.error ?? "Failed to parse this resume.");
        return;
      }

      const newProfile: CandidateProfile = data.profile;
      try { await saveProfile(newProfile, owner); }
      catch (error) {
        setStatus("error");
        setError(error instanceof Error ? error.message : "Could not save to your account. Please try again.");
        return;
      }
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Something went wrong uploading this file. Please try again.");
    }
  }

  const loading = status === "loading";
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".pdf,application/pdf"
      onChange={handleUpload}
      disabled={loading}
      className="file-input"
      aria-label="Upload PDF resume"
    />
  );

  return (
    <div className="stack" aria-busy={loading}>
      {profile ? (
        <div className="card replace-row">
          <span className="file-badge"><Icon name="file" /></span>
          <div className="replace-copy">
            <strong>{profile.fileName || "Your resume"}</strong>
            <span>Updated {new Date(profile.updatedAt).toLocaleDateString()}</span>
          </div>
          <label className="btn btn-secondary file-button">
            {loading ? "Reading…" : "Replace PDF"}
            {fileInput}
          </label>
        </div>
      ) : (
        <label className={`card drop-zone ${loading ? "is-loading" : ""}`}>
          <span className="drop-icon"><Icon name="upload" /></span>
          <strong>{loading ? "Reading your resume…" : "Upload your resume"}</strong>
          <span className="muted">{loading ? "Finding your contact details and skills." : "Choose a PDF, or drop it here."}</span>
          {!loading && <span className="btn btn-primary">Choose PDF</span>}
          <span className="fine-print">PDF · up to {MAX_FILE_LABEL}</span>
          {fileInput}
        </label>
      )}

      {loading && <div className="progress" role="status" aria-label="Reading your resume"><span /></div>}

      {status === "error" && error && (
        <div className="notice notice-warning" role="alert">
          {error}
        </div>
      )}

      {profile && <ResumeProfile key={profile.updatedAt} profile={profile} onNavigate={onNavigate} />}
    </div>
  );
}
