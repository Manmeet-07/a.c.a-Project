"use client";

import { useState } from "react";
import {
  Application,
  APPLICATION_STATUSES,
  ApplicationStatus,
} from "@/types/application";
import {
  deleteApplication,
  updateApplicationStatus,
  makeId,
  upsertApplication,
  useApplications,
  useProfile,
} from "@/lib/storage";
import AutofillBookmarklet from "./AutofillBookmarklet";
import Icon from "./Icon";
import { safeWebUrl } from "@/lib/urls";

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
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState({ company: "", title: "", url: "" });

  async function updateStatus(id: string, status: ApplicationStatus) {
    try { await updateApplicationStatus(id, status); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save status"); }
  }
  async function handleDelete(id: string) {
    if (!window.confirm("Delete this application? Export a backup first if you may need it later.")) return;
    try { await deleteApplication(id); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not delete application"); }
  }

  async function handleAdd(e: React.FormEvent) {
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
    try { await upsertApplication(application); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not save application"); return; }
    setDraft({ company: "", title: "", url: "" });
    setShowAddForm(false);
  }

  return (
    <div className="stack">
      {error && <div className="notice notice-warning" role="alert">{error}</div>}

      <section className="card">
        <div className="card-head">
          <h2>Applications{applications.length > 0 && <span className="count">{applications.length}</span>}</h2>
          <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm((s) => !s)} aria-expanded={showAddForm}>
            {showAddForm ? "Cancel" : <><Icon name="plus" />Add application</>}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAdd} className="form add-form">
            <div className="field-grid">
              <label className="field"><span className="field-label">Company</span><input
                className="input"
                maxLength={500}
                value={draft.company}
                onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                required
              /></label>
              <label className="field"><span className="field-label">Job title</span><input
                className="input"
                maxLength={500}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
              /></label>
            </div>
            <label className="field"><span className="field-label">Job posting URL <span className="optional">(optional)</span></span><input
              className="input"
              type="url"
              maxLength={2000}
              placeholder="https://"
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            /></label>
            <div className="form-actions"><button type="submit" className="btn btn-primary">Add</button></div>
          </form>
        )}

        {applications.length === 0 ? (
          <div className="empty">
            <h3>No applications yet</h3>
            <p className="muted">Save a job from Match, or add one yourself.</p>
          </div>
        ) : (
          <ul className="tracker-list">
            {applications.map((app) => {
              const url = safeWebUrl(app.job.url);
              return (
                <li key={app.id} className="tracker-row">
                  <div className="tracker-main">
                    <strong>{app.job.title}</strong>
                    <span className="muted">{app.job.company}</span>
                  </div>
                  <div className="tracker-meta">
                    {app.tailorResult && (
                      <span className={`pill ${app.tailorResult.band === "Weak match" ? "pill-warning" : "pill-accent"}`}>{app.tailorResult.score}% match</span>
                    )}
                    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-link">Posting<Icon name="external" /></a>}
                  </div>
                  <div className="tracker-actions">
                    <select
                      className="input select"
                      data-status={app.status}
                      aria-label={`Application status for ${app.job.title}`}
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <button type="button" className="icon-btn" onClick={() => handleDelete(app.id)} aria-label={`Delete ${app.job.title}`} title="Delete">
                      <Icon name="trash" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AutofillBookmarklet profile={profile} />
    </div>
  );
}
