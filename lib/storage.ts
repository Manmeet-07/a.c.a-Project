"use client";

import { useSyncExternalStore } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import type { CandidateProfile } from "@/types/profile";
import { APPLICATION_STATUSES, type Application } from "@/types/application";
import { getFirebase } from "./firebase-client";
import {
  isApplication,
  isProfile,
  MAX_APPLICATIONS,
  parseBackup,
  sameJob,
} from "./workspace-data";

// All durable workspace data belongs to a Firebase UID. Firestore uses a
// memory-only cache; signing out drops these snapshots and listeners.
export class StorageError extends Error {
  constructor(
    message = "Could not save to your account. Check your connection and try again.",
  ) {
    super(message);
    this.name = "StorageError";
  }
}
let uid: string | null = null;
let generation = 0;
let profile: CandidateProfile | null = null;
let applications: Application[] = [];
let status: "signed-out" | "loading" | "ready" | "error" = "signed-out";
let warning = "";
let previousBackup = "";
let subscriptions: Unsubscribe[] = [];
const listeners = new Set<() => void>();
const EMPTY: Application[] = [];
function notify() {
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function failure(error: unknown): StorageError {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code.includes("permission-denied"))
    return new StorageError(
      "Account access was denied. Verify your email and sign in again; if this continues, contact the ACA administrator.",
    );
  if (code.includes("resource-exhausted"))
    return new StorageError(
      "The account database is temporarily at its usage limit. Please try again later.",
    );
  return error instanceof StorageError ? error : new StorageError();
}
function account() {
  const services = getFirebase();
  if (
    !uid ||
    services.auth.currentUser?.uid !== uid ||
    !services.auth.currentUser.emailVerified
  )
    throw new StorageError("Please sign in with a verified account.");
  if (status !== "ready")
    throw new StorageError(
      "Your account is still loading. Please wait before making changes.",
    );
  return { ...services, uid, generation };
}
function assertAccount(expected: { uid: string; generation: number }) {
  if (
    uid !== expected.uid ||
    generation !== expected.generation ||
    getFirebase().auth.currentUser?.uid !== expected.uid
  )
    throw new StorageError("Your account changed. Please try again.");
}
export function connectWorkspace(nextUid: string | null) {
  if (uid === nextUid && status !== "error") return;
  subscriptions.forEach((unsubscribe) => unsubscribe());
  subscriptions = [];
  generation++;
  const current = generation;
  uid = nextUid;
  profile = null;
  applications = [];
  previousBackup = "";
  warning = "";
  status = nextUid ? "loading" : "signed-out";
  notify();
  if (!nextUid) return;
  const { db } = getFirebase();
  let profileLoaded = false;
  let appsLoaded = false;
  function ready() {
    if (current !== generation) return;
    if (profileLoaded && appsLoaded && status !== "error") status = "ready";
    notify();
  }
  function failed(error: unknown) {
    if (current !== generation) return;
    status = "error";
    warning = failure(error).message;
    notify();
  }
  // Real-time listeners are required: edits must follow the user between
  // devices and tabs without reload. No persistent/offline resume cache.
  subscriptions.push(
    onSnapshot(
      doc(db, "users", nextUid, "profile", "current"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          current !== generation ||
          snapshot.metadata.hasPendingWrites ||
          snapshot.metadata.fromCache
        )
          return;
        const value = snapshot.data();
        profile = isProfile(value) ? value : null;
        if (snapshot.exists() && !profile)
          warning =
            "Some account data could not be read. Export a backup and contact support; it has not been overwritten.";
        profileLoaded = true;
        ready();
      },
      failed,
    ),
  );
  subscriptions.push(
    onSnapshot(
      collection(db, "users", nextUid, "applications"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (
          current !== generation ||
          snapshot.metadata.hasPendingWrites ||
          snapshot.metadata.fromCache
        )
          return;
        const values = snapshot.docs.map((record) => record.data());
        applications = values
          .filter(isApplication)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (applications.length !== values.length)
          warning =
            "Some application records could not be read. They remain in your account; contact support before replacing data.";
        appsLoaded = true;
        ready();
      },
      failed,
    ),
  );
}
export function retryWorkspace() {
  if (uid) {
    const value = uid;
    status = "error";
    connectWorkspace(value);
  }
}
export function useWorkspaceStatus() {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => "signed-out" as const,
  );
}
export function useStorageWarning() {
  return useSyncExternalStore(
    subscribe,
    () => warning,
    () => "",
  );
}
export function useProfile() {
  return useSyncExternalStore(
    subscribe,
    () => profile,
    () => null,
  );
}
export function useApplications() {
  return useSyncExternalStore(
    subscribe,
    () => applications,
    () => EMPTY,
  );
}
export function getProfile() {
  return profile;
}
export function getApplications() {
  return applications;
}
// Capture before slow work (e.g. an upload) and pass to setProfile so the
// result can't land in an account that signed in meanwhile.
export function workspaceAccount() {
  return { uid, generation };
}
export async function setProfile(
  value: CandidateProfile,
  expected?: ReturnType<typeof workspaceAccount>,
) {
  if (!isProfile(value))
    throw new StorageError("Profile contains invalid or oversized fields.");
  const current = account();
  if (
    expected &&
    (expected.uid !== current.uid || expected.generation !== current.generation)
  )
    throw new StorageError(
      "Your account changed before this finished. Nothing was saved.",
    );
  try {
    await setDoc(
      doc(current.db, "users", current.uid, "profile", "current"),
      plain(value),
    );
    assertAccount(current);
  } catch (error) {
    throw failure(error);
  }
}
export async function clearProfile() {
  const current = account();
  try {
    await deleteDoc(
      doc(current.db, "users", current.uid, "profile", "current"),
    );
    assertAccount(current);
  } catch (error) {
    throw failure(error);
  }
}
export function makeId() {
  return crypto.randomUUID();
}
async function applicationId(application: Application): Promise<string> {
  const existing = applications.find(
    (item) => item.id === application.id || sameJob(item, application),
  );
  if (existing) return existing.id;
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\/+$/, "");
  const key = application.job.url
    ? normalize(application.job.url)
    : application.job.company.trim() && application.job.title.trim()
      ? `${normalize(application.job.company)}\n${normalize(application.job.title)}`
      : "";
  if (!key) return application.id;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return `job_${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
export async function upsertApplication(application: Application) {
  if (!isApplication(application))
    throw new StorageError("Application contains invalid or oversized fields.");
  const current = account();
  const id = await applicationId(application);
  assertAccount(current);
  try {
    await runTransaction(current.db, async (transaction) => {
      assertAccount(current);
      const reference = doc(
        current.db,
        "users",
        current.uid,
        "applications",
        id,
      );
      const previous = await transaction.get(reference);
      assertAccount(current);
      const old = previous.data();
      if (previous.exists() && !isApplication(old))
        throw new StorageError(
          "This application needs recovery before it can be changed.",
        );
      if (!previous.exists() && applications.length >= MAX_APPLICATIONS)
        throw new StorageError(
          `You can track up to ${MAX_APPLICATIONS} applications. Delete some before adding more.`,
        );
      const next = isApplication(old)
        ? {
            ...old,
            ...application,
            // Tracker and Tailor saves may leave these empty; keep what's stored.
            job: {
              ...old.job,
              ...application.job,
              url: application.job.url || old.job.url,
              description: application.job.description || old.job.description,
            },
            id,
            createdAt: old.createdAt,
            status: old.status,
          }
        : { ...application, id };
      transaction.set(reference, plain(next));
    });
    assertAccount(current);
  } catch (error) {
    throw failure(error);
  }
}
export async function updateApplicationStatus(
  id: string,
  nextStatus: Application["status"],
) {
  if (
    !APPLICATION_STATUSES.includes(nextStatus) ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(id)
  )
    throw new StorageError("Invalid application status.");
  const current = account();
  try {
    await runTransaction(current.db, async (transaction) => {
      assertAccount(current);
      const reference = doc(
        current.db,
        "users",
        current.uid,
        "applications",
        id,
      );
      const previous = await transaction.get(reference);
      assertAccount(current);
      if (!previous.exists() || !isApplication(previous.data()))
        throw new StorageError(
          "This application was removed or needs recovery.",
        );
      transaction.update(reference, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    });
    assertAccount(current);
  } catch (error) {
    throw failure(error);
  }
}
export async function deleteApplication(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new StorageError("Invalid application.");
  const current = account();
  try {
    await deleteDoc(doc(current.db, "users", current.uid, "applications", id));
    assertAccount(current);
  } catch (error) {
    throw failure(error);
  }
}
export function exportBackup() {
  account();
  return JSON.stringify(
    {
      version: 1,
      entries: {
        "aca:profile": profile
          ? JSON.stringify({ version: 1, data: profile })
          : null,
        "aca:applications": JSON.stringify({ version: 1, data: applications }),
      },
    },
    null,
    2,
  );
}
export function exportPreviousBackup() {
  account();
  if (!previousBackup)
    throw new StorageError(
      "No pre-import snapshot is available in this session.",
    );
  return previousBackup;
}
export function importBackup(text: string) {
  return importWorkspace(text, false);
}
async function importWorkspace(text: string, legacy: boolean) {
  const current = account();
  let incoming: ReturnType<typeof parseBackup>;
  try {
    incoming = parseBackup(text, legacy);
  } catch (error) {
    throw new StorageError(
      error instanceof Error ? error.message : "Invalid backup",
    );
  }
  const snapshot = exportBackup();
  const records = new Map<string, Application>();
  for (const app of incoming.applications) {
    const id = await applicationId(app);
    const duplicate = records.get(id);
    if (!duplicate || app.updatedAt > duplicate.updatedAt)
      records.set(id, { ...app, id });
  }
  assertAccount(current);
  try {
    await runTransaction(current.db, async (transaction) => {
      assertAccount(current);
      const references = [...records.keys()].map((id) =>
        doc(current.db, "users", current.uid, "applications", id),
      );
      const existing = await Promise.all(
        references.map((reference) => transaction.get(reference)),
      );
      const profileReference = doc(
        current.db,
        "users",
        current.uid,
        "profile",
        "current",
      );
      const oldProfile =
        legacy && incoming.profile
          ? await transaction.get(profileReference)
          : null;
      assertAccount(current);
      const added = existing.filter((record) => !record.exists()).length;
      // Also keeps every import within Firestore's 500 writes per transaction.
      if (applications.length + added > MAX_APPLICATIONS)
        throw new StorageError(
          `This import would take your account over ${MAX_APPLICATIONS} applications. Nothing was imported.`,
        );
      existing.forEach((record, index) => {
        if (!record.exists())
          transaction.set(
            references[index],
            plain(records.get(references[index].id)!),
          );
      });
      // Legacy browser data never replaces a newer (or unreadable) profile.
      const old = oldProfile?.data();
      if (
        incoming.profile &&
        (!oldProfile ||
          !oldProfile.exists() ||
          (isProfile(old) && incoming.profile.updatedAt > old.updatedAt))
      )
        transaction.set(profileReference, plain(incoming.profile));
    });
    assertAccount(current);
    previousBackup = snapshot;
  } catch (error) {
    throw failure(error);
  }
  return { skipped: incoming.skipped };
}
const LEGACY_IMPORTED = "aca:legacy-imported";
export function hasLegacyBrowserData() {
  try {
    return Boolean(
      !window.localStorage.getItem(LEGACY_IMPORTED) &&
        (window.localStorage.getItem("aca:profile") ||
          window.localStorage.getItem("aca:applications")),
    );
  } catch {
    return false;
  }
}
export async function importLegacyBrowserData() {
  account();
  const { exportBackup: exportLegacy } = await import("./legacy-storage");
  // Explicit user action only; originals remain intact.
  const result = await importWorkspace(exportLegacy(), true);
  try {
    window.localStorage.setItem(LEGACY_IMPORTED, new Date().toISOString());
  } catch {}
  return result;
}
