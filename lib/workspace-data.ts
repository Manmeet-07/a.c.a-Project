import { SKILL_DEFINITIONS } from "./skills";
const knownSkills = new Set(SKILL_DEFINITIONS.map((skill) => skill.canonical));
const skills = (value: unknown): value is string[] =>
  strings(value) && value.every((skill) => knownSkills.has(skill));
import type { CandidateProfile } from "@/types/profile";
import { APPLICATION_STATUSES, type Application } from "@/types/application";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function strings(
  value: unknown,
  maxItems = 200,
  maxLength = 100,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= maxLength)
  );
}
function field(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}
function only(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
export function isProfile(value: unknown): value is CandidateProfile {
  const optional = [
    "address",
    "city",
    "state",
    "postalCode",
    "linkedin",
    "github",
    "portfolio",
    "website",
    "fileName",
  ];
  return (
    isRecord(value) &&
    only(value, [
      "name",
      "email",
      "phone",
      "skills",
      "resumeText",
      "updatedAt",
      ...optional,
    ]) &&
    ["name", "email", "phone"].every((key) => field(value[key], 500)) &&
    field(value.resumeText, 100000) &&
    field(value.updatedAt, 40) &&
    skills(value.skills) &&
    optional.every((key) => value[key] === undefined || field(value[key], 2000))
  );
}
export function isApplication(value: unknown): value is Application {
  if (
    !isRecord(value) ||
    !only(value, [
      "id",
      "job",
      "status",
      "createdAt",
      "updatedAt",
      "notes",
      "tailorResult",
    ]) ||
    !isRecord(value.job)
  )
    return false;
  if (
    !field(value.id, 128) ||
    !/^[a-zA-Z0-9_-]+$/.test(value.id) ||
    !APPLICATION_STATUSES.includes(value.status as Application["status"])
  )
    return false;
  if (
    !field(value.createdAt, 40) ||
    !field(value.updatedAt, 40) ||
    (value.notes !== undefined && !field(value.notes, 10000))
  )
    return false;
  if (
    !only(value.job, ["company", "title", "description", "url"]) ||
    !field(value.job.company, 500) ||
    !field(value.job.title, 500) ||
    !field(value.job.description, 50000) ||
    (value.job.url !== undefined && !field(value.job.url, 2000))
  )
    return false;
  const result = value.tailorResult;
  return (
    result === undefined ||
    (isRecord(result) &&
      only(result, [
        "score",
        "band",
        "aiEnhanced",
        "matchedSkills",
        "missingSkills",
        "suggestions",
      ]) &&
      typeof result.score === "number" &&
      Number.isFinite(result.score) &&
      result.score >= 0 &&
      result.score <= 100 &&
      ["Strong match", "Moderate match", "Weak match"].includes(
        String(result.band),
      ) &&
      typeof result.aiEnhanced === "boolean" &&
      skills(result.matchedSkills) &&
      skills(result.missingSkills) &&
      strings(result.suggestions, 10, 5000))
  );
}
export function sameJob(a: Application, b: Application) {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\/+$/, "");
  if (a.job.url && b.job.url)
    return normalize(a.job.url) === normalize(b.job.url);
  return Boolean(
    a.job.company.trim() &&
      a.job.title.trim() &&
      normalize(a.job.company) === normalize(b.job.company) &&
      normalize(a.job.title) === normalize(b.job.title),
  );
}
export const MAX_APPLICATIONS = 400;
// skipInvalid drops unreadable records instead of rejecting the whole backup.
export function parseBackup(
  text: string,
  skipInvalid = false,
): {
  profile: CandidateProfile | null;
  applications: Application[];
  skipped: number;
} {
  if (text.length > 10000000) throw new Error("Backup is too large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid backup JSON");
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.entries))
    throw new Error("Invalid backup format");
  const entries = parsed.entries;
  let skipped = 0;
  function decode(value: unknown): unknown {
    if (value == null) return null;
    if (typeof value !== "string") throw new Error("Invalid backup record");
    const item: unknown = JSON.parse(value);
    if (isRecord(item) && "version" in item) {
      if (item.version !== 1) throw new Error("Unsupported backup version");
      return item.data;
    }
    return item;
  }
  function entry(key: string): unknown {
    try {
      return decode(entries[key]);
    } catch (error) {
      if (!skipInvalid) throw error;
      skipped++;
      return null;
    }
  }
  let profile = entry("aca:profile");
  let applications = entry("aca:applications") ?? [];
  if (skipInvalid) {
    if (profile !== null && !isProfile(profile)) {
      profile = null;
      skipped++;
    }
    if (Array.isArray(applications)) {
      const valid = applications.filter(isApplication);
      skipped += applications.length - valid.length;
      applications = valid;
    }
  }
  if (
    (profile !== null && !isProfile(profile)) ||
    !Array.isArray(applications) ||
    applications.length > MAX_APPLICATIONS ||
    !applications.every(isApplication)
  )
    throw new Error(
      "Backup contains invalid records or more than 400 applications. Nothing was imported.",
    );
  return { profile, applications, skipped };
}
