/**
 * Known technical skill vocabulary used for resume parsing and JD matching.
 *
 * The original Phase 1 implementation hard-coded 13 keywords, which meant
 * the vast majority of real resumes/job descriptions were scored against an
 * almost-empty vocabulary. This list is still not exhaustive, but it covers
 * the common languages, frameworks, cloud/data tooling, and practices that
 * an early-career software/technical candidate (the platform's stated
 * target audience) is likely to list.
 *
 * `aliases` lets us treat common variants ("JS", "Node.js", "Postgres") as
 * the same underlying skill so matching doesn't miss obvious synonyms.
 */
export interface SkillDefinition {
  canonical: string;
  aliases?: string[];
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  // Languages
  { canonical: "JavaScript", aliases: ["JS"] },
  { canonical: "TypeScript", aliases: ["TS"] },
  { canonical: "Python" },
  { canonical: "Java" },
  { canonical: "C++" },
  { canonical: "C#" },
  { canonical: "C" },
  { canonical: "Go", aliases: ["Golang"] },
  { canonical: "Rust" },
  { canonical: "Ruby" },
  { canonical: "PHP" },
  { canonical: "Swift" },
  { canonical: "Kotlin" },
  { canonical: "Scala" },
  { canonical: "R" },
  { canonical: "MATLAB" },
  { canonical: "Verilog" },
  { canonical: "VHDL" },
  { canonical: "SQL" },
  { canonical: "HTML" },
  { canonical: "CSS" },

  // Frontend
  { canonical: "React", aliases: ["React.js", "ReactJS"] },
  { canonical: "Next.js", aliases: ["NextJS"] },
  { canonical: "Vue", aliases: ["Vue.js"] },
  { canonical: "Angular" },
  { canonical: "Svelte" },
  { canonical: "Tailwind CSS", aliases: ["TailwindCSS", "Tailwind"] },
  { canonical: "Redux" },

  // Backend / runtimes
  { canonical: "Node.js", aliases: ["NodeJS"] },
  { canonical: "Express", aliases: ["Express.js"] },
  { canonical: "Django" },
  { canonical: "Flask" },
  { canonical: "FastAPI" },
  { canonical: "Spring Boot", aliases: ["Spring Framework"] },
  { canonical: ".NET", aliases: ["DotNet", "ASP.NET"] },
  { canonical: "GraphQL" },
  { canonical: "REST", aliases: ["RESTful", "REST API"] },

  // Data / ML
  { canonical: "Pandas" },
  { canonical: "NumPy" },
  { canonical: "TensorFlow" },
  { canonical: "PyTorch" },
  { canonical: "Scikit-learn", aliases: ["sklearn"] },
  { canonical: "Machine Learning", aliases: ["ML"] },
  { canonical: "Deep Learning" },
  { canonical: "NLP" },
  { canonical: "Spark", aliases: ["Apache Spark"] },
  { canonical: "Hadoop" },
  { canonical: "ETL" },

  // Databases
  { canonical: "PostgreSQL", aliases: ["Postgres"] },
  { canonical: "MySQL" },
  { canonical: "MongoDB", aliases: ["Mongo"] },
  { canonical: "Redis" },
  { canonical: "SQLite" },
  { canonical: "DynamoDB" },
  { canonical: "Elasticsearch" },

  // Cloud / infra
  { canonical: "AWS", aliases: ["Amazon Web Services"] },
  { canonical: "GCP", aliases: ["Google Cloud", "Google Cloud Platform"] },
  { canonical: "Azure" },
  { canonical: "Docker" },
  { canonical: "Kubernetes", aliases: ["K8s"] },
  { canonical: "Terraform" },
  { canonical: "CI/CD", aliases: ["CICD"] },
  { canonical: "DevOps" },
  { canonical: "Linux" },
  { canonical: "Bash" },
  { canonical: "Jenkins" },
  { canonical: "GitHub Actions" },

  // Tools / practice
  { canonical: "Git" },
  { canonical: "GitHub" },
  { canonical: "GitLab" },
  { canonical: "Jira" },
  { canonical: "Agile" },
  { canonical: "Scrum" },
  { canonical: "Unit Testing", aliases: ["Jest", "PyTest", "JUnit"] },
  { canonical: "Microservices" },
  { canonical: "API Design" },
];

// Ambiguous words require a technical list/context, not ordinary prose.
const AMBIGUOUS = new Set(["C", "R", "Go", "Express", "Swift", "Spark", "REST", "ML", "TS", "JS"]);
// Everyday words and names ("react quickly", "Ruby Jenkins") count in prose only when capitalised.
const CASED = new Set(["React", "Rust", "Ruby", "Angular", "Jenkins", "Bash", "Flask", "Azure", "Svelte", "Tailwind", "Jest"]);
export const JOB_TITLE = /\b(?:Engineer|Developer|Programmer|Scientist|Manager|Analyst|Designer|Architect|Consultant|Specialist|Director|Administrator|Intern)s?\b/i;
const BULLET = /^\s*[-–•*·▪◦‣●]\s*/;
const HEADING = /^([\p{L}&/]+(?:\s+[\p{L}&/]+){0,3})\s*:\s*/u;
const SKILL_HEADING = /\b(?:skills|technologies|languages|stack|tools|frameworks)\b/i;
const NAME_LIKE = /^\p{Lu}[\p{L}\p{M}'’.-]*(?:\s+\p{Lu}[\p{L}\p{M}'’.-]*){1,3}$/u;
const NEEDLES = SKILL_DEFINITIONS.flatMap(skill => [skill.canonical, ...(skill.aliases || [])]);
// Longest first, so "Tailwind CSS" or "GitHub Actions" do not also count as CSS or GitHub.
const MULTI_WORD = NEEDLES.filter(needle => needle.includes(" ")).sort((a, b) => b.length - a.length);
const patterns = new Map<string, RegExp>();
function pattern(needle: string, flags: string): RegExp {
  const key = `${flags}:${needle}`;
  if (!patterns.has(key)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Ambiguous words joined by a hyphen are prose ("Go-to-market", "C-suite", "Objective-C").
    const head = AMBIGUOUS.has(needle) ? "(?<![a-zA-Z0-9-])" : "(?<![a-zA-Z0-9])";
    const tail = needle === "C" ? "(?![a-zA-Z0-9+#-])" : needle === "R" ? "(?![a-zA-Z0-9&-])" : AMBIGUOUS.has(needle) ? "(?![a-zA-Z0-9-])" : "(?![a-zA-Z0-9])";
    patterns.set(key, new RegExp(`${head}${escaped}${tail}${flags.includes("q") ? "\\s+(?:programming|language|developer|development|framework|API)\\b" : ""}`, flags.replace("q", "")));
  }
  return patterns.get(key)!;
}
function mask(text: string): string {
  return MULTI_WORD.reduce((masked, needle) => masked.replace(pattern(needle, "gi"), match => " ".repeat(match.length)), text);
}
function listItems(line: string): string[] {
  return line.split(/\s*[,|;•·]\s*|\s+(?:and|&)\s+/).map(item => item.replace(/\s*\([^)]*\)$/, "").replace(/[.;:]+$/, "").trim()).filter(Boolean);
}
function found(text: string, masked: string, needle: string): boolean {
  if (needle.includes(" ")) return pattern(needle, "i").test(text);
  const cased = CASED.has(needle);
  if (!cased && !AMBIGUOUS.has(needle)) return pattern(needle, "i").test(masked);
  const same = (value: string) => cased ? value.toLowerCase() === needle.toLowerCase() : value === needle;
  return masked.split(/\n/).some((line, index) => {
    let rest = line.replace(BULLET, "");
    const heading = rest.match(HEADING);
    if (heading && SKILL_HEADING.test(heading[1])) return pattern(needle, cased ? "i" : "").test(rest);
    if (heading) rest = rest.slice(heading[0].length);
    const items = listItems(rest);
    if (items.some(item => item.split("/").some(same))) return true;
    if (!cased) return pattern(needle, "q").test(line);
    // A capitalised word in a header item like "Ruby Jenkins" is the applicant's name.
    return items.some(item => pattern(needle, "").test(item) && !(index < 5 && NAME_LIKE.test(item) && !JOB_TITLE.test(item)));
  });
}
function mentions(text: string, masked: string, canonical: string): boolean {
  const definition = SKILL_DEFINITIONS.find(skill => skill.canonical === canonical);
  return Boolean(definition && [definition.canonical, ...(definition.aliases || [])].some(needle => found(text, masked, needle)));
}
export function mentionsSkill(text: string, canonical: string): boolean {
  return mentions(text, mask(text), canonical);
}
export function extractSkills(text: string): string[] {
  const masked = mask(text);
  return SKILL_DEFINITIONS.filter(skill => mentions(text, masked, skill.canonical)).map(skill => skill.canonical).sort();
}
