export interface MatchBreakdown {
  /** 0-100 overall ATS-style match score. */
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  /** Human-readable band, e.g. "Strong match". */
  band: "Strong match" | "Moderate match" | "Weak match";
}

export interface TailorResult extends MatchBreakdown {
  suggestions: string[];
  /** Present only when suggestions came from the optional AI provider. */
  aiEnhanced: boolean;
}

export interface JobInput {
  company: string;
  title: string;
  url?: string;
  description: string;
}
