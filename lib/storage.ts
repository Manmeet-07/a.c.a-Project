"use client";

import { useSyncExternalStore } from "react";
import { CandidateProfile } from "@/types/profile";
import { APPLICATION_STATUSES, Application } from "@/types/application";

/**
 * There is no backend/database in this build (see README) -- everything is
 * persisted to the browser's localStorage instead. This module is the only
 * place that touches `localStorage` so the storage shape can change later
 * without every component needing to know about it.
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
    (result === undefined || (isRecord(result) && typeof result.score === "number" &&
      ["matchedSkills", "missingSkills", "suggestions"].every(k => Array.isArray(result[k]) && result[k].every((s: unknown) => typeof s === "string"))));
}
function readRaw(key: string): string | null {
  try { return isBrowser() ? window.localStorage.getItem(key) : null; } catch { return null; }
}

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (key === KEYS.profile) return (isProfile(value) ? value : fallback) as T;
    if (key === KEYS.applications) return (Array.isArray(value) ? value.filter(isApplication) : fallback) as T;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  notify();
}

export function getProfile(): CandidateProfile | null {
  return readJSON<CandidateProfile | null>(KEYS.profile, null);
}

export function setProfile(profile: CandidateProfile) {
  writeJSON(KEYS.profile, profile);
}

export function clearProfile() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEYS.profile);
  notify();
}

export function getApplications(): Application[] {
  return readJSON<Application[]>(KEYS.applications, []);
}

export function saveApplications(applications: Application[]) {
  writeJSON(KEYS.applications, applications);
}

export function upsertApplication(application: Application) {
  const existing = getApplications();
  const idx = existing.findIndex((a) => a.id === application.id);
  if (idx === -1) {
    existing.unshift(application);
  } else {
    existing[idx] = application;
  }
  saveApplications(existing);
  return existing;
}

export function deleteApplication(id: string) {
  const existing = getApplications().filter((a) => a.id !== id);
  saveApplications(existing);
  return existing;
}

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
