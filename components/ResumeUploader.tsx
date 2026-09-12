"use client";

import { useRef, useState } from "react";
import { CandidateProfile } from "@/types/profile";
import { setProfile as saveProfile, useProfile } from "@/lib/storage";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // keep in sync with app/api/upload/route.ts

export default function ResumeUploader() {
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
      setError("File is too large (10MB max).");
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
      saveProfile(newProfile);
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Something went wrong uploading this file. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <label className="upload-btn">
        {status === "loading" ? "Parsing..." : "📄 Upload Resume"}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleUpload}
          disabled={status === "loading"}
          hidden
        />
      </label>

      {selectedFile && status !== "error" && (
        <div className="selected-file">
          {status === "loading" ? "⏳" : "✅"} {selectedFile}
        </div>
      )}

      {status === "error" && error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {profile && (
        <div className="profile-card">
          <h2 className="text-2xl font-bold mb-4">
            {profile.name || "Name not detected"}
          </h2>

          <div className="space-y-2 text-gray-200">
            <div>
              <span className="font-semibold">Email:</span>{" "}
              {profile.email || "Not detected"}
            </div>

            <div>
              <span className="font-semibold">Phone:</span>{" "}
              {profile.phone || "Not detected"}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="font-semibold mb-2">
              Skills ({profile.skills.length})
            </h3>

            {profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span key={skill} className="skill-badge">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No known skills detected. You can still use this profile --
                matching just won&apos;t have much to compare against yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
