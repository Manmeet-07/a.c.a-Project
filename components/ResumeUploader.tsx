"use client";

import { useRef, useState } from "react";
import Icon from "./Icon";
import ResumeProfile from "./ResumeProfile";
import { CandidateProfile } from "@/types/profile";
import { setProfile as saveProfile, useProfile } from "@/lib/storage";
import { MAX_FILE_BYTES, MAX_FILE_LABEL } from "@/lib/limits";

export default function ResumeUploader({ onNavigate }: { onNavigate?: (tab: "tailor" | "track") => void }) {
  const profile = useProfile();
  const [selectedFile, setSelectedFile] = useState("");
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

    setSelectedFile(file.name);
    setStatus("loading");

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await fetch("/api/upload", {
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
      try { saveProfile(newProfile); }
      catch (error) {
        setStatus("error");
        setError(error instanceof Error ? error.message : "Your browser storage is full or unavailable.");
        return;
      }
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Something went wrong uploading this file. Please try again.");
    }
  }

  return (
    <div className={`profile-section flex flex-col gap-4 ${profile ? "has-profile" : ""}`} aria-busy={status === "loading"}>
      <div className="section-heading"><span className="section-icon"><Icon name="file" /></span><div><h2>Your resume, reintroduced.</h2><p>Upload once. Put your experience to work.</p></div><span className="format-badge">PDF</span></div>
      <label className={`upload-zone ${status === "loading" ? "upload-loading" : ""}`}>
        <span className="upload-symbol"><Icon name="upload" /></span>
        <strong>{status === "loading" ? "Getting to know your experience…" : profile ? "Keep your profile up to date" : "Bring your experience along"}</strong>
        <span className="upload-description">{status === "loading" ? "We’re extracting your details and skills." : "Choose your resume to create your career profile."}</span>
        <span className="upload-btn">{status === "loading" ? "Parsing resume…" : profile ? "Choose a new resume" : "Choose your resume"}<Icon name="arrow" /></span>
        <span className="upload-caption">PDF format · Up to {MAX_FILE_LABEL}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleUpload}
          disabled={status === "loading"}
          className="upload-input"
          aria-label="Upload PDF resume"
        />
      </label>

      {status === "loading" && <div className="resume-processing" role="status"><div className="processing-track"><span /></div><p>Reading your PDF and finding your contact details and skills<span className="processing-dots" aria-hidden="true">…</span></p><small>This can take a moment. Your existing profile stays available until the new one is ready.</small></div>}
      {selectedFile && status !== "error" && status !== "loading" && (
        <div className="selected-file">
          <Icon name="check" /> {selectedFile}
        </div>
      )}

      {status === "error" && error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {!profile && <div className="profile-preview"><div className="preview-top"><span className="preview-avatar"><Icon name="profile" /></span><div><strong>Your profile will appear here</strong><p>Contact details and skills, brought together automatically.</p></div></div><div className="preview-tags"><span>Contact information</span><span>Experience</span><span>Skills &amp; strengths</span></div></div>}
      {profile && <ResumeProfile key={profile.updatedAt} profile={profile} onNavigate={onNavigate} />}
    </div>
  );
}
