"use client";

import { useState } from "react";
import {
  Application,
  APPLICATION_STATUSES,
  ApplicationStatus,
} from "@/types/application";
import {
  deleteApplication,
  makeId,
  upsertApplication,
  useApplications,
  useProfile,
} from "@/lib/storage";
import AutofillBookmarklet from "./AutofillBookmarklet";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  discovered: "Discovered",
  tailored: "Tailored",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export default function ApplicationTracker() {
  const profile = useProfile();
  const applications = useApplications();
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState({ company: "", title: "", url: "" });

  function updateStatus(id: string, status: ApplicationStatus) {
    const app = applications.find((a) => a.id === id);
    if (!app) return;
    upsertApplication({ ...app, status, updatedAt: new Date().toISOString() });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.company.trim() || !draft.title.trim()) return;

    const application: Application = {
      id: makeId(),
      job: {
        company: draft.company.trim(),
        title: draft.title.trim(),
        url: draft.url.trim() || undefined,
        description: "",
      },
      status: "discovered",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertApplication(application);
    setDraft({ company: "", title: "", url: "" });
    setShowAddForm(false);
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <AutofillBookmarklet profile={profile} />

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          Applications ({applications.length})
        </h3>
        <button
          className="secondary-btn"
          onClick={() => setShowAddForm((s) => !s)}
        >
          {showAddForm ? "Cancel" : "+ Add manually"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="tailor-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              className="text-input"
              placeholder="Company"
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              required
            />
            <input
              className="text-input"
              placeholder="Job title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
            />
          </div>
          <input
            className="text-input"
            placeholder="Job posting URL (optional)"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          />
          <button type="submit" className="primary-btn">
            Add to tracker
          </button>
        </form>
      )}

      {applications.length === 0 ? (
        <div className="empty-state">
          No applications yet. Tailor a job in the Tailor tab, or add one
          manually above.
        </div>
      ) : (
        <div className="tracker-list">
          {applications.map((app) => (
            <div key={app.id} className="tracker-row">
              <div className="tracker-main">
                <div className="tracker-title">
                  {app.job.title}{" "}
                  <span className="text-gray-400">@ {app.job.company}</span>
                </div>
                <div className="tracker-meta">
                  {app.tailorResult && (
                    <span className="tracker-score">
                      {app.tailorResult.score}% match
                    </span>
                  )}
                  {app.job.url && (
                    <a
                      href={app.job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tracker-link"
                    >
                      Open posting ↗
                    </a>
                  )}
                </div>
              </div>

              <div className="tracker-actions">
                <select
                  className="status-select"
                  value={app.status}
                  onChange={(e) =>
                    updateStatus(app.id, e.target.value as ApplicationStatus)
                  }
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-btn"
                  onClick={() => deleteApplication(app.id)}
                  aria-label="Delete application"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
