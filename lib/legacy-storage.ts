"use client";

import { useSyncExternalStore } from "react";
import { CandidateProfile } from "@/types/profile";
import { APPLICATION_STATUSES, Application } from "@/types/application";

/**
 * Legacy browser-storage compatibility for explicit import into an account.
 * New workspace writes use Firestore in storage.ts. Keep these readers and
 * validators so old backups and quarantined data remain recoverable.
 *
 * Components read data via the `useProfile`/`useApplications` hooks (built
 * on `useSyncExternalStore`) rather than `useEffect` + `setState`, so that a
 * write from one component (e.g. saving a tailored job from the Tailor tab)
 * is immediately reflected everywhere else (e.g. the Track tab) without
 * manual refresh props, and without the "setState synchronously in an
 * effect" anti-pattern.
 */

const KEYS = {
  profile: "aca:profile",
  applications: "aca:applications",
} as const;

function isBrowser() {
  return typeof window !== "undefined";
}

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  if (isBrowser()) window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (isBrowser()) window.removeEventListener("storage", listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function isProfile(value: unknown): value is CandidateProfile {
  return isRecord(value) && ["name", "email", "phone", "resumeText", "updatedAt"].every(k => typeof value[k] === "string") &&
    Array.isArray(value.skills) && value.skills.every(s => typeof s === "string") &&
    ["address", "city", "state", "postalCode", "linkedin", "github", "portfolio", "website", "fileName"].every(k => value[k] === undefined || typeof value[k] === "string");
}
function isApplication(value: unknown): value is Application {
  if (!isRecord(value) || !isRecord(value.job)) return false;
  const result = value.tailorResult;
  return ["id", "createdAt", "updatedAt"].every(k => typeof value[k] === "string") &&
    APPLICATION_STATUSES.includes(value.status as Application["status"]) &&
    ["company", "title", "description"].every(k => typeof (value.job as Record<string, unknown>)[k] === "string") &&
    (value.job.url === undefined || typeof value.job.url === "string") &&
    (result === undefined || (isRecord(result) && typeof result.score === "number" && Number.isFinite(result.score) && result.score >= 0 && result.score <= 100 &&
      ["Strong match", "Moderate match", "Weak match"].includes(String(result.band)) && typeof result.aiEnhanced === "boolean" &&
      ["matchedSkills", "missingSkills", "suggestions"].every(k => Array.isArray(result[k]) && result[k].every((s: unknown) => typeof s === "string"))));
}
function readRaw(key: string): string | null {
  try { return isBrowser() ? window.localStorage.getItem(key) : null; } catch { return null; }
}

export class StorageError extends Error {
  constructor(message = "Browser storage is unavailable. Export a backup before changing browser settings.") { super(message); this.name = "StorageError"; }
}
function storageFailure(error: unknown): StorageError {
  return new StorageError(isRecord(error) && error.name === "QuotaExceededError"
    ? "Your browser storage is full. Export a backup and free space before retrying."
    : error instanceof StorageError ? error.message : undefined);
}
function decode(raw: string): unknown {
  const value: unknown = JSON.parse(raw);
  if (isRecord(value) && "version" in value) {
    if (value.version !== 1) throw new StorageError("This backup uses a newer storage version. Export it and update the app before editing.");
    return value.data;
  }
  return value; // legacy, unversioned data
}
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = readRaw(key);
    if (!raw) return fallback;
    const value = decode(raw);
    if (key === KEYS.profile) return (isProfile(value) ? value : fallback) as T;
    if (key === KEYS.applications) return (Array.isArray(value) ? value.filter(isApplication) : fallback) as T;
  } catch { /* Leave the original bytes intact; show recovery warning. */ }
  return fallback;
}
function preserveInvalid(key: string) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return;
  let invalid = false;
  try {
    const value = decode(raw);
    invalid = key === KEYS.profile ? !isProfile(value) : !Array.isArray(value) || value.some(item => !isApplication(item));
  } catch (error) {
    if (error instanceof StorageError) throw error;
    invalid = true;
  }
  if (invalid) {
    const quarantineKey = `${key}:invalid`;
    const previous = window.localStorage.getItem(quarantineKey);
    const archive = previous ? JSON.parse(previous) as string[] : [];
    if (!archive.includes(raw)) archive.push(raw);
    // If backup fails, abort the original write. Never discard invalid data.
    window.localStorage.setItem(quarantineKey, JSON.stringify(archive));
  }
}
function writeJSON<T>(key: string, value: T) {
  if (!isBrowser()) throw new StorageError();
  try {
    preserveInvalid(key);
    window.localStorage.setItem(key, JSON.stringify({ version: 1, data: value }));
    notify();
  } catch (error) { throw storageFailure(error); }
}
export function getProfile(): CandidateProfile | null { return readJSON(KEYS.profile, null); }
export function setProfile(profile: CandidateProfile) {
  if (!isProfile(profile)) throw new StorageError("Invalid profile");
  writeJSON(KEYS.profile, profile);
}
export function clearProfile() {
  try { preserveInvalid(KEYS.profile); window.localStorage.removeItem(KEYS.profile); notify(); }
  catch (error) { throw storageFailure(error); }
}
export function getApplications(): Application[] { return readJSON(KEYS.applications, []); }
export function saveApplications(applications: Application[]) { writeJSON(KEYS.applications, applications); }
async function locked<T>(run: () => T): Promise<T> {
  if (!isBrowser() || !navigator.locks) throw new StorageError("Saving requires a browser with Web Locks on HTTPS or localhost. Export a backup before switching browsers.");
  try { return await navigator.locks.request("aca:applications", run); }
  catch (error) { throw storageFailure(error); }
}
function sameJob(a: Application, b: Application) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\/+$/, "");
  if (a.job.url && b.job.url) return normalize(a.job.url) === normalize(b.job.url);
  return Boolean(a.job.company.trim() && a.job.title.trim() && normalize(a.job.company) === normalize(b.job.company) && normalize(a.job.title) === normalize(b.job.title));
}
export async function upsertApplication(application: Application) {
  if (!isApplication(application)) throw new StorageError("Invalid application");
  return locked(() => {
    const existing = getApplications();
    const idx = existing.findIndex(a => a.id === application.id || sameJob(a, application));
    if (idx === -1) existing.unshift(application);
    else existing[idx] = { ...existing[idx], ...application, id: existing[idx].id, createdAt: existing[idx].createdAt, status: existing[idx].status };
    saveApplications(existing);
    return existing;
  });
}
export async function updateApplicationStatus(id: string, status: Application["status"]) {
  if (!APPLICATION_STATUSES.includes(status)) throw new StorageError("Invalid status");
  return locked(() => {
    const existing = getApplications();
    const record = existing.find(a => a.id === id);
    if (!record) throw new StorageError("This application was removed in another tab.");
    record.status = status; record.updatedAt = new Date().toISOString();
    saveApplications(existing);
  });
}
export async function deleteApplication(id: string) {
  return locked(() => saveApplications(getApplications().filter(a => a.id !== id)));
}
export function exportBackup(): string {
  try {
    const entries: Record<string, string | null> = {};
    for (const key of Object.values(KEYS)) {
      entries[key] = window.localStorage.getItem(key);
      entries[`${key}:invalid`] = window.localStorage.getItem(`${key}:invalid`);
    }
    return JSON.stringify({ version: 1, entries }, null, 2);
  } catch (error) { throw storageFailure(error); }
}
export function exportPreviousBackup(): string {
  try {
    const snapshot = window.localStorage.getItem("aca:pre-import");
    if (!snapshot) throw new StorageError("No pre-import backup is available yet.");
    return snapshot;
  } catch (error) { throw storageFailure(error); }
}
export async function importBackup(text: string) {
  if (text.length > 10_000_000) throw new StorageError("Backup is too large");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new StorageError("Invalid backup JSON"); }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.entries)) throw new StorageError("Invalid backup format");
  const entries = parsed.entries;
  const rawProfile = entries[KEYS.profile];
  const rawApps = entries[KEYS.applications];
  const profile = typeof rawProfile === "string" ? decode(rawProfile) : null;
  const apps = typeof rawApps === "string" ? decode(rawApps) : [];
  if ((profile !== null && !isProfile(profile)) || !Array.isArray(apps) || !apps.every(isApplication)) throw new StorageError("Backup contains invalid records; keep the file for recovery. Nothing was imported.");
  const archives = Object.values(KEYS).map(key => {
    const raw = entries[`${key}:invalid`];
    if (raw == null) return { key: `${key}:invalid`, items: [] as string[] };
    if (typeof raw !== "string") throw new StorageError("Invalid recovery archive");
    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items) || !items.every(item => typeof item === "string")) throw new StorageError("Invalid recovery archive");
    return { key: `${key}:invalid`, items: items as string[] };
  });
  return locked(() => {
    // Keep an exact snapshot before either write so partial quota failures are recoverable.
    window.localStorage.setItem("aca:pre-import", exportBackup());
    for (const archive of archives) {
      if (!archive.items.length) continue;
      const previous = JSON.parse(window.localStorage.getItem(archive.key) || "[]") as string[];
      window.localStorage.setItem(archive.key, JSON.stringify([...new Set([...previous, ...archive.items])]));
    }
    const merged = getApplications();
    for (const app of apps) if (!merged.some(a => a.id === app.id || sameJob(a, app))) merged.push(app);
    saveApplications(merged);
    if (profile) setProfile(profile as CandidateProfile);
  });
}
function storageWarning(): string {
  if (!isBrowser()) return "";
  try {
    for (const key of Object.values(KEYS)) {
      if (window.localStorage.getItem(`${key}:invalid`)) return "Some unreadable records were preserved for recovery. Export a backup before clearing browser data.";
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const value = decode(raw);
      if (key === KEYS.profile ? !isProfile(value) : !Array.isArray(value) || !value.every(isApplication)) return "Some saved records cannot be read. Export a backup; the original data is still preserved.";
    }
    return "";
  } catch { return "Saved data cannot be read. Export a backup before making changes."; }
}
export function useStorageWarning() { return useSyncExternalStore(subscribe, storageWarning, () => ""); }

export function makeId(): string {
  if (isBrowser() && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- React bindings -------------------------------------------------------

let profileSnapshotRaw: string | null = null;
let profileSnapshotValue: CandidateProfile | null = null;

function getProfileSnapshot(): CandidateProfile | null {
  if (!isBrowser()) return null;
  const raw = readRaw(KEYS.profile);
  if (raw !== profileSnapshotRaw) {
    profileSnapshotRaw = raw;
    profileSnapshotValue = getProfile();
  }
  return profileSnapshotValue;
}

function getProfileServerSnapshot(): CandidateProfile | null {
  return null;
}

export function useProfile(): CandidateProfile | null {
  return useSyncExternalStore(
    subscribe,
    getProfileSnapshot,
    getProfileServerSnapshot
  );
}

let applicationsSnapshotRaw: string | null = null;
let applicationsSnapshotValue: Application[] = [];

function getApplicationsSnapshot(): Application[] {
  if (!isBrowser()) return applicationsSnapshotValue;
  const raw = readRaw(KEYS.applications);
  if (raw !== applicationsSnapshotRaw) {
    applicationsSnapshotRaw = raw;
    applicationsSnapshotValue = getApplications();
  }
  return applicationsSnapshotValue;
}

const EMPTY_APPLICATIONS: Application[] = [];
function getApplicationsServerSnapshot(): Application[] {
  return EMPTY_APPLICATIONS;
}

export function useApplications(): Application[] {
  return useSyncExternalStore(
    subscribe,
    getApplicationsSnapshot,
    getApplicationsServerSnapshot
  );
}
