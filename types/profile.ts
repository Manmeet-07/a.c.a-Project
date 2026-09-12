export interface CandidateProfile {
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  website?: string;
  skills: string[];
  /** Full extracted resume text, used by the tailoring engine for match scoring. */
  resumeText: string;
  /** Original uploaded file name, kept for display purposes. */
  fileName?: string;
  /** ISO timestamp of when the profile was last (re)uploaded. */
  updatedAt: string;
}
