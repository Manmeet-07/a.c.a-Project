import { extractSkills } from "./skills";
import { MatchBreakdown, TailorResult } from "@/types/job";

const STOPWORDS = new Set(
  (
    "a an and are as at be by for from has have how in is it its of on or " +
    "that the this to was were will with your you we our their they " +
    "responsibilities requirements preferred qualifications experience " +
    "years including etc within across using ability strong excellent " +
    "including team work working ensure able must plus role job company"
  ).split(" ")
);

// Han/Kana text has no spaces between words, so runs of it become overlapping character bigrams.
const CJK_RUN = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30fc]+)/u;
function splitCjk(token: string): string[] {
  return token.split(CJK_RUN).flatMap((part, i) => {
    const chars = Array.from(part);
    if (i % 2 === 0 || chars.length < 3) return [part];
    return chars.slice(1).map((char, j) => chars[j] + char);
  });
}

function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}+.#]+/gu, " ")
    .split(/\s+/)
    .flatMap(splitCjk)
    .map(t => t.replace(/\.+$/, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function termFrequencyVector(tokens: string[]): Map<string, number> {
  const vec = new Map<string, number>();
  for (const token of tokens) {
    vec.set(token, (vec.get(token) ?? 0) + 1);
  }
  for (const [term, count] of vec) vec.set(term, 1 + Math.log(count));
  return vec;
}

/**
 * Similarity = (A . B) / (||A|| ||B||)
 *
 * Straightforward cosine similarity over term-frequency vectors. This is a
 * local stand-in for the pgvector/embedding-based semantic matching in the
 * full spec (which needs a real embeddings model + vector database, neither
 * of which is available in this build) -- but it implements the same
 * similarity formula the spec calls for.
 */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dot = 0;
  for (const [term, weight] of a) {
    const other = b.get(term);
    if (other) dot += weight * other;
  }

  const magnitude = (vec: Map<string, number>) =>
    Math.sqrt(Array.from(vec.values()).reduce((sum, w) => sum + w * w, 0));

  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;

  return dot / (magA * magB);
}

function band(score: number): MatchBreakdown["band"] {
  if (score >= 70) return "Strong match";
  if (score >= 40) return "Moderate match";
  return "Weak match";
}

export function scoreMatch(
  resumeText: string,
  profileSkills: string[],
  jobDescription: string
): MatchBreakdown {
  const resumeVec = termFrequencyVector(tokenize(resumeText));
  const jobVec = termFrequencyVector(tokenize(jobDescription));

  const textSimilarity = cosineSimilarity(resumeVec, jobVec); // 0..1

  const jdSkills = extractSkills(jobDescription);
  const profileSkillSet = new Set(profileSkills.map((s) => s.toLowerCase()));

  const matchedSkills = jdSkills.filter((s) =>
    profileSkillSet.has(s.toLowerCase())
  );
  const missingSkills = jdSkills.filter(
    (s) => !profileSkillSet.has(s.toLowerCase())
  );

  const skillCoverage =
    jdSkills.length > 0 ? matchedSkills.length / jdSkills.length : 0;

  // Blend keyword-vector cosine similarity with explicit skill coverage so a
  // resume that mentions the right named technologies scores well even if
  // overall wording differs a lot from the JD, and vice versa.
  const blended = jdSkills.length ? 0.45 * textSimilarity + 0.55 * skillCoverage : textSimilarity;
  const score = Math.round(Math.min(1, blended) * 100);

  return {
    score,
    matchedSkills,
    missingSkills,
    band: band(score),
  };
}

/**
 * Rule-based tailoring suggestions.
 *
 * Deliberately mirrors the spec's system-prompt "CRITICAL RULES": never
 * invent skills, employers, titles, or metrics the candidate didn't
 * provide. For a missing JD skill, we only ever suggest emphasizing an
 * *adjacent* skill the candidate already has -- never claim the missing one.
 */
const ADJACENCY: Record<string, string[]> = {
  react: ["javascript", "typescript", "vue", "angular", "svelte"],
  vue: ["javascript", "typescript", "react"],
  angular: ["typescript", "javascript", "react"],
  "next.js": ["react", "javascript", "typescript"],
  "node.js": ["javascript", "typescript", "express"],
  django: ["python", "flask", "fastapi"],
  flask: ["python", "django", "fastapi"],
  fastapi: ["python", "django", "flask"],
  kubernetes: ["docker", "devops", "ci/cd"],
  docker: ["kubernetes", "devops", "linux"],
  aws: ["gcp", "azure", "devops", "docker"],
  gcp: ["aws", "azure", "devops"],
  azure: ["aws", "gcp", "devops"],
  postgresql: ["mysql", "sqlite", "sql"],
  mysql: ["postgresql", "sql", "sqlite"],
  mongodb: ["sql", "postgresql", "mysql"],
  tensorflow: ["pytorch", "scikit-learn", "python", "machine learning"],
  pytorch: ["tensorflow", "scikit-learn", "python", "machine learning"],
  "machine learning": ["python", "pandas", "numpy", "scikit-learn"],
  graphql: ["rest", "node.js", "javascript"],
};

export function generateSuggestions(
  matchedSkills: string[],
  missingSkills: string[],
  profileSkills: string[]
): string[] {
  const suggestions: string[] = [];
  const profileLower = new Set(profileSkills.map((s) => s.toLowerCase()));
  // Show adjacent skills with the candidate's own capitalization ("Docker", not "docker").
  const displayName = new Map(profileSkills.map((s) => [s.toLowerCase(), s]));

  if (matchedSkills.length > 0) {
    suggestions.push(
      `Lead with your strongest overlap: surface ${matchedSkills
        .slice(0, 4)
        .join(", ")} in your summary and first one or two bullet points. Applicant tracking systems and recruiters both give early keywords more weight.`
    );
  }

  // At most six adjacency tips; any skill without one (or past the cap) is still named in the next line.
  const genuinelyMissing: string[] = [];
  let adjacencyTips = 0;
  for (const missing of missingSkills) {
    const adjacent = (ADJACENCY[missing.toLowerCase()] ?? []).filter((a) =>
      profileLower.has(a)
    );
    if (adjacent.length > 0 && adjacencyTips < 6) {
      adjacencyTips++;
      suggestions.push(
        `The listing asks for ${missing}, which isn't on your resume. Don't claim it. Instead, highlight your ${adjacent
          .slice(0, 2)
          .map((a) => displayName.get(a) ?? a)
          .join(" and ")} experience as related groundwork.`
      );
    } else {
      genuinelyMissing.push(missing);
    }
  }

  if (genuinelyMissing.length > 0) {
    suggestions.push(
      `No close match on your profile for: ${genuinelyMissing
        .slice(0, 6)
        .join(", ")}. If you have real experience with these, add them to your profile. Otherwise, leave them out.`
    );
  }

  if (!matchedSkills.length && !missingSkills.length) {
    // Nothing was found to "cover", so don't claim the resume covers it.
    suggestions.push(
      "No skills from our list appear in this listing, so the score compares wording only.",
      "Focus on rewording your bullet points to use the listing's exact terms."
    );
  } else if (!missingSkills.length) {
    suggestions.push(
      "Your resume already covers the skills in this listing. Focus on rewording your bullet points to use the listing's exact terms."
    );
  }

  return suggestions;
}

export function buildTailorResult(
  resumeText: string,
  profileSkills: string[],
  jobDescription: string,
  aiSuggestions: string[] | null
): TailorResult {
  const breakdown = scoreMatch(resumeText, profileSkills, jobDescription);
  const suggestions =
    aiSuggestions ??
    generateSuggestions(
      breakdown.matchedSkills,
      breakdown.missingSkills,
      profileSkills
    );

  return {
    ...breakdown,
    suggestions,
    aiEnhanced: aiSuggestions !== null,
  };
}
