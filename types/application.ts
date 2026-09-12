import { JobInput, TailorResult } from "./job";

export type ApplicationStatus =
  | "discovered"
  | "tailored"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "discovered",
  "tailored",
  "applied",
  "interviewing",
  "offer",
  "rejected",
];

export interface Application {
  id: string;
  job: JobInput;
  tailorResult?: TailorResult;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}
